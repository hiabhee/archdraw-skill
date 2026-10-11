---
name: archdraw-diagram
description: Create, refine, validate, and export software architecture diagrams in ArchDraw. Use for architecture views, system maps, repository-informed diagrams, and architecture change documentation; do not use for generic flowcharts or UI mockups.
---

# ArchDraw Diagram

Use ArchDraw when a user needs a clear, editable software architecture diagram or wants to turn codebase knowledge into a shared architecture view. ArchDraw is for system context, service boundaries, request and event flows, data stores, external dependencies, and proposed architecture changes.

## Prerequisite: the ArchDraw MCP tools

**Check first.** Confirm that the ArchDraw MCP tools (`generate_diagram`, `validate_diagram`, and the others below) are available. Some clients add a server prefix to tool names, such as `archdraw_generate_diagram`. If the tools are missing, do not invent a diagram and do not substitute another diagram tool. Help the user connect ArchDraw, then check again.

**If you have shell access**, you may run the installer once. It installs this skill and connects ArchDraw for Codex, Claude Code, and OpenCode:

```bash
npx -y archdraw-agent@0.1.4 setup --dry-run   # preview
npx -y archdraw-agent@0.1.4 setup
```

If it succeeds, tell the user to restart the agent, then check the tools again. If it fails, or you have no shell, **do not retry in a loop**. Give the user the matching setup below, wait for confirmation, then check again.

**Manual setup.** Prefer the hosted endpoint when the client supports remote MCP servers. It needs no local install.

- **Claude Code:** install the plugin (`/plugin marketplace add hiabhee/ArchDraw`, then `/plugin install archdraw@archdraw`), or run:
  ```bash
  claude mcp add --scope user --transport http archdraw https://archdraw.hiabhee.online/api/mcp
  ```
- **Codex:** install the plugin (`codex plugin marketplace add hiabhee/ArchDraw`, then `codex plugin add archdraw@archdraw`), or run:
  ```bash
  codex mcp add archdraw --env API_BASE_URL=https://archdraw.hiabhee.online -- npx -y @hiabhee/archdraw-mcp-server@1.0.5
  ```
- **Claude apps (claude.ai, Desktop, mobile):** Settings → Connectors → Add custom connector, with URL `https://archdraw.hiabhee.online/api/mcp`.
- **OpenCode v1** (`opencode.json`): `"mcp": { "archdraw": { "type": "remote", "url": "https://archdraw.hiabhee.online/api/mcp", "enabled": true } }`
- **OpenCode v2** (`opencode.jsonc`): `"mcp": { "servers": { "archdraw": { "type": "remote", "url": "https://archdraw.hiabhee.online/api/mcp" } } }`
- **Other clients:** use the remote URL above with the Streamable HTTP transport. If the client supports only local servers, use command `npx`, arguments `-y @hiabhee/archdraw-mcp-server@1.0.5`, and environment `API_BASE_URL=https://archdraw.hiabhee.online`.

The local server **requires** `API_BASE_URL`. Without it, the tools load but `generate_diagram`, `fix_layout`, and preview links fail with "requires API_BASE_URL". For a self-hosted ArchDraw, use that deployment's URL instead. The local server needs Node.js 18 or later. Every client needs a restart after setup.

Full setup and verification for each client: https://archdraw.hiabhee.online/docs/connect-agents

## Working with codebases

When the user asks for a diagram of a repository, use the codebase context already available to you when permitted. Identify entry points, services, routes, jobs, data stores, external services, and important request or event paths. Do not claim that a relationship is verified unless supporting code, configuration, or documentation provides evidence.

