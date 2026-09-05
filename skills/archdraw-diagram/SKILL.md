---
name: archdraw-diagram
description: Generate, validate, and refine software architecture diagrams using ArchDraw's AI pipeline. Trigger when the user asks to create an architecture diagram, visualize a system's structure, turn a GitHub repo into a diagram, or refine/critique an existing architecture diagram. Requires the ArchDraw MCP server to be connected.
---

<!-- TODO: confirm exact MCP tool names from arc-draw/mcp -->

# ArchDraw Diagram

## When to use this skill

Use this skill when the user asks to:

- Generate a software/system architecture diagram from a text description
- Visualize a GitHub repository as an architecture diagram
- Refine, critique, or edit an existing architecture diagram

Do NOT use this skill for generic flowcharts, UI mockups, wireframes, or other non-architectural diagrams. This skill is scoped exclusively to software and system architecture.

## Prerequisite

This skill requires the ArchDraw MCP server to be connected in the user's Claude client. Before proceeding, verify that the ArchDraw MCP tools are available. If they are not available, tell the user that the ArchDraw MCP server must be connected and do not attempt to generate the diagram through alternative means.

## Workflow

When the skill is triggered, follow these pipeline stages in order by calling the ArchDraw MCP tools:

1. **Intent detection** — Clarify the user's intent. Determine whether they want a new diagram from a description, a diagram generated from a GitHub repository, or edits to an existing diagram. Ask for clarification if the intent is ambiguous.

2. **AST-based extraction (repo path only)** — If the request is to diagram a GitHub repo, run AST-based extraction on the repository first to derive the system structure before proceeding to generation.

3. **Mermaid generation** — Generate the Mermaid diagram source from the resolved intent and/or extracted repository structure.

4. **AST validation with self-repair** — Validate the generated Mermaid via AST parsing. On failure, self-repair and retry. Retry up to 16 times before giving up. If all retries are exhausted, report the failure to the user (see Failure handling).

5. **ELK layout** — Apply ELK layout to compute node positions.

6. **React Flow conversion** — Convert the laid-out diagram to React Flow format.

7. **Quality scoring** — Score the diagram for quality. The diagram must exceed the quality threshold to be considered done.

8. **storyGuard check** — Run the storyGuard check to verify the diagram meets narrative/coherence requirements.

9. **Semantic layer grouping** — Group nodes into the 4-tier node architecture (semantic layers).

Execute each stage sequentially. Do not skip stages or reorder them.

## Failure handling

- If AST validation retries are exhausted (16 retries), stop and report to the user that validation failed at the AST validation stage. Include the last error if available. Do not return a broken or unvalidated diagram.
- If storyGuard rejects the diagram, stop and report to the user that the diagram was rejected at the storyGuard stage, with the reason if available. Do not silently return the rejected diagram.
- For any other stage failure, report the specific stage that failed and the error to the user rather than silently returning a broken diagram.

## Output contract

A diagram is considered done only when all of the following hold:

- It passes AST validation
- Its quality score is above threshold
- Semantic layers are grouped into the 4-tier node architecture

If asked to describe or style the output, use the ArchDraw design system: monochrome palette with DodgerBlue (#1E90FF / #2B7FD9) as the sole accent color.

## Examples

**Example 1 — Repo to diagram**

> User: "Diagram this GitHub repo: https://github.com/org/repo"

→ Run the repo-to-diagram path: AST-based extraction from the repo, then Mermaid generation, then validation, layout, conversion, quality scoring, storyGuard, and semantic layer grouping.

**Example 2 — Description to diagram**

> User: "Show me a microservices architecture for an e-commerce app"

→ Run the description path: treat the description as the intent, generate Mermaid, then follow the full validation and layout pipeline (steps 4–9).

**Example 3 — Refine existing diagram**

> User: "Refine this diagram to add a caching layer between the API gateway and the database"

→ Treat as an edit to an existing diagram: resolve intent as an edit, regenerate/update Mermaid accordingly, then re-run validation, layout, conversion, quality scoring, storyGuard, and semantic layer grouping.
