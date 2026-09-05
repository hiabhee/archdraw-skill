# archdraw-skill

Generates software architecture diagrams via ArchDraw's AI pipeline. This repository packages ArchDraw as an installable Claude skill — once installed, Claude can create architecture diagrams from a text description or a GitHub repository, and refine existing diagrams through ArchDraw's validated pipeline (Mermaid generation, AST validation with self-repair, ELK layout, React Flow conversion, quality scoring, storyGuard checks, and 4-tier semantic layer grouping).

## Prerequisites

This skill requires the ArchDraw MCP server to be connected in your Claude client. See setup instructions here: `<ARCHDRAW_MCP_SETUP_URL>`

> **Note:** Installing the skill only adds the skill instructions to Claude. The ArchDraw MCP server must be connected separately — the skill will not function without it.

## Install

```bash
npx skills add <github-username>/archdraw-skill --skill archdraw-diagram -g -a claude-code
```

Replace `<github-username>` with the GitHub username or org that hosts this repository.

## Usage

After installing the skill and connecting the ArchDraw MCP server, try prompts like:

- `Diagram this GitHub repo: https://github.com/org/repo`
- `Show me a microservices architecture for an e-commerce app with an API gateway, auth service, and Postgres`

Claude will detect the intent and run the appropriate ArchDraw pipeline path.

## License

MIT — see [LICENSE](./LICENSE).
