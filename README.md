# archdraw-skill

Give your coding agent an architecture workspace. This repository packages ArchDraw as an installable skill: it helps an MCP-capable coding agent turn a system description or accessible codebase context into an editable, shareable architecture diagram, refine an existing view, and document proposed architecture changes.

ArchDraw is designed for system context, service boundaries, request and event flows, data stores, external dependencies, and change plans — not generic flowcharts.

## Quick setup

Once `archdraw-agent` is published to npm, install the skill and connect the MCP server in one command:

```bash
npx archdraw-agent setup
```

The installer detects Codex, Claude Code, and OpenCode on your machine. To target one agent, use `--agent codex`, `--agent claude`, or `--agent opencode`. Add `--dry-run` to preview changes; use `--force` only when you want to replace an installed ArchDraw skill.

## Prerequisites

- Node.js 18+ (required for the MCP server)
- An MCP-capable coding agent, such as Codex, Claude Code, Claude Desktop, or OpenCode

This skill requires the ArchDraw MCP server to be connected in your coding agent. The MCP server is distributed via npm as `@hiabhee/archdraw-mcp-server` and talks to the hosted ArchDraw frontend at `https://archdraw.hiabhee.online`.

> **Note:** Installing the skill only adds agent instructions. The ArchDraw MCP server must be connected separately — the skill will not function without it.

## Install

### 1. Install the skill

**Codex**

Copy the complete `skills/archdraw-diagram` directory into `~/.codex/skills/archdraw-diagram/`.

**Claude Code**

```bash
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
```

**OpenCode**

Copy the complete `skills/archdraw-diagram` directory into `.opencode/skills/archdraw-diagram/` for one project, or `~/.config/opencode/skills/archdraw-diagram/` for personal use. OpenCode also discovers Claude-compatible skill directories.

### 2. Connect the ArchDraw MCP server (local, via npm)

**Codex:**

```bash
codex mcp add archdraw -- npx -y @hiabhee/archdraw-mcp-server
```

**Claude Code:**

```bash
claude mcp add archdraw -- npx -y @hiabhee/archdraw-mcp-server
# The server connects to https://archdraw.hiabhee.online by default.
# To use a self-hosted frontend, set API_BASE_URL:
# claude mcp add archdraw --env API_BASE_URL=https://your-frontend.com -- npx -y @hiabhee/archdraw-mcp-server
```

**Claude Desktop:** Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "@hiabhee/archdraw-mcp-server"],
      "env": {
        "API_BASE_URL": "https://archdraw.hiabhee.online"
      }
    }
  }
}
```

**OpenCode:** Add ArchDraw to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "archdraw": {
        "type": "local",
        "command": ["npx", "-y", "@hiabhee/archdraw-mcp-server"]
      }
    }
  }
}
```

For other MCP-capable agents, add the same local stdio command using that client’s MCP configuration format. Restart the agent after adding the server.

### Verify

```bash
codex mcp list      # Codex: should show 'archdraw' as connected
claude mcp list     # Claude Code: should show 'archdraw' as connected
opencode mcp list   # OpenCode: should show 'archdraw' as connected
```

Ask your agent whether the ArchDraw MCP tools are available. It should list `generate_diagram`, `validate_diagram`, and the other ArchDraw actions.

## Usage

After installing the skill and connecting the MCP server, try prompts like:

- `Use the codebase context to create an architecture map of the checkout flow.`
- `Show me a microservices architecture for an e-commerce app with an API gateway, auth service, and Postgres`
- `Refine this diagram to add a caching layer between the API gateway and the database`
- `Create a proposed-state diagram for splitting the payment module, and identify the affected dependencies.`

The agent will clarify the intended view, model the architecture in Mermaid, and use the ArchDraw MCP to generate an editable diagram. Mermaid uses ArchDraw's production Mermaid-to-React-Flow/Dagre pipeline. When using repository context, the agent should distinguish code-backed evidence from assumptions.

## Coding-agent setup guide

For the complete guide to using ArchDraw with Codex, Claude Code, and OpenCode—including MCP configuration, skill installation, and repository-informed prompts—read [Give your coding agent an architecture workspace with ArchDraw](https://archdraw.hiabhee.online/blogs/archdraw-claude-code-opencode). The same ArchDraw MCP server can be configured in other compatible coding agents.

## Troubleshooting

- **MCP not connected:** Ensure `npx -y @hiabhee/archdraw-mcp-server` works locally (`echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | npx -y @hiabhee/archdraw-mcp-server` should return server info).
- **Diagram URL 404:** Check `API_BASE_URL` points to a running frontend (`https://archdraw.hiabhee.online` is the hosted one).
- **Skill not triggering:** Try explicit phrasing: "using archdraw-diagram, diagram this repo..."

## License

MIT — see [LICENSE](./LICENSE).
