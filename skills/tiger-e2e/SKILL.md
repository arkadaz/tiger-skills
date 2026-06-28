---
name: tiger-e2e
description: End-to-end verification gate — the SINGLE quality gate of the v2 pipeline (no in-loop security/reviewer). AUTHORS the executable Robot Framework layer (e2e_keywords.resource — Playwright behind the scenes for UI cases, Process/OperatingSystem for the rest) for a feature's agreed e2e_testcases.robot cases, then ITERATES — runs the suite + every architect acceptance check as real OS processes, triages each defect by PRIORITY (HIGH/MEDIUM block; LOW logged), thinks of new uncovered scenarios and APPENDS them as new cases (tagged source:e2e), re-runs until no meaningful scenario remains, records a pass/changes/blocked verdict as a namespaced git note (refs/notes/e2e), and owns the board phase pointer during the loop. Use whenever the user says "run e2e", "execute the test cases", "run the robot suite", "verify this feature end-to-end", "run the acceptance checks", or when the pipeline reaches the e2e gate after every build wave is integrated.
context: fork
agent: tiger-skills:tiger-e2e
---

# Tiger E2E — End-to-End Verification Gate

The SINGLE quality gate of the v2 pipeline. After all build waves are integrated, it authors the executable Robot Framework keyword layer, then ITERATES: run the agreed suite + acceptance checks, triage by priority, append new cases for uncovered behavior, re-run until coverage is exhausted. Owns the board phase pointer during the loop.

Full procedure: agents/tiger-e2e.md — this skill is the contract + how to run it.

## When to use

- Pipeline: spawned by `tiger-workflow-dev` after the last integrated wave, before update-docs.
- Standalone: user says "run e2e / run the robot suite / verify this feature end-to-end / run acceptance checks".

No in-loop `tiger-security` / `tiger-reviewer` gates exist in v2 — those are standalone-only skills the human invokes on demand.

## Contract

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. A command you ran + exit code you observed = evidence. Prior rounds, code reading, and "should pass" are not evidence.

**Works on:** `feature/<id>` (base `dev`). Reads/writes the working tree; never commits onto `dev` or `main`.

**Owns / writes:**
- `tiger/features/<id>/e2e_keywords.resource` — the executable Robot Framework keyword implementations (Playwright/Browser library for UI; Process/OperatingSystem for CLI/API/file). Instantiate from `tiger/templates/e2e_keywords.resource` if absent. **Comment-free real bodies only** — no `#`/docstring narration; `Log`/`No Operation` bodies cannot reach PASS.
- **APPENDED cases** in `e2e_testcases.robot` — new scenarios you discover, each tagged `[Tags] source:e2e` + one `priority:high|medium|low`. You append; you never edit or delete grill's agreed cases.
- `tiger/features/<id>/evidence/` — Robot's `output.xml`, `report.html`, `log.html`, Playwright screenshots/traces.
- `refs/notes/e2e` — git note on the generator's code commit (namespaced; never collides with standalone `refs/notes/security` / `refs/notes/review`).
- `feature_list.json` phase pointer + `acceptance_criteria[].status` during the loop; `progress.md` round summary.

**Never writes:** grill's agreed cases (the original block — you append next to them, never rewrite them), code files, `status: passing`, `current_feature: null` (update-docs owns the passing close-out).

**What to execute (both lists, every item, every round):**
1. `robot --outputdir tiger/features/<id>/evidence tiger/features/<id>/e2e_testcases.robot`
2. Every `acceptance_criteria[]` check from `feature_list.json` as real OS processes.

**Iterate (append cases until coverage is exhausted):**
1. Author/extend `e2e_keywords.resource` (comment-free).
2. Run the suite + acceptance checks; triage by priority.
3. Think of NEW uncovered scenarios (boundary, typical, adversarial) and **append** them as new cases tagged `source:e2e` + a priority — then re-run.
4. Repeat while meaningful uncovered behavior remains (bounded by your own judgment / budget).

**Priority triage:**

