# Implementation Notes: ArchDraw Local MCP via NPM + Skill Distribution

Date: 2026-09-05  
Repo: `hiabhee/archdraw-skill` (skill) + `hiabhee/ArchDraw/mcp-server` (MCP server)  
Frontend: `https://archdraw.hiabhee.online` (alias `https://arch-draw.vercel.app`, Vercel project `arch-draw` `prj_5MgObfV2mmR9JM6RSgy5Ld6ZApfF`)  
NPM: `archdraw-mcp-server@1.0.0` (published), `1.0.1` (base URL fix, pending OTP)  
Skill: `archdraw-diagram` under `skills/archdraw-diagram/SKILL.md`

---

## 1. Goal

Make `archdraw-skill` shareable so friends can:

```bash
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
claude mcp add archdraw -- npx -y archdraw-mcp-server
```

and get diagrams via Claude (Desktop / Code) without cloning `ArchDraw` or running local frontend.

Context: frontend already deployed on Vercel and working; MCP was not deployed.

## 2. Architecture

### 2.1 Before (local dev only)

```
ArchDraw frontend (Next.js, Vercel)  <-- REST /api/diagram/load
       ^
       | HTTP (fetchWithTimeout, 8s)
       |
mcp-server/src/index.ts  (StdioServerTransport, SDK 1.0.8)
       ^
       | stdio JSON-RPC
       |
Claude Code (local) via `npm run dev:mcp` → `npx tsx src/index.ts` (frontend/package.json:8)
```

`API_BASE_URL` env fallback `http://localhost:3000` in `mcp-server/src/lib/diagram-state.ts:54`, `tools/generate-diagram.ts:207,417`, `apply-template.ts:376`, `export-diagram.ts:5`, `update-diagram.ts:194`. Only worked if frontend ran locally.

### 2.2 After (shareable, local NPM)

```
User's Claude Code/Desktop
  -> stdio -> npx -y archdraw-mcp-server (npm, runs locally on friend's machine, Node >=18)
  -> HTTP  -> https://archdraw.hiabhee.online/api/diagram/load (Vercel frontend, already deployed)
  -> returns { sessionId, nodes, edges } -> diagramUrl https://archdraw.hiabhee.online/editor?session=... 
                                          -> shareUrl https://archdraw.hiabhee.online/share/...
```

No separate MCP host needed. Remote MCP (HTTP/SSE) like Notion `https://mcp.notion.com` was considered but rejected for now:
- Requires wrapping `StdioServerTransport` → `StreamableHTTPServerTransport` + Express (`src/http.ts`) + deploying to Fly/Railway/Cloud Run (Vercel serverless bad for stateful `diagram-state.ts:10` in-memory store).
- Costs/infra vs. `npx` is zero-cost and standard for OSS MCPs.

### 2.3 Repo Layout

Published skill (`archdraw-skill/`):

```
archdraw-skill/
├── README.md                          # Skill + MCP install, verify, troubleshooting
├── LICENSE (MIT <YEAR> <NAME>)
└── skills/archdraw-diagram/SKILL.md   # Frontmatter + 9-stage pipeline, failure handling
```

Source MCP (`ArchDraw/mcp-server/`):

```
mcp-server/
├── src/index.ts (#!/usr/bin/env node, 11 tools)
├── src/lib/{diagram-state,http,schema,constants}
├── src/tools/{generate-diagram,fix-layout,list-nodes,apply-template,read-me,validate-diagram,...}
├── package.json (bin, files, publishConfig)
└── dist/ (tsc output, .gitignored, published via files: ["dist"])
```

## 3. How Local MCP via NPM Works

### 3.1 NPM Package Mechanics

`mcp-server/package.json:7-15` added:

```json
{
  "name": "archdraw-mcp-server",
  "bin": { "archdraw-mcp-server": "dist/index.js" },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=18.0.0" }
}
```

