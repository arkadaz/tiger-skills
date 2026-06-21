---
name: tiger-docs-e2e
description: Focused writer that authors ONE feature's e2e_testcases.robot — the human-agreed CASES in Robot Framework BDD style (Given/When/Then + [Tags] + [Template] data-driven rows). Writes only the cases; tiger-e2e gate writes the executable keyword implementations. Invoke directly or load as one of grill's skills to write the e2e contract.
---

# Tiger Docs — E2E Cases Writer

Writes ONE artifact: `tiger/features/<id>/e2e_testcases.robot` — the agreed e2e CASES. Sits at the grill stage: grill loads this skill to capture what the human signed off; `tiger-e2e` implements the HOW later.

## When to use

- Grill loads it automatically to write cases the human agreed to during the interview.
- Standalone: "write the robot e2e cases for `<id>`" — draft or revise a suite from agreed inputs.

## Contract

**Owns:** `tiger/features/<id>/e2e_testcases.robot` (cases only).  
**Never owns:** `e2e_keywords.resource` (e2e gate writes it), board, approvals, notes, code.

| Rule | Detail |
|---|---|
| BDD style | `*** Test Cases ***` entries use Given/When/Then keyword NAMES. `Settings` keeps `Resource    e2e_keywords.resource`. |
| Priority tag — MANDATORY | Every case carries exactly one `priority:high`, `priority:medium`, or `priority:low` in `[Tags]`. Happy-path ≥ `high`; adversarial/security ≥ `high`; boundary/typical default `medium`; cosmetic/optional default `low`. |
| Gate enforcement (v2) | `priority:high` or `priority:medium` failing = **blocks** gate. `priority:low` failing = **logged**, does not block. PASS = zero HIGH + zero MEDIUM, all tasks done. |
| Data-driven outlines | Use `[Template]` + row table (Scenario Outline equivalent). One verdict per row in Robot's report. |
| Non-degenerate inputs — MANDATORY | Suite MUST span: at least one boundary case (empty/zero/min/max/off-by-one), one typical case, one adversarial case (unicode, oversized, negative, duplicate, injection where input is untrusted). A suite where all cases hit the same path proves nothing — reject it. |
| Status marker | Keep `# tiger-status: awaiting_review` header. Never flip it to `approved`. |
| Concreteness | Cases must be concrete enough for the e2e gate to implement; do NOT write runnable keyword bodies. |

## Works with

grill (loads this skill, provides agreed cases) → **tiger-docs-e2e** (writes cases) → `tiger-e2e` gate (implements `e2e_keywords.resource`, runs suite, records `refs/notes/e2e`).

## Git interactions

- **Under grill:** write the file; grill's approval commit owns it. Do not commit.
- **Standalone:** `git add tiger/features/<id>/e2e_testcases.robot && git commit -m "docs(<id>): e2e cases"`. Nothing else.
- Never touch board, resource file, other artifacts, notes, or code.

## Standalone use

Invoke with: project dir, feature id, agreed cases (title/tags/Given/When/Then/test data/rows), today (`YYYY-MM-DD`). Writes `e2e_testcases.robot` at `awaiting_review` and stops. Report the path written.
