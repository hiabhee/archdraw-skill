# archdraw-skill

Generates software architecture diagrams via ArchDraw's AI pipeline. This repository packages ArchDraw as an installable Claude skill — once installed, Claude can create architecture diagrams from a text description or a GitHub repository, and refine existing diagrams through ArchDraw's validated pipeline (Mermaid generation, AST validation with self-repair, ELK layout, React Flow conversion, quality scoring, storyGuard checks, and 4-tier semantic layer grouping).

## Prerequisites

- Node.js 18+ (required for the MCP server)
- Claude Code or Claude Desktop

This skill requires the ArchDraw MCP server to be connected in your Claude client. The MCP server is distributed via npm as `archdraw-mcp-server` and talks to the hosted ArchDraw frontend at `https://arch-draw.vercel.app`.

> **Note:** Installing the skill only adds the skill instructions to Claude. The ArchDraw MCP server must be connected separately — the skill will not function without it.

## Install

### 1. Install the skill

```bash
npx skills add hiabhee/archdraw-skill --skill archdraw-diagram -g -a claude-code
```

### 2. Connect the ArchDraw MCP server (local, via npm)

**Claude Code (recommended):**

```bash
claude mcp add archdraw -- npx -y archdraw-mcp-server
# The server connects to https://arch-draw.vercel.app by default.
# To use a self-hosted frontend, set API_BASE_URL:
# claude mcp add archdraw --env API_BASE_URL=https://your-frontend.com -- npx -y archdraw-mcp-server
```

**Claude Desktop:** Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archdraw": {
      "command": "npx",
      "args": ["-y", "archdraw-mcp-server"],
      "env": {
        "API_BASE_URL": "https://arch-draw.vercel.app"
      }
    }
  }
}
```

Restart Claude after adding the MCP server.

### Verify

```bash
claude mcp list           # should show 'archdraw' as connected
npx skills list           # should show 'archdraw-diagram'
```

In Claude, you can also ask: "Do you have the ArchDraw MCP tools available?" — it should list `generate_diagram`, `validate_diagram`, etc.

## Usage

After installing the skill and connecting the MCP server, try prompts like:

- `Diagram this GitHub repo: https://github.com/org/repo`
- `Show me a microservices architecture for an e-commerce app with an API gateway, auth service, and Postgres`
- `Refine this diagram to add a caching layer between the API gateway and the database`

Claude will detect the intent (new from description vs. from repo vs. edit) and run the ArchDraw pipeline.

## Troubleshooting

- **MCP not connected:** Ensure `npx -y archdraw-mcp-server` works locally (`echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | npx -y archdraw-mcp-server` should return server info).
- **Diagram URL 404:** Check `API_BASE_URL` points to a running frontend (`https://arch-draw.vercel.app` is the hosted one).
- **Skill not triggering:** Try explicit phrasing: "using archdraw-diagram, diagram this repo..."

## License

MIT — see [LICENSE](./LICENSE).