- `bin` makes `npx -y archdraw-mcp-server` resolve to `dist/index.js`.
- `files` ensures only `dist/` is published (node_modules are installed by npm on consumer side via `dependencies: @modelcontextprotocol/sdk@1.0.8, elkjs@0.11.1, zod@3.23.8`).
- `publishConfig.access: public` needed for unscoped package.

Shebang in `src/index.ts:1` (`#!/usr/bin/env node`) preserved by `tsc` into `dist/index.js:1` (verified `head -n1 dist/index.js`). `chmod +x dist/index.js` makes bin executable. Type `module` keeps ESM imports (`NodeNext` resolution).

### 3.2 Build & Pack

```bash
cd ArchDraw/mcp-server
npm run build   # tsc (tsconfig.json: ES2022, NodeNext, outDir dist)
npm test        # vitest 4.1.10 — 23 passed (constants, diagram-state, elk-runner, ...)
npm pack --dry-run  # shows 109 files, 84.9 kB tarball, shasum f42f1cd...
```

Handshake test (proof bin works):

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  | npx -y archdraw-mcp-server
# -> {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"archdraw-mcp-server","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
# stderr: "ArchDraw MCP server running on stdio" (src/index.ts:795)
```

`tools/list` also returns full tool descriptions (generate_diagram doc 300+ lines with tier colors, edge rules).

### 3.3 Distribution & Install

Published via:

```bash
npm login                    # browser auth at https://www.npmjs.com/login?next=/login/cli/...
npm publish --access public  # 1.0.0 succeeded, 1.0.1 requires --otp=<2FA code>
npm view archdraw-mcp-server version # 1.0.0 -> 1.0.1 after OTP
```

Consumers:

**Claude Code:**
```bash
claude mcp add archdraw -- npx -y archdraw-mcp-server
# with custom frontend:
claude mcp add archdraw --env API_BASE_URL=https://archdraw.hiabhee.online -- npx -y archdraw-mcp-server
claude mcp list
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "archdraw-mcp-server"],
      "env": { "API_BASE_URL": "https://archdraw.hiabhee.online" }
    }
  }
}
```

If `npx` not found (nvm users), use full path:

```json
"command": "/Users/<user>/.nvm/versions/node/v22.22.1/bin/npx"
# your which npx: /Users/abhisheksureshjamdade/.nvm/versions/node/v22.22.1/bin/npx
```

Skill install (same for all consumers):

```bash
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
npx skills list
```

## 4. Base URL Handling

Frontend aliases verified via `vercel alias ls` / `vercel inspect`:

```
https://archdraw.hiabhee.online
https://archdraw.abhishekjamdade.xyz
https://arch-draw.vercel.app
```

Initial `API_BASE_URL` fallback was `http://localhost:3000` (dev). For published npm, default must be public host or friends get 404 without env. Fixed in `1.0.1`:

```ts
// before (6 files)
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
// after
const API_BASE = process.env.API_BASE_URL || 'https://archdraw.hiabhee.online';
```

Files changed: `src/lib/diagram-state.ts:54`, `src/tools/generate-diagram.ts:207,417`, `apply-template.ts:376`, `export-diagram.ts:5`, `update-diagram.ts:194`, plus doc string in `src/index.ts:321` (`http://localhost:3000/editor?session=` → `https://archdraw.hiabhee.online/editor?session=`). Until `1.0.1` is published, `1.0.0` users must set `env.API_BASE_URL` explicitly (already in README).

## 5. SKILL.md Pipeline Contract

`skills/archdraw-diagram/SKILL.md` frontmatter triggers on architecture diagram, GitHub repo visualization, or critique. Body enforces:

1. Prerequisite check: if MCP tools missing → tell user to connect, don't try alternative.
2. Workflow in order: Intent detection → (repo? AST extraction) → Mermaid generation → AST validation+self-repair (≤16 retries) → ELK layout → React Flow conversion → Quality scoring → storyGuard → Semantic layer grouping (4-tier).
3. Failure handling: report stage that failed (validation exhausted or storyGuard reject) instead of broken diagram.
4. Output contract: passes AST validation, quality score above threshold, layers grouped. Design system monochrome + DodgerBlue #1E90FF/#2B7FD9 sole accent.

