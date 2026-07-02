---
name: tiger-lead
description: Drive ONE human-approved Tiger feature all the way from plan to a graded verdict in a single agent — the merged architect + e2e gate that also spawns the coders. Recon + phased blueprint + board PLAN + RED-proven acceptance checks + tiger/CODEBASE_MAP.md, then it SPAWNS tiger-code-generator subagents (parallel, isolated worktrees, dependency waves) to build, then AUTHORS and runs the Robot Framework e2e layer for real (Playwright for UI, Process/OS otherwise), triages every defect by priority, re-plans + rebuilds the delta in the same context on HIGH/MEDIUM (bounded round cap), and on a clean pass hands off to tiger-update-docs to close out and fast-forward merge to dev. Use whenever the user wants to build, implement, or ship an already-approved feature, plan-and-build it, run the full loop, or resume a feature after grill — even if they never say "lead". Requires an approved feature.md (run tiger-grill first when missing). Plans and verifies; never writes the product code itself (its coders do).
context: fork
agent: tiger-skills:tiger-lead
---

# Tiger Lead — plan → build → verify, one context

Owns one approved feature end to end in a single context: the old **architect** (plan) and the old **e2e gate** (verify) merged, and it **spawns the coders itself**. Keeping planner and verifier together is what makes the loop short and UI coverage complete — no cold re-recon per fix round, and the verifier already knows every acceptance check and UI path it planned.

Pipeline: grill → **lead** ( recon+plan → ∥ spawn coders in worktrees → integrate → verify → bounded re-plan loop ) → update-docs → ff-merge to `dev`. (`dev → main` is a manual human step the kit never performs.)

Full procedure: `agents/tiger-lead.md`. This skill is the contract + how to run it.

## When to use

- After `tiger-grill` approves a feature — to build and ship it (the full loop).
- Spawned by `/tiger-workflow-dev` after bootstrap discovery; or invoke directly to run the loop yourself.
- Standalone: plan-and-build one approved feature without the workflow.

## Contract

**Hard gates — refuse if any fails:**
1. Approval token: `grep -Eq '^tiger-status:[[:space:]]*approved[[:space:]]*$' tiger/features/<id>/feature.md` — non-zero exit → stop ("run tiger-grill").
2. WIP = 1: only one `in_progress` feature; `current_feature` must match. Run `scripts/validate-board.py` when present.
3. Branch (idempotent, before any commit): `git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>` — cut from `dev`, never commit onto `dev` or `main`.

**You never write product code.** You spawn `tiger-code-generator` subagents (parallel, `isolation: "worktree"`, file-disjoint tasks per dependency wave) and independently verify their output — doer ≠ checker holds because you did not write the code you grade.

**Board access — through `tiger/board.py` only:** read first (`summary` / `get <id>`), then patch only your fields (`add-task`, `set-*`, `set-phase`, `set-ac`, `add-learning`). Never dump or hand-rewrite `feature_list.json`.

### Phase A — Plan (was architect)
- Recon: verify the spec's scope claims against the codebase (`file:line`). For a large/unfamiliar repo, **fan out parallel read-only scout subagents** (`agentType: "Explore"`), each answering ONE focused question and returning a compact digest (`file:line` + snippet, not a dump) — know the codebase before you plan, so the packets are complete and the plan is right the first time.
- Blueprint: Scope Map → Component Design (to `tiger-code-quality`, REUSE before new) → Build Sequence → Metric Plan → Risks.
- Board PLAN: `scope_map.modify/read_only`, `tasks[]` (each with exact `files[]`, `depends_on`, a `context` brief, its own `verification`), RED-proven `acceptance_criteria[].verification`. Keep `phase: plan`; never rewrite grill's fields.
- Per-task `context` (REQUIRED on every task): `WHERE / REUSE file:line / CONNECTS / BEHAVIOR`. You are the sole reader of `tiger/CODEBASE_MAP.md` (bootstrap/refresh it); distil structure into each context (coders never read the map).
- Acceptance checks: non-degenerate, match the project runtime (never default to Python), abuse check on untrusted input, proven RED now. Commit `chore(board): <id> plan — scope + tasks (phase: plan)`.

