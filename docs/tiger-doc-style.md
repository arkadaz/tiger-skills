# Tiger Doc Style (v6)

The house style for every artifact the kit writes. v6 is **compact markdown** — not HTML.

## Principles
- **Short beats complete.** Bullets and tables, not paragraphs. If a section has nothing, write `N/A — <one line>`, don't pad.
- **Frontmatter for machine fields.** `feature.md` carries YAML frontmatter; the line `tiger-status: approved` is the build gate.
- **No comments in code.** Generated code and the e2e keyword bodies carry no comments — names carry meaning.
- **Markdown, self-contained.** No HTML, no CSS, no CDN. A fenced ` ```mermaid ` block is allowed (GitHub renders it; it stays readable as text).
- **Update in place, every run.** `tiger/CODEBASE_MAP.md` and `tiger/business.md` are living docs — refresh, don't append duplicates.

## Artifact shapes
| File | Owner | Shape |
|---|---|---|
| `tiger/features/<id>/feature.md` | grill (via tiger-docs-feature) | frontmatter + Problem & JTBD / What we'll do / Why-Decisions / Business context (+ code glossary) / Acceptance criteria / Out of scope |
| `tiger/features/<id>/e2e_testcases.robot` | grill + e2e | Robot suite, priority-tagged, status in `*** Settings *** Metadata` |
| `tiger/CODEBASE_MAP.md` | architect / update-docs | Overview / System map / Modules / How it works (per workflow) / Business glossary / Recent changes |
| `tiger/business.md` | update-docs (tiger-docs-business) | cumulative catalog: feature → what/users/metric + code glossary |
| `tiger/release_docs.md` | update-docs (tiger-docs-release) | Keep-a-Changelog; LOW e2e defects under "Known issues" |

## Business context
Always record the **meaning of magic values** (e.g. `order.status 001 = pending`) in the feature's Business context and the global business glossary — so a reader knows what a code means without digging through code.