## 6. Implementation Steps Executed

1. **Repo scaffold** (`archdraw-skill/`): `mkdir -p`, write `SKILL.md`, `README.md` (placeholder `<ARCHDRAW_MCP_SETUP_URL>`, `<github-username>`), `LICENSE`, `git init`, commit `Initial skill: archdraw-diagram`, add remote `hiabhee/archdraw-skill`, push.
2. **MCP prepare for npm**: edit `package.json` (bin/files/publishConfig/keywords/repository/license), add shebang to `src/index.ts`, `chmod +x`, `npm run build`, `npm test`, `npm pack --dry-run`, handshake test, commit `chore(mcp): publish ...`, push to `hiabhee/ArchDraw`.
3. **Publish**: `npm login` (browser), `npm publish` → `1.0.0` live at https://registry.npmjs.org/archdraw-mcp-server/-/archdraw-mcp-server-1.0.0.tgz ; verify `npm view`.
4. **Docs fill**: replace placeholders in `README.md` with `hiabhee/archdraw-skill` and `archdraw-mcp-server` instructions, verify section, troubleshooting; commit `docs: fill npm MCP install...`, push.
5. **Debug Desktop transport closed**: found `claude_desktop_config.json` pointed to `/Desktop/MVPS/ArchDraw/frontend/mcp-server/dist/index.js` (non-existent) → `MODULE_NOT_FOUND` → fix to `npx -y archdraw-mcp-server`.
6. **Base URL**: change default from `localhost:3000` to `https://archdraw.hiabhee.online` (6 files), bump to `1.0.1`, rebuild, commit `chore(mcp): default API_BASE_URL...`, push, update `README.md` + local config, push `docs: use https://archdraw.hiabhee.online...`. Publish `1.0.1` pending OTP (`EOTP` 401, need `npm publish --otp=<code>`).

## 7. What We Learned

* **Local NPM *is* shareable** — `npx -y <pkg>` + `bin` is the standard shareable pattern; no separate host needed if frontend already hosted. Remote HTTP MCP is only needed for web Claude without Node or centralized auth/billing.
* **`bin` + shebang + `files: ["dist"]` is enough** — no need to publish `src` or `node_modules`; npm installs deps on consumer side. `tsc` preserves shebang if at line 1.
* **ELK stays in mcp-server, Dagre in frontend** — documented in `AGENTS.md`; mixing causes layout drift. MCP's `elkjs` is heavy but works headless.
* **`API_BASE_URL` pattern** (`diagram-state.ts:54` + tools) cleanly decouples MCP (stateless compute) from frontend (stateful storage via `/api/diagram/load` + `/api/diagram/session/[sessionId]`). Frontend aliases mean any alias works.
* **Skill + MCP are separate layers** — skill installs instructions (`npx skills add`), MCP installs runtime (`claude mcp add`). README must state “skill alone does nothing without MCP” (added note in `README.md:12`).
* **Vercel aliases are first-class** — `archdraw.hiabhee.online` is just an alias to same deployment; no code change needed beyond URL string.
* **Handshake test is cheap proof** — `echo '{"method":"initialize"}' | npx -y archdraw-mcp-server` catches 90% of packaging bugs before asking friend to test.

## 8. What Didn't Work / Pitfalls

