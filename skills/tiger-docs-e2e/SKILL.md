---
name: tiger-docs-e2e
description: Focused writer that authors ONE feature's e2e_testcases.robot — the human-agreed CASES as a BROAD Robot Framework BDD suite (many boundary/typical/adversarial cases; ≥1 per acceptance criterion and per business rule), every case tagged exactly one priority:high|medium|low. Writes only the cases; the tiger-e2e gate writes the executable keyword implementations and may APPEND its own source:e2e cases (never editing grill's agreed cases). Invoke directly or load as one of grill's skills to write the e2e contract.
---

# Tiger Docs — E2E Cases Writer

Writes ONE artifact: `tiger/features/<id>/e2e_testcases.robot` — the agreed e2e CASES. Sits at the grill stage: grill loads this skill to capture what the human signed off; `tiger-e2e` implements the HOW later.

## When to use

- Grill loads it automatically to write cases the human agreed to during the interview.
- Standalone: "write the robot e2e cases for `<id>`" — draft or revise a suite from agreed inputs.

## Contract

**Owns ONE artifact:** `tiger/features/<id>/e2e_testcases.robot` (cases only).
**Never owns:** `e2e_keywords.resource` (e2e gate writes it), board, approvals, notes, code.

| Rule | Detail |
|---|---|
| BDD style | `*** Test Cases ***` entries use Given/When/Then keyword NAMES. `Settings` keeps `Resource    e2e_keywords.resource`. |
| Priority tag — MANDATORY | Every case carries exactly one `priority:high`, `priority:medium`, or `priority:low` in `[Tags]`. Happy-path ≥ `high`; adversarial/security ≥ `high`; boundary/typical default `medium`; cosmetic/optional default `low`. |
| Broad suite — MANDATORY | Author a GENEROUS suite, not "one of each": SEVERAL boundary (empty/zero/min/max/off-by-one), SEVERAL typical, SEVERAL adversarial (unicode, oversized, negative, duplicate, traversal, injection where input is untrusted) cases, PLUS ≥1 case per acceptance criterion and per business rule. A thin suite where every case hits the same path proves nothing — reject it. |
| Gate enforcement (v2) | `priority:high` or `priority:medium` failing = **blocks** gate. `priority:low` failing = **logged**, does not block. PASS = zero HIGH + zero MEDIUM, all tasks done. |
| e2e gate may APPEND | These agreed cases are grill's — the e2e gate must NOT edit or delete them. The gate MAY append NEW cases of its own, each tagged `[Tags] source:e2e`, so the agreed block stays distinguishable. You never tag yours `source:e2e`. |
| Data-driven outlines | Use `[Template]` + row table (Scenario Outline equivalent). One verdict per row in Robot's report. |
| Status token | In `*** Settings ***`: `Metadata    tiger-status    awaiting_review` (plus `Metadata    tiger-feature-id    <id>`) — NOT a `#` comment. Never flip it to `approved`; that is grill's act on the human's yes. |
| Concreteness | Cases must be concrete enough for the e2e gate to implement; do NOT write runnable keyword bodies. |

## Works with

grill (loads this skill, provides agreed cases) → **tiger-docs-e2e** (writes the broad case suite) → `tiger-e2e` gate (implements `e2e_keywords.resource`, runs + iterates by appending `source:e2e` cases, records `refs/notes/e2e`).

## Git interactions

- **Under grill:** write the file; grill's approval commit owns it. Do not commit.
- **Standalone:** `git add tiger/features/<id>/e2e_testcases.robot && git commit -m "docs(<id>): e2e cases"`. Nothing else.
- Never touch board, resource file, other artifacts, notes, or code.

## Standalone use

Invoke with: project dir, feature id, agreed cases (title/tags/Given/When/Then/test data/rows), today (`YYYY-MM-DD`). Writes a broad `e2e_testcases.robot` with the `Metadata    tiger-status    awaiting_review` token and stops. Report the path written.