ArchDraw's MCP tools do not read repositories themselves. If the user gives a GitHub URL, build the diagram from the code you can access, or point them to ArchDraw's Repo → Diagram page (https://archdraw.hiabhee.online/repo-diagram) for the hosted analysis.

## Workflow

1. Clarify the intended view: current state or proposed state; audience; and scope (whole system, service boundary, request flow, or change).
2. For repository-informed work, inspect accessible code and documentation before modelling. Prefer evidence over inference and call out uncertainty.
3. Produce Mermaid that expresses the architecture clearly. Use `graph LR` for most service maps and `graph TD` when a top-down flow is clearer. Use subgraphs for meaningful boundaries such as client, edge, services, data, and external systems.
4. Call `generate_diagram` with the Mermaid, the user's original request in `userPrompt`, and any explicit technologies in `techStack`. Mermaid is the preferred MCP input mode.
5. If generation reports validation or topology errors, correct the Mermaid and retry with the reported issue addressed. Stop and explain the failure if it cannot be resolved safely.
6. Use `validate_diagram` for a final check when the diagram will be shared or used for a decision. Use `fix_layout` only when the generated layout needs adjustment.
7. Share both returned links (see "Preview links") and summarize what the view shows, what evidence supports it, and any assumptions or gaps.

## Working sessions

`generate_diagram` and `apply_template` return a `workingSessionId`. Keep it and pass it on every later call about that diagram: `update_diagram`, `get_diagram_state`, `validate_diagram`, `save_checkpoint`, `load_checkpoint`, and `export_diagram`. The hosted server requires it; without it, those calls return an error. `fix_layout` does not use a session: pass it the nodes and edges to lay out. Start a new diagram with a new `generate_diagram` call instead of reusing another diagram's session.

## Preview links (always share them)

- `generate_diagram`, `apply_template`, and `update_diagram` return a preview link (`shareUrl`) and an edit link (`diagramUrl`) in the same response. No extra call is needed. **Always put both links in your reply**, near the top. In a terminal or IDE, the user cannot see the diagram without them.
- Links are unguessable, viewable by anyone who has them, and expire after 7 days. If the user asks to keep a diagram private, pass `publish: false`, then say plainly that no link was created.
- If the result contains `linkError` instead of links, tell the user the diagram was generated but could not be published, and include the reason.
- Never put secrets, credentials, or private hostnames in diagram labels. Anyone with the link can read them.

## Diagram quality

- Model a coherent story, not an inventory of boxes. Make the main flow legible first.
- Label edges with the important interaction when it clarifies the relationship; distinguish synchronous calls from asynchronous events where known.
- Group only genuine boundaries. Avoid decorative layers or groups that conceal the flow.
- Keep the scope appropriate to the audience. Create separate views instead of one unreadable all-in-one diagram.
- Preserve explicit technologies and names from the user or repository. Never invent infrastructure, services, or integrations.
- Use ArchDraw's semantic shapes when helpful: gateways/load balancers, people/clients, external systems, security components, and data stores should be visually distinct.

## Architecture changes

For a proposed refactor, migration, or feature, create a clearly labelled proposed-state view. Explain changed components, new dependencies, affected data or event paths, and assumptions that require human review. Do not present a proposal as the repository's current architecture.

## Useful MCP tools

- `read_me` — ArchDraw's reference guide (tiers, node types, edge types, layout rules). Call it before your first diagram in a session.
- `generate_diagram` — create a diagram from Mermaid (preferred) or structured nodes and edges.
- `update_diagram` — make targeted changes to the active diagram.
- `get_diagram_state` — read the current nodes and edges before editing.
- `validate_diagram` — check the current diagram for structural issues.
- `fix_layout` — lay out the diagram again with ArchDraw's Mermaid → Dagre pipeline.
- `save_checkpoint`, `load_checkpoint` — save and restore a named version before a risky change.
- `export_diagram` — export as JSON, PNG, or SVG.
- `list_node_types`, `list_templates`, `apply_template` — discover components and start from a template.

## Output contract

Treat the work as complete only after a tool result confirms the diagram was generated, and the reply includes both links (or states that the diagram is private, or reports the `linkError`). For repository-informed diagrams, state the evidence basis and any material assumptions. For changes, distinguish current state from proposed state. Do not claim an operation succeeded unless its tool result confirms it.
