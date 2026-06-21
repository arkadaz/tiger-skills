---
name: tiger-e2e
description: End-to-end verification gate — the SINGLE quality gate of the v2 pipeline (no in-loop security/reviewer) that AUTHORS the executable Robot Framework layer (e2e_keywords.resource — Playwright behind the scenes for UI cases, Process/OperatingSystem for the rest) for a feature's agreed e2e_testcases.robot cases, then EXECUTES the suite with `robot` plus every architect acceptance check as real OS processes, TRIAGES every defect by PRIORITY (HIGH/MEDIUM block; LOW logged), records a pass/changes/blocked verdict as a namespaced git note (refs/notes/e2e), and owns the board phase pointer during the loop. Use whenever the user says "run e2e", "execute the test cases", "run the robot suite", "verify this feature end-to-end", "run the acceptance checks", or when the pipeline reaches the e2e gate after every build wave is integrated.
context: fork
agent: tiger-development-kit:tiger-e2e
---

# TIGER E2E — End-to-End Verification Gate

The SINGLE quality gate of the v2 pipeline. Runs ONCE after all build waves are integrated; authors the executable Robot Framework keyword layer, executes the agreed suite + acceptance checks, triages defects by priority, and owns the board phase pointer during the loop.

Full procedure: agents/tiger-e2e.md — this skill is the contract + how to run it.

## When to use

- Pipeline: spawned by `tiger-workflow-dev` after the last integrated wave, before update-docs.
- Standalone: user says "run e2e / run the robot suite / verify this feature end-to-end / run acceptance checks".

No in-loop `tiger-security` / `tiger-reviewer` gates exist in v2 — those are standalone-only skills the human invokes on demand.

## Contract

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. A command you ran + exit code you observed = evidence. Prior rounds, code reading, and "should pass" are not evidence.

**Owns / writes:**
- `tiger/features/<id>/e2e_keywords.resource` — the executable Robot Framework keyword implementations (Playwright/Browser library for UI; Process/OperatingSystem for CLI/API/file). Instantiate from `tiger/templates/e2e_keywords.resource` if absent. Real bodies only — `Log`/`No Operation` bodies cannot reach PASS.
- `tiger/features/<id>/evidence/` — Robot's `output.xml`, `report.html`, `log.html`, Playwright screenshots/traces.
- `refs/notes/e2e` — git note on the generator's code commit (namespaced; never collides with standalone `refs/notes/security` / `refs/notes/review`).
- `feature_list.json` phase pointer + `acceptance_criteria[].status` during the loop; `progress.md` round summary.

**Never writes:** `e2e_testcases.robot` (grill's contract — never edited by a later stage), code files, `status: passing`, `current_feature: null` (update-docs owns the passing close-out).

**What to execute (both lists, every item):**
1. `robot --outputdir tiger/features/<id>/evidence tiger/features/<id>/e2e_testcases.robot`
2. Every `acceptance_criteria[]` check from `feature_list.json` as real OS processes.

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
| `changes` | any HIGH or MEDIUM defect, or tasks remain | Priority-ordered fix list → generator; e2e re-runs on new commit |
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

**Board commit (mandatory — durability):**
```bash
git add feature_list.json progress.md && git commit -m "chore(board): <id> phase -> <phase> (e2e: <grade>)"
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

grill (authors `e2e_testcases.robot` cases + priority tags) → architect (authors acceptance checks) → code-generator (builds feature) → **e2e** → update-docs (passing close-out, known-issues list from LOW defects).

## Git interactions

- **Reads:** `git log -1`, `feature_list.json`, `progress.md`, `tiger/features/<id>/e2e_testcases.robot`, spec artifacts, `git notes --ref=e2e show`.
- **Writes:** `e2e_keywords.resource`, `tiger/features/<id>/evidence/*`, `refs/notes/e2e` (on generator's code commit, `-f` overwrites on re-run), board commit (`feature_list.json` + `progress.md`).
- **Never:** `git push`, branch ops, code/test edits, edits to `e2e_testcases.robot`, notes in any other ref, `status: passing`, null `current_feature`.

## Standalone use

Point at any `e2e_testcases.robot` and optionally a `feature_list.json`; supply project dir + today (YYYY-MM-DD). Full gate function applies (identify → run → read → verify → record). Server-lifecycle discipline applies (start → wait-ready → run → always tear down).

Outside the workflow: no board writes (`feature_list.json` phase unchanged, no board commit). Write a git note only on a commit the user explicitly names. Still ends with the four token lines.

## References

- Iron Law + IDENTIFY→RUN→READ→VERIFY→THEN: https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md
- Server-lifecycle discipline: https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md
- Robot Framework User Guide (exit code, output.xml): https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html
- robotframework-browser (Playwright): https://robotframework-browser.org/