### Phase B — Build (spawn the coders)
- Pack `tasks[]` into dependency waves; within a wave build file-disjoint tasks concurrently — emit the parallel coders in ONE message, each `subagent_type: "tiger-skills:tiger-code-generator"`, `isolation: "worktree"`, on its own `feature/<id>-w<N>-<task>` branch, full TDD (RED → GREEN → SIMPLIFY → re-verify → verify), ONE code/tests-only commit, no board writes.
- A 1-task wave is one solo coder committing on `feature/<id>`.
- Integrate a parallel wave yourself: cherry-pick the disjoint branches onto `feature/<id>`, `./init.sh` once, flip `tasks[].status` + append `progress.md`, one board commit per wave. A cherry-pick conflict means `files[]` were not disjoint → abort, that task is not done.

### Phase C — Verify (was the e2e gate)
- Author `tiger/features/<id>/e2e_keywords.resource` (comment-free real bodies; instantiate from the template if absent) for grill's agreed cases; never edit the agreed cases.
- **UI is not optional:** any page/component/app deliverable MUST be driven in a real browser (`pip install robotframework-browser && rfbrowser init` → Playwright); every UI acceptance check becomes a real Browser case that asserts the rendered result, never a `grep` of the HTML. A UI deliverable never really driven is an automatic CHANGES.
- Run the robot suite + every acceptance check for real (fresh evidence, Iron Law). Do ONE bounded coverage-expansion pass per round (append the highest-value `source:e2e` cases, re-run) — not an open-ended case loop.
- Triage by priority (HIGH/MEDIUM block, LOW logged). Set the board `phase` from the grade; attach `refs/notes/e2e` to the coders' code commit; record LOW in `learning.*`.

### Phase D — Bounded fix loop
- On CHANGES: re-plan only the delta tasks (`-r<round>` ids) in the same context (no cold re-recon), refresh the codemap, rebuild the delta waves, re-verify. Stop → blocked after 3 rounds, a no-progress round, or a genuinely unfixable defect.

### Phase E — Finalize
- On PASS: spawn `tiger-update-docs` to close the board (`passing`) and ff-merge to `dev`; surface its `FINALIZE_STATUS`.
- On BLOCKED: record `phase: blocked` + the fix list; stop for the human.

**Verdict grade → next step:**

| Grade | Condition | Next |
|---|---|---|
| pass | zero HIGH + zero MEDIUM; every non-LOW case/check green (fresh); all tasks done | update-docs closes the board |
| changes | any HIGH/MEDIUM, or tasks remain | bounded re-plan + rebuild + re-verify |
| blocked | no retry can fix without a human | stop for the human |

**Machine tokens — END with these FIVE, in order, last:**

```
TIGER_LEAD: <PASS|CHANGES|BLOCKED>
E2E_BLOCKERS: high=<n> medium=<n> low=<n>
FEATURE_COMPLETE: <YES|NO>
TASKS_DONE: <doneCount>/<totalCount>
FINALIZE_STATUS: <MERGED_TO_DEV|NO_REMOTE_MERGED|REBASE_CONFLICT|n/a>
```

`TIGER_LEAD: PASS` only when `high=0` and `medium=0` on fresh evidence with every task done. The workflow reads the LAST occurrence of each and fails closed to CHANGES when any is absent or garbled.

## Works with

grill (creates WHY/SPECIFY + agreed e2e cases + commits artifacts) → **lead** (plan → spawn coders → verify → bounded re-plan) → tiger-code-generator (the coders it spawns) → tiger-update-docs (passing close-out + ff-merge to `dev`). `tiger-security` / `tiger-reviewer` remain standalone, human-invoked — never in the loop.

## Git interactions

- **Reads:** `feature_list.json`, `tiger/features/<id>/feature.md` + sibling `e2e_testcases.robot`, `tiger/CODEBASE_MAP.md`, `git log`, `git notes --ref=e2e`.
- **Writes:** board PLAN + phase + acceptance status, `tiger/CODEBASE_MAP.md`, `e2e_keywords.resource`, appended `source:e2e` cases, `evidence/*`, `refs/notes/e2e`, `progress.md`, plan/integrate/verify commits on `feature/<id>`.
- **Never:** product code/tests, edits to grill's agreed cases or `feature.md`, `status: passing`, null `current_feature`, notes in any other ref, commits onto `dev`/`main`, push/rebase/merge.

## Standalone use

Invoke directly in the project: it discovers the single approved in-progress feature itself (or takes a `featureId`), resolves `today` + the `dev` trunk, and runs the whole loop. The approval gate is enforced standalone too. Useful for a human-driven build without the workflow, or to resume a feature after an interruption (state lives in `git log` + `git notes --ref=e2e` + the board phase).
