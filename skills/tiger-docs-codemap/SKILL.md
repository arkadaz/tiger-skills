---
name: tiger-docs-codemap
description: Focused writer that refreshes tiger/codemap.html — ONE mermaid flowchart at C4 Container altitude with stable node ids, an updated Module Index table, and an appended Recent-Changes row. Bootstraps from tiger/templates/codemap.html when missing. Invoke directly ("refresh the codemap") or loaded by tiger-update-docs at close-out.
---

# Tiger Docs — Codemap Writer

Owns ONE artifact: `tiger/codemap.html` — the structural map the architect and code generator read on the next feature. No agent; no board writes; no MR.

## When to use

- Standalone: "refresh the codemap", "regenerate the structural map".
- Loaded by `tiger-update-docs` at close-out (do NOT invoke separately then).

## Contract

**Inputs:** project dir (absolute), feature id, today (`YYYY-MM-DD`), real diff (`git diff main...HEAD --stat` + touched files).

**Writes** `tiger/codemap.html` (bootstrap from `tiger/templates/codemap.html` if missing):

| Rule | Detail |
|------|--------|
| Diagram | ONE `flowchart TD/LR` at C4 Container altitude, `subgraph` boundaries. NOT `C4` syntax, NOT `architecture-beta`. |
| Nodes | `name + technology + one-line purpose` — e.g. `API["API Server<br/>(FastAPI)<br/>auth + routing"]`; edges labeled with call semantics. |
| Stable ids | Keep node ids unchanged across refreshes — add/rename only when a module truly appears/disappears. Churned ids = failed refresh. |
| Module Index | Update any row where a module was added or its responsibility moved. |
| Recent Changes | Append one row: `<feature-id> \| <today> \| <what moved in the map>`. |
| CDN | Keep the single mermaid `<script>` (the one permitted CDN call). Follow `docs/tiger-doc-style.md` otherwise. |

**Never writes:** `feature_list.json`, `business.html`, `release_docs.html`, `README.md`, code, git notes; never closes the board, rebases, pushes, or opens an MR.

## Works with

`tiger-update-docs` loads this skill → refreshes codemap → included in the single close-out commit. Architect reads `tiger/codemap.html` as planning input on each new feature.

## Git interactions

- **Standalone:** `git add tiger/codemap.html && git commit -m "docs(tiger): <id> codemap refresh"`.
- **Loaded by tiger-update-docs:** do NOT commit separately — update-docs makes the single close-out commit that includes this file.

## Standalone use

Invoke: "refresh the codemap" or "regenerate the structural map". With no feature id, refreshes from current repo state (`git diff` against `main`). Writes and commits only `tiger/codemap.html`; reports what moved in the map.
