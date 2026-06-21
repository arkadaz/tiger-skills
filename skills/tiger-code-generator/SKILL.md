---
name: tiger-code-generator
description: Build stage of the Tiger pipeline — implements one architect-planned task per cycle with strict TDD (RED→GREEN→verify→commit), reuses before building (lazy-senior ladder), and fixes e2e gate findings priority-first (HIGH→MEDIUM; LOW logged only). Use whenever the user wants to implement a planned Tiger task, run a TDD build cycle, write code for an approved feature, work the next task on a feature branch, or address gate findings — even if they never say "code generator".
context: fork
agent: tiger-skills:tiger-code-generator
---

# Tiger Code Generator

Implements the Architect's `tasks[]`, one task per cycle, with strict TDD. The only stage that writes code.

Pipeline position: grill → architect → **[ code-gen waves → integrate ]** → **e2e** → update-docs → MR. No in-loop security/reviewer gates in v2 — those are standalone-only.

## When to use

- Implement a planned task on a feature branch (solo or worktree mode).
- Fix e2e CHANGES findings (fix-up mode).
- In-workflow: spawned per task/wave by `tiger-workflow-dev`.

Full procedure: `agents/tiger-code-generator.md` — this skill is the contract + how to run it.

## Contract

**Think hard before writing a line. Reuse before building — stop at the first rung that works:**

1. YAGNI — does this need to exist at all?
2. Existing repo utility — `grep`/`Glob` first; reuse the project's own helpers.
3. Language / stdlib — built-ins over hand-rolled loops.
4. Native platform feature — CSS over JS, DB constraint over app logic.
5. Installed dependency — reuse the lockfile before adding one.
6. Minimal new code — boring over clever, deletion over addition.

Never simplify away: input validation, error handling, security/authz, accessibility, spec-required behavior.

**Build modes (prompt declares one; default = Solo):**

| Mode | When | Git |
|---|---|---|
| Solo | 1-task wave | one semantic commit on `feature/<id>` |
| Parallel worktree | ≥2-task wave, isolated worktree | code/tests-only commit on per-task branch — never touch `feature_list.json`/`progress.md`/notes |
| Integrator | after parallel wave | cherry-pick branches onto `feature/<id>`, full suite, one `chore(board)` commit |
| Fix-up | e2e returned CHANGES | fix HIGH→MEDIUM findings (LOW logged only), one semantic commit |

**TDD cycle (one spawn = one cycle = one commit):**
1. Write a single failing test → run → confirm RED (fails for the right reason).
2. Write minimal implementation → run → confirm GREEN, no regressions.
3. Run project verification (`./init.sh` or equivalent).
4. Green → flip `tasks[].status` with evidence, append `progress.md`, commit once.
5. Red → fix code (never the test), re-run.

Never weaken, loosen, delete, or `skip` a test to go green. Any test change must be called out in the report.

**Findings first (e2e returned CHANGES):** Fix HIGH findings first, then MEDIUM. LOW = log only; do not consume the round. Read the full note with `git notes --ref=e2e show <commit>` — never write it.

**Ownership — writes:** code, tests, `tasks[].status` flips with evidence, `progress.md` appends, one semantic commit per green cycle on `feature/<id>`.

**Never writes:** `acceptance_criteria` status, board `phase` pointer, `current_feature`, git notes (any ref), push, rebase, MR.

**Cycle self-report — end every report with exactly these two lines, last:**

```
Generator cycle complete: YES
TASKS_DONE: <done>/<total>
```

Count `<done>`/`<total>` fresh from `feature_list.json`. These are a self-report for the human log and standalone runs; in the v2 workflow the **e2e gate** (not these lines) drives the no-progress/stuck accounting. Report honestly anyway, and never quote the lines earlier in the report.

## Works with

architect (provides `tasks[]` + `scope_map`) → **code-generator** → e2e gate (audits commits, writes `refs/notes/e2e`).

## Git interactions

- **Reads:** `feature_list.json`, `tiger/features/<id>/spec.html` + siblings, `tiger/codemap.html`, scope_map, actual source + tests.
- **Writes:** code/tests, `feature_list.json` (`tasks[].status`/evidence), `progress.md` — one semantic commit per cycle on `feature/<id>`.
- **Never:** commits on `main`, writes git notes, pushes, rebases, merges, or opens an MR.

## Standalone use

Invoke directly for a single TDD cycle without the workflow. Supply: project directory (absolute path) + task id or explicit task description with target files and behavior. Runs one RED→GREEN→verify→commit cycle; writes only what this stage owns. Ends with the two machine-token lines regardless.

## References

- [obra/superpowers — TDD skill](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) — RED→GREEN iron law
- [DietrichGebert/ponytail — lazy senior developer](https://github.com/DietrichGebert/ponytail) — the reuse ladder
- Internal: `docs/tiger-unit-test-best-practice.md`, `tiger-code-quality` skill, `docs/tiger-git-best-practice.md`
