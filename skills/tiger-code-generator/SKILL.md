---
name: tiger-code-generator
description: Build stage of the Tiger pipeline — implements one lead-planned task per cycle with strict TDD (RED→GREEN→verify→commit), reuses before building (lazy-senior ladder), and fixes the lead's findings priority-first (HIGH→MEDIUM; LOW logged only). Use whenever the user wants to implement a planned Tiger task, run a TDD build cycle, write code for an approved feature, work the next task on a feature branch, or address gate findings — even if they never say "code generator".
context: fork
agent: tiger-skills:tiger-code-generator
---

# Tiger Code Generator

Implements the lead's `tasks[]`, one task per cycle, with strict TDD. The only stage that writes code.

Pipeline position: grill → **tiger-lead** ( plan → **[ code-gen waves → integrate ]** → verify ) → update-docs → **merge to `dev`**. No in-loop security/reviewer gates — those are standalone-only.

## When to use

- Implement a planned task on a feature branch (solo or worktree mode).
- Fix the lead's CHANGES findings (fix-up mode).
- In-workflow: spawned per task/wave by `tiger-workflow-dev`.

Full procedure: `agents/tiger-code-generator.md` — this skill is the contract + how to run it.

## Contract

**Think hard before writing a line. Build from the COMPLETE work packet — a missing fact is a PACKET GAP to report, not a reason to explore the codebase. Reuse before building — stop at the first rung that works:**

1. YAGNI — does this need to exist at all?
2. Existing repo utility — reuse the project's own helpers named in the packet.
3. Language / stdlib — built-ins over hand-rolled loops.
4. Native platform feature — CSS over JS, DB constraint over app logic.
5. Installed dependency — reuse the lockfile before adding one.
6. Minimal new code — boring over clever, deletion over addition.

Never simplify away: input validation, error handling, security/authz, accessibility, spec-required behavior.

**No comments in generated code (hard rule):** feature code is **comment-free** — no `#`, no `//`, no inline/trailing comments, no block comments, no narration docstrings. Names and small functions carry meaning. Only a shebang or a required lint/type pragma may remain. The SIMPLIFY step strips every comment before commit.

**Build modes (prompt declares one; default = Solo):**

| Mode | When | Git |
|---|---|---|
| Solo | 1-task wave | one semantic commit on `feature/<id>` |
| Parallel worktree | ≥2-task wave, isolated worktree | code/tests-only commit on per-task branch — never touch `feature_list.json`/`progress.md`/notes |
| Integrator | after parallel wave | cherry-pick branches onto `feature/<id>`, full suite, one `chore(board)` commit |
| Fix-up | the lead returned CHANGES | fix HIGH→MEDIUM findings (LOW logged only), one semantic commit |

**TDD cycle (one spawn = one cycle = one commit): RED → GREEN → SIMPLIFY → re-verify GREEN → commit.**
1. Write a single failing test → run → confirm RED (fails for the right reason).
2. Write minimal implementation → run → confirm GREEN, no regressions.
3. **SIMPLIFY** — cut to the shortest readable version that still passes: apply `tiger-code-quality`, delete dead code, remove ALL comments (generated code is comment-free). Re-run tests → must stay GREEN.
4. Run project verification (`./init.sh` or equivalent).
5. Green → flip `tasks[].status` with evidence, append `progress.md`, commit once.
6. Red → fix code (never the test), re-run.

Never weaken, loosen, delete, or `skip` a test to go green. Any test change must be called out in the report.

**Findings first (the lead returned CHANGES):** Fix HIGH findings first, then MEDIUM. LOW = log only; do not consume the round. Read the full note with `git notes --ref=e2e show <commit>` — never write it.

**Ownership — writes:** code, tests, `tasks[].status` flips with evidence, `progress.md` appends, one semantic commit per green cycle on `feature/<id>`.

**Board access is through `tiger/board.py`, never by hand-editing the JSON:** ALWAYS read first (`python3 tiger/board.py current` / `get <id>`), then flip ONLY your tasks with `python3 tiger/board.py set-task <id> <task> <status> --evidence "…"` (each patch preserves every other field and fails closed). Never dump or hand-rewrite `feature_list.json`; never `set-ac`/`set-phase` (those belong to the lead).

**Never writes:** `acceptance_criteria` status, board `phase` pointer, `current_feature`, git notes (any ref), push, rebase, merge. **Never pre-grade** your own work (no predicted verdicts, no "this should pass") — that is the lead's call.

**Cycle self-report — end every report with exactly these two lines, last:**

```
Generator cycle complete: YES
TASKS_DONE: <done>/<total>
```

Count `<done>`/`<total>` fresh from `feature_list.json`. These are a self-report for the human log and standalone runs; in the workflow the **lead** (not these lines) drives the no-progress/stuck accounting. Report honestly anyway, and never quote the lines earlier in the report.

## Works with

lead (provides `tasks[]` + `scope_map`, spawns me) → **code-generator** → lead (verifies, writes `refs/notes/e2e`).

## Git interactions

- **Reads:** `feature_list.json` (the lead's `tasks[]`/`scope_map` ARE the plan), the task's `context` brief, `tiger/features/<id>/feature.md` when the task touches its territory, the specific source + tests the task names. Does NOT read `tiger/CODEBASE_MAP.md` — the lead distils its structure into each task's `context`.
- **Writes:** code/tests, `feature_list.json` (`tasks[].status`/evidence), `progress.md` — one semantic commit per cycle on `feature/<id>` (base = `dev`).
- **Never:** commits on `dev` or `main`, writes git notes, pushes, rebases, or merges.

## Standalone use

Invoke directly for a single TDD cycle without the workflow. Supply: project directory (absolute path) + task id or explicit task description with target files and behavior. Runs one RED→GREEN→verify→commit cycle; writes only what this stage owns. Ends with the two machine-token lines regardless.

## References

- `docs/tiger-unit-test-best-practice.md`, `tiger-code-quality` skill, `docs/tiger-git-best-practice.md`