| Issue | Symptom | Root Cause | Fix |
|-------|---------|------------|-----|
| **Wrong config path** | `2026-09-05T03:19:48.407Z [archdraw] [info] Server transport closed ... process exiting early` + `MODULE_NOT_FOUND` | `claude_desktop_config.json` had `"args": ["/Desktop/MVPS/ArchDraw/frontend/mcp-server/dist/index.js"]` — old `frontend/mcp-server` path, actual is `code/ArchDraw/mcp-server/dist/index.js` | Changed to `"command":"npx","args":["-y","archdraw-mcp-server"]` with `env.API_BASE_URL` |
| **Default `localhost:3000`** | Friend's MCP generates diagram but returns `http://localhost:3000/editor?session=...` 404 or fetch fails | Hardcoded fallback `|| 'http://localhost:3000'` in 6 files | Changed to `|| 'https://archdraw.hiabhee.online'` (`1.0.1`) |
| **`npx` not found in Claude Desktop** | Same transport closed, but handshake works in terminal | `nvm` installs `npx` under `~/.nvm/.../bin/npx`, Claude spawns without `PATH` | Use full path `"/Users/.../.nvm/versions/node/v22.22.1/bin/npx"` |
| **`npm login` via agent** | `npm login` in bash tool timed out after 120s, `ENEEDAUTH` persisting | Agent bash has no browser; `npm login` opens `https://www.npmjs.com/login?next=/login/cli/...` that needs manual browser auth | Ran `npm login` manually in user's terminal; agent only verifies `npm whoami` afterwards |
| **`npm publish` OTP** | `PUT 401 archdraw-mcp-server EOTP This operation requires a one-time password` after `1.0.1` build | npm 2FA enforced for updates (first publish `1.0.0` succeeded without OTP, patches require OTP) | Need `npm publish --otp=<6-digit>` from Authenticator; pending at time of writing (`npm view` still `1.0.0`) |
| **`sed -i ''` with `'`** | `sed: 1: "s|...|...": bad flag` | BSD sed quoting with `'` inside pattern | Switched to `python3` replace via `pathlib` |
| **`npm pack` includes tests** | `dist/lib/__tests__/*.js` appeared in tarball despite `files: ["dist"]` | `tsc` compiles `__tests__` into `dist`; `files` includes whole `dist` | Acceptable (455kB), could add `dist/**/__tests__/**` ignore but not blocking |
| **Vercel serverless vs MCP** | Initial idea to deploy MCP to Vercel alongside frontend | `StdioServerTransport` needs long-lived process; Vercel functions are short-lived, plus `diagram-state.ts:10` is in-memory | Documented remote HTTP as separate Fly/Railway/Cloud Run option, not pursued for local NPM path |
| **`.tgz` committed** | `archdraw-mcp-server-1.0.0.tgz` showed as `??` in `git status` after `npm pack` | `npm pack` creates tarball in cwd, not ignored | Added `*.tgz` to `mcp-server/.gitignore`, removed file |

## 9. Verification for Friends / CI

```bash
# MCP
npm view archdraw-mcp-server version
npx -y archdraw-mcp-server --help  # or init handshake
claude mcp list  # archdraw connected
# In Claude: "Do you have ArchDraw tools?" -> lists generate_diagram etc.

# Skill
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
npx skills list  # archdraw-diagram present
# In Claude: "Diagram this repo: https://github.com/vercel/next.js" -> runs repo→AST→Mermaid→validation(≤16)→ELK→React Flow→quality→storyGuard→4-tier
```

Logs: `~/Library/Logs/Claude/mcp-archdraw.log` should contain `ArchDraw MCP server running on stdio` after fix; earlier logs showed `Cannot find module .../Desktop/MVPS/...`.

## 10. Future Work

* Publish `1.0.1` (OTP) so default URL works without `env`.
* Consider `dist` pruning (`__tests__` exclusion) + `npm pkg fix` for `repository.url` warning.
* Optional remote HTTP MCP (`src/http.ts` + `StreamableHTTPServerTransport` + `Dockerfile` + Fly deploy) if shareability needs to cover users without Node.
* Add GitHub Action to `archdraw-skill` to validate `SKILL.md` frontmatter and `README.md` placeholders on push.
* Publish skill to Smithery / MCP registry for discoverability (friends currently use direct git + npm URLs).
