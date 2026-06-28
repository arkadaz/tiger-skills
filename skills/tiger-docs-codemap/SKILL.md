---
name: tiger-docs-codemap
description: Focused writer that refreshes tiger/CODEBASE_MAP.md — a compact MARKDOWN structural map with Overview, an OPTIONAL fenced mermaid system map (no CDN), a Modules table, a per-workflow "How it works" walkthrough, a Business-glossary/code-values table, and an appended Recent-changes row. Bootstraps from tiger/templates/CODEBASE_MAP.md when missing. Invoke directly ("refresh the codemap") or loaded by tiger-update-docs at close-out.
---

# Tiger Docs — Codebase Map Writer

Owns ONE artifact: `tiger/CODEBASE_MAP.md` — the structural map the architect reads on the next feature (the architect is its sole reader; code generators never read it). Plain markdown, compact, refreshed every run. No agent; no board writes; no merge.

## When to use

- Standalone: "refresh the codemap", "regenerate the structural map".
- Loaded by `tiger-update-docs` at close-out (do NOT invoke separately then).

## Contract

**Inputs:** project dir (absolute), feature id, today (`YYYY-MM-DD`), real diff (`git diff dev...HEAD --stat` + touched files).

**Writes** `tiger/CODEBASE_MAP.md` (bootstrap from `tiger/templates/CODEBASE_MAP.md` if missing). Header line: `# Codebase Map — <project>   (updated: <today>, last feature: <id>)`. Sections:

| Section | Detail |
|---|---|
| `## Overview` | 2-4 lines: what the system is. |
| `## System map` | OPTIONAL fenced ` ```mermaid ` flowchart, C4-Container altitude, `subgraph` boundaries, STABLE node ids. GitHub renders it; stays plain-text readable. No CDN, no HTML. |
| `## Modules` | Table: `Module \| Path \| Responsibility \| Key entry points (file:symbol)`. |
| `## How it works (per workflow)` | For each main flow/use-case, a SHORT numbered walkthrough of what the code does, step by step. |
| `## Business glossary / code values` | Compact table mapping magic values → meaning (e.g. `order.status 001 = pending`). |
| `## Recent changes` | Table; append one row: `<id> \| <today> \| <what moved>`. |

**Stable node ids:** keep ids unchanged across refreshes — add/rename only when a module truly appears/disappears. Churned ids = failed refresh.

**Never writes:** `feature_list.json`, `business.md`, `release_docs.md`, `README.md`, code, git notes; never closes the board, rebases, merges.

## Works with

`tiger-update-docs` loads this skill → refreshes the map → included in the single close-out commit. Architect reads `tiger/CODEBASE_MAP.md` as planning input on each new feature.

## Git interactions

- **Standalone:** `git add tiger/CODEBASE_MAP.md && git commit -m "docs(tiger): <id> codemap refresh"`.
- **Loaded by tiger-update-docs:** do NOT commit separately — update-docs makes the single close-out commit.

## Standalone use

Invoke: "refresh the codemap". With no feature id, refresh from current repo state (`git diff dev...HEAD`). Writes and commits only `tiger/CODEBASE_MAP.md`; reports what moved.
