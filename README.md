# archdraw-skill

Give your coding agent an architecture workspace. This repository packages ArchDraw as an installable skill. The skill helps an MCP-capable coding agent turn a system description or codebase context into an editable, shareable architecture diagram, refine an existing view, and document proposed architecture changes.

ArchDraw is for system context, service boundaries, request and event flows, data stores, external dependencies, and change plans. It is not for generic flowcharts.

The skill has two parts, and the agent needs both:

- **The skill** (`skills/archdraw-diagram/SKILL.md`): instructions that tell the agent when and how to use ArchDraw.
- **The ArchDraw MCP server**: the tools that make the diagrams. Connect it to the hosted endpoint `https://archdraw.hiabhee.online/api/mcp`, or run `@hiabhee/archdraw-mcp-server` locally.

> **Claude Code or Codex?** The [ArchDraw plugin](https://github.com/hiabhee/ArchDraw/tree/main/plugins/archdraw) installs a skill and the MCP server in one step. Use it in place of this repository if you do not need the `archdraw-diagram` skill specifically.

## Quick setup

```bash
npx -y archdraw-agent@0.1.4 setup
```

The installer finds Codex, Claude Code, and OpenCode on your machine. For each one, it installs the skill and connects ArchDraw:

| Agent | Skill location | MCP connection |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/archdraw-diagram/` | Hosted endpoint, user scope |
| Codex | `~/.codex/skills/archdraw-diagram/` | Local server `@hiabhee/archdraw-mcp-server@1.0.5` with `API_BASE_URL` |
| OpenCode | `~/.config/opencode/skills/archdraw-diagram/` | Hosted endpoint in `~/.config/opencode/opencode.json` (v1 or v2 format, from `opencode --version`). The old file is kept as `opencode.json.bak`. |

Options:

- `--agent codex|claude|opencode`: set up one agent only.
- `--dry-run`: show what would change. Change nothing.
- `--force`: replace an existing ArchDraw skill and MCP entry.

Restart the agent after setup.

### Repair an install from 0.1.3 or earlier

Versions 0.1.3 and earlier registered the local server without `API_BASE_URL`. With that install, the tools load, but diagram generation fails with "requires API_BASE_URL". Versions 0.1.3 and earlier also wrote the OpenCode v2 format into all OpenCode configs. To repair an install, run:

```bash
npx -y archdraw-agent@0.1.4 setup --force
```

## Manual setup

### 1. Install the skill

**Claude Code**

```bash
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
```

**Codex**

Copy the complete `skills/archdraw-diagram` directory into `~/.codex/skills/archdraw-diagram/`.

**OpenCode**

Copy the complete `skills/archdraw-diagram` directory into `.opencode/skills/archdraw-diagram/` for one project, or into `~/.config/opencode/skills/archdraw-diagram/` for all projects.

### 2. Connect the ArchDraw MCP server

Use the hosted endpoint when your client supports remote MCP servers. You do not install anything.

**Claude Code**

```bash
claude mcp add --scope user --transport http archdraw https://archdraw.hiabhee.online/api/mcp
```

**Codex**

```bash
codex mcp add archdraw --env API_BASE_URL=https://archdraw.hiabhee.online -- npx -y @hiabhee/archdraw-mcp-server@1.0.5
```

**Claude apps (claude.ai, Claude Desktop, Claude mobile)**

Go to **Settings → Connectors → Add custom connector**. Use the URL `https://archdraw.hiabhee.online/api/mcp`.

**OpenCode v1** (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "archdraw": {
      "type": "remote",
      "url": "https://archdraw.hiabhee.online/api/mcp",
      "enabled": true
    }
  }
}
```

**OpenCode v2** (`opencode.jsonc`)

```json
{
  "mcp": {
    "servers": {
      "archdraw": {
        "type": "remote",
        "url": "https://archdraw.hiabhee.online/api/mcp"
      }
    }
  }
}
```

**Other clients**

Use the remote URL `https://archdraw.hiabhee.online/api/mcp` with the Streamable HTTP transport. If the client supports only local servers, use this configuration:

```json
{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "@hiabhee/archdraw-mcp-server@1.0.5"],
      "env": {
        "API_BASE_URL": "https://archdraw.hiabhee.online"
      }
    }
  }
}
```

> **CAUTION:** The local server requires `API_BASE_URL`. It has no default. If you do not set it, the tools load, but `generate_diagram`, `fix_layout`, and preview links fail. For a self-hosted ArchDraw, set it to your deployment URL. The local server needs Node.js 18 or later.

For steps and verification in Cursor, VS Code, Gemini CLI, and other clients, read [Connect a coding agent](https://archdraw.hiabhee.online/docs/connect-agents).

### 3. Verify

```bash
claude mcp list     # Claude Code
codex mcp list      # Codex
opencode mcp list   # OpenCode
```

Make sure that `archdraw` is connected. Then ask your agent to list the ArchDraw tools. You should see `generate_diagram`, `validate_diagram`, and the other ArchDraw tools.

## Usage

Try prompts like:

- `Use the codebase context to create an architecture map of the checkout flow.`
- `Show me a microservices architecture for an e-commerce app with an API gateway, auth service, and Postgres.`
- `Add a caching layer between the API gateway and the database.`
- `Create a proposed-state diagram for splitting the payment module, and identify the affected dependencies.`

The agent clarifies the view, writes Mermaid, and calls ArchDraw. ArchDraw lays out the diagram with the same Mermaid → Dagre pipeline as its editor. The agent replies with two links: `shareUrl` (a read-only preview) and `diagramUrl` (the editor).

## Data and privacy

- The tools send only the diagram content that the agent gives them: component names, labels, connections, and Mermaid text. They do not read your source files.
- Each new diagram gets a preview link by default. Anyone with the link can see it. Links expire after 7 days. To prevent a link, tell the agent to keep the diagram private (`publish: false`).
- Do not put secrets in diagram labels.

Refer to the [privacy policy](https://archdraw.hiabhee.online/privacy).

## Troubleshooting

| Problem | Corrective action |
| --- | --- |
| `generate_diagram` fails with "requires API_BASE_URL". | Add `API_BASE_URL=https://archdraw.hiabhee.online` to the local server, or run `npx -y archdraw-agent@0.1.4 setup --force`. |
| Follow-up calls fail with "needs the workingSessionId". | The agent must resend the `workingSessionId` from `generate_diagram`. Update the skill to 0.1.4 or later. |
| The tools do not appear. | Fully restart the agent. Then run the list command for your agent. |
| OpenCode does not load ArchDraw. | Make sure the entry uses the format for your OpenCode version (v1 or v2 above). |
| The skill does not trigger. | Ask explicitly: "Use the archdraw-diagram skill to diagram this repository." |

## Development

```bash
npm test
```

The tests check the commands that the installer writes, and that the MCP version pin in `bin/archdraw-agent.mjs`, `SKILL.md`, and this README is the same. When `@hiabhee/archdraw-mcp-server` gets a new version, update `MCP_PACKAGE` in `bin/archdraw-agent.mjs`, then update the pin in `SKILL.md` and this README until `npm test` passes.

## License

MIT. Refer to [LICENSE](./LICENSE).