| Priority | Lands here | Gate effect |
|---|---|---|
| HIGH | Failing `priority:high`/`critical`/`smoke` case; any failed acceptance check; data loss; core JTBD broken; confirmed abuse/vulnerability; build won't run | **Blocks** — must be zero to PASS |
| MEDIUM | Failing `priority:medium`/`regression` case; wrong result on non-critical path; missed spec edge | **Blocks** — must be zero to PASS |
| LOW | Failing `priority:low` case; cosmetic/minor UX; optional edge | **Logged only** — never blocks |

**Verdict grade table:**

| Grade | Condition | What happens next |
|---|---|---|
| `pass` | zero HIGH + zero MEDIUM; every non-LOW case/check green with fresh evidence; all tasks done | `phase: validate`; update-docs closes the board |
| `changes` | any HIGH or MEDIUM defect, or tasks remain | Priority-ordered fix list → architect re-plan; e2e re-runs on new commit |
| `blocked` | defect no retry can fix without human (spec contradiction, unrunnable case) | Loop stops for human |

**Machine token lines — END the report with these FOUR, in order, last. Emit nothing after them:**

```
TIGER_E2E: <PASS|CHANGES|BLOCKED>
E2E_BLOCKERS: high=<n> medium=<n> low=<n>
FEATURE_COMPLETE: <YES|NO>
TASKS_DONE: <doneCount>/<totalCount>
```

- `TIGER_E2E: PASS` only when `high=0` and `medium=0` with fresh evidence (LOW may be > 0).
- `FEATURE_COMPLETE: YES` only when grade is PASS and every task in `tasks[]` is done.
- `TASKS_DONE` are literal counts from `feature_list.json`; workflow uses them to detect no-progress rounds.
- Workflow fails closed to CHANGES when any token is absent or garbled.

**Board access — via `tiger/board.py` only:** ALWAYS read first (`python3 tiger/board.py current` / `get <id>`), then update only your own fields — `set-phase`, `set-ac <id> <ac> <status> --evidence …`, and `add-learning <id> <bucket> "…"` for each LOW issue; each patch preserves all other fields and fails closed on an invariant break. Never dump or hand-rewrite `feature_list.json`. Then commit:

**Board commit (mandatory — durability):**
```bash
git add feature_list.json progress.md tiger/features/<id>/e2e_testcases.robot && git commit -m "chore(board): <id> phase -> <phase> (e2e: <grade>)"
```

**Git note format:**
```bash
git notes --ref=e2e add -f -m "grade: <pass|changes|blocked>
blockers: high=<n> medium=<n> low=<n>
fixes (priority-ordered):
- [HIGH]   <case/check id — file:line — what diverged — the fix>
- [MEDIUM] <…>
- [LOW]    <logged, non-blocking>" <generator-commit>
```

## Works with

grill (authors the agreed `e2e_testcases.robot` cases + priority tags) → architect (authors acceptance checks; re-plans on CHANGES) → code-generator (builds feature) → **e2e** (appends cases, iterates) → update-docs (passing close-out, known-issues list from LOW defects).

## Git interactions

- **Reads:** `git log -1`, `feature_list.json`, `progress.md`, `tiger/features/<id>/e2e_testcases.robot`, `tiger/features/<id>/feature.md`, `git notes --ref=e2e show`.
- **Writes:** `e2e_keywords.resource`, appended `source:e2e` cases in `e2e_testcases.robot`, `tiger/features/<id>/evidence/*`, `refs/notes/e2e` (on generator's code commit, `-f` overwrites on re-run), board commit (`feature_list.json` + `progress.md` + the appended cases).
- **Never:** `git push`, branch ops, commits onto `dev`/`main`, code/test edits, edits to grill's agreed cases, notes in any other ref, `status: passing`, null `current_feature`.

## Standalone use

Point at any `e2e_testcases.robot` and optionally a `feature_list.json`; supply project dir + today (YYYY-MM-DD). Full gate function applies (identify → run → read → verify → iterate → record). Server-lifecycle discipline applies (start → wait-ready → run → always tear down).

Outside the workflow: no board writes (`feature_list.json` phase unchanged, no board commit). Write a git note only on a commit the user explicitly names. Still ends with the four token lines.
