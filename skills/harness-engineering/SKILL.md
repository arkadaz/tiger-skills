---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the five subsystems that make agents reliable. Use when setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / feature_list.json / progress.md, session management, feature tracking, verification pipelines, or diagnosing agent failures. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering — Conductor

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs. Build everything outside the model that makes AI coding agents reliable.

> A harness is not a prompt file. A harness is everything in the engineering infrastructure outside the model weights. — walkinglabs, Lecture 02

## Core Thesis

**The same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When the model fails on a task you know it can handle, check the harness first — not the model.

## How to read this skill

This skill is the **conductor**. On every request you run the **Gate Sequence** below, top to bottom. It is mechanical, not advisory: you do not skip a gate silently (mark it `skipped (reason)` if it doesn't apply); each gate has an exit condition; control always returns here for the state update after a sub-skill or agent runs.

## The pipeline is one simple linear flow

One feature at a time. No waves, no scheduler, no batch-planner.

```
grill → architect (plans where the code goes) → generator (builds in a git WORKTREE branched from dev: code + unit tests)
      → reviewer + security → e2e + full suite (all IN THE WORKTREE) ──not pass──> back to the generator (fix in the worktree)
      → fast-forward merge the green branch to dev (main stays protected)
      → update docs
```

The *not-pass* arrow loops back to the **generator** (fix in the worktree) and keeps looping **up to 5 times, then escalate**. The worktree already holds all of `dev`, so the e2e there IS an integration test; fast-forwarding a green branch onto an unchanged `dev` can't break it (no post-merge re-test). `main` stays protected — promoting `dev → main` is a separate release step. Several features are just this same flow run one after another, each in its own worktree. The deterministic version of GATES 4–10 lives in `workflows/tiger-pipeline.js`.

## Skills are independent; agents are a bundle of skills

A **skill** is a standalone capability (it never depends on another skill). An **agent** is a worker that *contains a set of skills* it invokes. This is how the roster is built:

| Agent | Role in the flow | Skills it contains |
|-------|------------------|--------------------|
| `code-architect` (opus) | architect — plans where the code goes | `code-quality-audit` |
| `generator` (sonnet) | builds in a worktree: code + unit tests; the fix loop | `code-quality-language`, `code-quality` |
| `reviewer` (opus) | quality **and** correctness, in one pass | `code-quality-review`, `code-correctness-review` |
| `security-reviewer` (opus) | the 12 vuln classes (only when triggered) | `security-review` |
| `executor` (opus) | owns the E2E: authors it + runs the full verify | `e2e-authoring`, `harness-engineering-verify` |
| `cartographer` (opus) | update-docs: map + state + release/business html | `doc-release`, `doc-business` (+ owns `CODEBASE_MAP.md`) |

Grill (the conductor runs it directly) writes the docs through the independent doc-skills: `doc-spec`, `doc-adr`, `doc-e2e-cases`, `doc-business`.

## Invocation names — plugin-namespaced

This is the `tiger-skills` plugin. At the call site you MUST use the prefixed name (the bare name does not resolve):
- **Skill tool:** `tiger-skills:<skill>` (e.g. `tiger-skills:harness-engineering-grill`, `tiger-skills:code-quality-audit`).
- **Agent / Task tool:** `subagent_type` = `tiger-skills:<agent>` (e.g. `tiger-skills:generator`).

The short names in the prose below are for readability — always prepend `tiger-skills:` when you actually call the tool.

---

## THE GATE SEQUENCE — run on every request, in order

| Gate | Name | What it does | Exit condition |
|------|------|--------------|----------------|
| **0** | BOOTSTRAP | The 4 harness files exist? | AGENTS.md, feature_list.json, progress.md, init.sh all exist with real content |
| **1** | GRILL (spec gate) | Build request + no approved spec? → invoke `harness-engineering-grill` NOW | The request maps to a feature with a HUMAN-approved spec, OR it is a bug/question/precise-edit |
| **2** | CLOCK IN | `harness-engineering-session` clock-in | State files read, `./init.sh` healthy, understanding announced |
| **3** | SCOPE | `harness-engineering-feature` — WIP=1 | Exactly one feature `in_progress`, definition of done written |
| **4** | ARCHITECT | Spawn `code-architect` — plan where the code goes | A code plan exists (proof line emitted) |
| **5** | GENERATE | Spawn `generator` — build in a worktree: code + unit tests | Handoff with proof line; committed on `tiger/<id>` |
| **6** | REVIEW | Spawn `reviewer` (+ `security-reviewer` if triggered) — not pass → GATE 5 | reviewers `APPROVED` |
| **7** | E2E | Spawn `executor` — authors + runs the E2E + full suite **in the worktree** — not pass → GATE 5 | `PIPELINE_STATUS: PASS` |
| **8** | MERGE | Spawn `generator` — fast-forward `tiger/<id>` → `dev` (main stays protected) | Promoted to `dev`, worktree removed |
| **9** | UPDATE DOCS | Spawn `cartographer` — map + state + release/business html | `feature_list.json` valid; map updated |
| **10** | COMMIT | Conductor commits (one safe-restart commit) | Work committed |
| **11** | CLOCK OUT | `harness-engineering-session` clock-out | Exit checklist passes |

GATES 4–10 only run for implementation work. A pure question or one-line precise edit runs GATE 0 → GATE 1 (skip) → answer.

---

## GATE 0 — BOOTSTRAP (always first)

Before anything else, check the four harness files exist: `AGENTS.md`/`CLAUDE.md`, `feature_list.json`, `progress.md`, `init.sh`. If any is missing, the ENTIRE response is: report which are missing, create them all via `harness-engineering-bootstrap`, report done. Bootstrap stays in its lane — it creates ONLY those four files, never writes to `specs/`, never stamps a spec `approved`.

## GATE 1 — GRILL (the spec gate)

```
Is the request a BUILD request? (add / build / implement / create / "I want…" / a feature idea)
├── NO  (bug fix, question, precise one-line edit, research) → skip grill, continue
└── YES
     ├── A HUMAN-approved spec already covers it? → continue
     └── Otherwise → invoke `harness-engineering-grill` NOW. Do not plan, do not code.
```

**Approval / self-approval ban:** a spec is approved only when a human said "yes" to it in the conversation. You may never write `Status: approved` yourself — only grill does, and only after showing the spec to the human and getting an explicit yes. A spec you (or bootstrap) authored this session is a **draft**. A pasted spec is grill **input**, not approval. When in doubt, grill.

Grill writes the five artifacts (`specs.md`, `adr.md`, `e2e_testcases.md`, `business.html`, the `feature_list.json` entry) through the doc-skills, runs an adversarial gap pass, and gets human sign-off.

## GATE 2 — CLOCK IN

Invoke `harness-engineering-session` (clock-in): read AGENTS.md, progress.md, feature_list.json; review `git log --oneline -5`; run `./init.sh`; fix any baseline failure before new work; announce understanding.

## GATE 3 — SCOPE (WIP=1)

Invoke `harness-engineering-feature`: pick the highest-priority `not_started` feature whose `depends_on` are all `passing` (or continue the active one), mark it `in_progress`, write the definition of done. Exactly one feature `in_progress`.

## GATE 4 — ARCHITECT (plan where the code goes)

```
Spawn agent: tiger-skills:code-architect
Prompt: "Plan the code for [feature ID]: [title] (read-only — no code). Read CODEBASE_MAP.md first, then the
feature's specs.md / adr.md / e2e_testcases.md. Invoke code-quality-audit. Produce the code plan: where each new
file/module goes, the patterns to follow, and the task breakdown. Project directory: [path].
Begin with: 'code-quality-audit invoked: YES — N principles checked, M violations'."
```
Exit: a code plan with the proof line. (No separate planner — the architect plans.)

## GATE 5 — GENERATE (in a worktree)

```
Spawn agent: tiger-skills:generator
Prompt: "Implement [feature ID] in your own git worktree. From the project root:
git worktree add .tiger-wt/<id> -b tiger/<id>; then inside it write the feature + UNIT tests per the code plan,
run them, and commit. Code plan: [paste]. Project directory: [path].
Write SIMPLE, READABLE code — small flat functions, clear names, shallow nesting, no clever logic. No E2E (the
executor owns it). Invoke code-quality-language; build a Type Inventory; no placeholders.
Begin with: 'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'."
```
The generator runs git **only inside its worktree**. Exit: handoff with proof line, committed on `tiger/<id>`.

## GATE 6 — REVIEW (quality + correctness, + security if triggered)

Spawn `reviewer` (always) and `security-reviewer` (only if the change touches auth, untrusted input, a built query/command, network/file I/O, deserialization, crypto/secrets, or a new dependency). They review the code in the worktree and can run in parallel.

```
tiger-skills:reviewer — "Review [feature ID] in worktree .tiger-wt/<id> — you did NOT write it. Quality +
correctness in one pass. Invoke code-quality-review and code-correctness-review; confirm every acceptance
criterion has a real test. END with: 'REVIEW_VERDICT: APPROVED' or 'REVIEW_VERDICT: CHANGES'."
```
Any `CHANGES` (or CRITICAL/HIGH security) → **back to GATE 5** (generator fixes in the worktree), then re-review. Loop **up to 5 tries**, then escalate. Exit: reviewer APPROVED and (if spawned) security APPROVED.

## GATE 7 — E2E (in the worktree)

```
Spawn agent: tiger-skills:executor
Prompt: "You own the E2E for [feature ID]. Run it IN THE WORKTREE .tiger-wt/<id> — it holds all of dev + this
feature, so this IS the integrated codebase. Invoke e2e-authoring: start from e2e_testcases.md, then add the
edge/cross-feature cases it missed; write new cases back. Invoke harness-engineering-verify; run static → FULL
unit suite (no early stop, so a regression in any feature surfaces) → E2E. Reject if a user-facing AC has no
asserting test. Begin with: 'harness-engineering-verify invoked: YES — layers run: 1,2,3'. END with:
'PIPELINE_STATUS: PASS' or 'PIPELINE_STATUS: FAIL'."
```
`FAIL` → **back to GATE 5** (no healer — the generator fixes in the worktree), then re-validate. The review + e2e validate loop shares one budget: **up to 5 tries**, then escalate.

## GATE 8 — MERGE (fast-forward the green branch to dev)

```
Spawn agent: tiger-skills:generator
Prompt: "Feature [feature ID] is fully green in its worktree. Promote it to dev with a fast-forward — dev has not
moved, so this replays the exact tested commits (no conflict, no re-test). From the project root:
git checkout dev && git merge --ff-only tiger/<id>. If --ff-only is refused, do a normal merge, resolve any
conflict, and re-run the unit suite. Then: git worktree remove .tiger-wt/<id> --force. Do NOT touch main."
```

## GATE 9 — UPDATE DOCS

```
Spawn agent: tiger-skills:cartographer
Prompt: "Feature [feature ID] merged. (1) Refresh CODEBASE_MAP.md — re-trace the changed flows, update diagrams
+ inventory, prune deleted code. (2) Set [feature ID] to 'passing' in feature_list.json, tick its
acceptance_criteria with evidence, record date [today]; update progress.md. (3) invoke doc-release → prepend a
release_docs.html entry. (4) invoke doc-business → refresh business.html. Validate feature_list.json after writing.
End with: 'codebase-map updated: YES …' and 'feature_list.json valid after write: YES'."
```

## GATE 10 — COMMIT

The conductor commits — descriptive message, safe restart state (code + map + state + docs in one commit).

## GATE 11 — CLOCK OUT

Invoke `harness-engineering-session` (clock-out): the exit checklist (init.sh passes, state + docs updated, work committed, no debug artifacts, next session ready).

---

## Proof-of-invocation — why agents stop skipping their skills

Every spawned agent begins its report with a proof line showing it invoked its required skill. A handoff without one is rejected and the agent re-spawned.

| Agent | Proof line |
|-------|------------|
| code-architect | `code-quality-audit invoked: YES — N principles checked, M violations` |
| generator | `code-quality-language invoked: YES — language: <X>, N violations found, N fixed` |
| reviewer | `code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR` |
| security-reviewer | `security-review invoked: YES — N categories checked, C critical, H high` |
| executor | `harness-engineering-verify invoked: YES — layers run: 1,2,3` |
| cartographer | `codebase-map updated: YES — flows traced: N, symbols verified: S, diagrams: D, pruned: P` |

---

## The Diagnostic Loop (when something fails)

Invoke `harness-engineering-diagnose`. Never respond to a failure with "the model isn't good enough." Attribute it to one of five layers and fix that layer:

| Layer | Question | Harness Fix |
|-------|----------|-------------|
| **Instructions** | Task unclear? | Clarify AGENTS.md, add explicit rules |
| **Environment** | Env issue? | Fix init.sh, add dependency |
| **State** | State lost between sessions? | Update progress.md / feature_list.json, read on clock-in |
| **Scope** | Agent overreached? | Tighten definition of done, WIP=1 |
| **Verification** | No verification method? | Add explicit verification commands, run them |

Execute → Attribute → Fix the layer → Retry → never fail the same way twice.

---

## Reference Files

| Reference | When to Load |
|-----------|-------------|
| [references/five-subsystems.md](references/five-subsystems.md) | Auditing or explaining the complete harness model |
| [references/diagnostic-loop.md](references/diagnostic-loop.md) | Something failed — root-cause across five layers |
| [references/minimal-pack.md](references/minimal-pack.md) | Creating harness files — templates + the feature schema |
| [references/session-lifecycle.md](references/session-lifecycle.md) | Clock-in/clock-out routines |
| [references/verification-pipeline.md](references/verification-pipeline.md) | Designing the layered verification pipeline |
| [references/scope-control.md](references/scope-control.md) | WIP=1, definition of done, placeholder ban |

---

## Hard Constraints (non-negotiable)

1. **Run the Gate Sequence** — every request flows through the gates in order; no gate skipped silently.
2. **Spec before build** — a build request with no human-approved spec goes through grill first (GATE 1).
3. **One feature at a time (WIP=1)** — and built in its own worktree until it's green.
4. **Proof of invocation** — every agent emits its required-skill proof line, or its handoff is rejected.
5. **Loop ≤5 tries** — the review loop and the e2e loop each loop back to the generator up to 5 times, then escalate.
6. **Evidence before claims** — never say "done"/"passing" without fresh verification output.
7. **Simple, readable code** — the generator writes the simplest logic that works; no clever constructs.
8. **No placeholders** — `pass`, `TODO`, `NotImplementedError` are forbidden in committed code.
9. **Separate doer from checker** — the generator never writes its own E2E or judges its own work; the executor authors the E2E, the reviewer audits.
10. **Skills independent, agents = a bundle of skills** — a skill never depends on another skill; an agent composes the set it needs.
11. **Leave a clean state** — every session ends restartable from `./init.sh`.

## Further Reading

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — the full course
- [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering)
