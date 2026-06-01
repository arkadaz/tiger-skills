---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the five subsystems that make agents reliable. Use when setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / feature_list.json / progress.md, session management, feature tracking, verification pipelines, or diagnosing agent failures. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs. Build everything outside the model that makes AI coding agents reliable.

> A harness is not a prompt file. A harness is everything in the engineering infrastructure outside the model weights. — walkinglabs, Lecture 02

## Core Thesis

**The same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When the model fails on a task you know it can handle, check the harness first — not the model. Model capability and execution reliability are two separate dimensions.

## The Five Subsystems

A complete harness has five subsystems. Missing any one means an incomplete harness.

| Subsystem | Question It Answers | Minimal Artifact | walkinglabs Lecture |
|-----------|-------------------|------------------|---------------------|
| **Instructions** | What should the agent know? | `AGENTS.md` or `CLAUDE.md` | L02, L03, L04 |
| **Environment** | Can the agent run and verify work? | `init.sh`, `pyproject.toml` / `package.json` | L02, L06 |
| **State** | What happened last session? | `progress.md`, `feature_list.json` | L05, L08, L12 |
| **Scope** | What exactly should the agent work on? | Feature boundaries + definition of done | L07, L08 |
| **Verification** | How does the agent know it's correct? | Verification commands in AGENTS.md | L09, L10, L11 |

## How This Skill Works — Conductor Model

This skill is the **conductor**. It orchestrates both sub-skills (for harness operations) and sub-agents (for implementation work). The conductor never delegates control — it invokes a sub-skill or spawns a sub-agent, that component runs and returns, control comes back here for state updates.

```
User Request → Conductor (this file) → Route to Sub-Skill or Spawn Agent → Return → State Update
```

### Sub-Skills — When to Invoke Each

| Sub-Skill | Use When |
|-----------|----------|
| `harness-engineering:bootstrap` | Setting up a new project for agents, creating AGENTS.md, feature_list.json, progress.md, init.sh from scratch |
| `harness-engineering:session` | Starting or ending a session — clock-in reads all state, clock-out updates all state and leaves clean |
| `harness-engineering:feature` | Managing feature lifecycle — not_started → active → passing/blocked, WIP=1 enforcement |
| `harness-engineering:verify` | Running verification before claiming completion — evidence before assertions always |
| `harness-engineering:review` | Spawning an independent review — separate the doer from the checker |
| `harness-engineering:diagnose` | Something failed — attribute failure to one of five layers, fix that layer, retry |

### The 5-Agent Pipeline — When Each Agent Does Its Own Work

This plugin defines 5 specialized sub-agents. The conductor spawns them in a defined pipeline for implementation work. **Each agent works independently in its own context** — the conductor passes it a task, it does its work, and it hands results back.

```
USER GOAL → PLANNER (Opus) → CODE ARCHITECT (Opus, optional) → GENERATOR (Sonnet) → EXECUTOR (Sonnet) → HEALER (Opus)
                ↑                                                                                    │
                └──────────────────────────── feedback loop ─────────────────────────────────────────┘
```

| Agent | Model | When It Does Its Work | What It Produces |
|-------|-------|----------------------|-----------------|
| **planner** | opus | After scope is defined — before any code is written | Structured blueprint with task breakdown, dependencies, verification criteria |
| **code-architect** | opus | Optionally during planning, or during healing for structural diagnosis | Architecture review with SOLID audit, layer compliance, pattern recommendations |
| **generator** | sonnet | After the blueprint is approved — writes all implementation code | Working code, tests, configs, scripts. A handoff report with verification results |
| **executor** | sonnet | After the generator hands off — runs verification | Fresh verification evidence (pass) or escalation report (fail) |
| **healer** | opus | When the executor reports a failure | Root cause diagnosis, exact fix instructions, harness improvement suggestions |

**Decision — pipeline vs. direct path:**

| Task Type | Use Pipeline? | Why |
|-----------|--------------|-----|
| New module, class, or endpoint | **Full pipeline** (Planner → Generator → Executor) | Benefits from separate planning, implementation, and verification roles |
| Feature spanning 3+ files | **Full pipeline** + Code Architect | Architectural risk is high — independent design review |
| Bug fix (single file, root cause known) | **Direct path** | Planning overhead is waste |
| Typo, formatting, config value | **Direct path** | No pipeline needed |
| Refactoring (behavior-preserving) | **Planner → Generator → Executor** (skip Code Architect) | Need plan but not architecture review |
| Unknown failure / regression | **Healer** (standalone) | Need diagnosis before any fix |
| Research / exploration | **Direct path** | Agents build things — research happens inline |

**The pipeline rule:** when in doubt, use the pipeline. The overhead of spawning agents is minimal compared to the cost of unplanned, unreviewed, unverified code.

### Orchestration Pattern

The full workflow for any non-trivial task:

```
SESSION START → bootstrap check → read state → pick feature → SCOPE (one feature)
    → PLAN (spawn planner agent) → ARCHITECT (spawn code-architect, optional)
    → GENERATE (spawn generator agent) → EXECUTE (spawn executor agent)
    → [ON FAILURE: HEAL (spawn healer agent) → GENERATE → EXECUTE — max 3 loops]
    → VERIFY (harness-engineering:verify) → REVIEW (independent review agent)
    → TRACK (update state) → SESSION END (clean state)
```

## Reference Files

Load these as needed. Follow the walkinglabs principle: **give a map, not an encyclopedia** — load only what the current task requires.

| Reference | When to Load |
|-----------|-------------|
| [references/five-subsystems.md](references/five-subsystems.md) | Understanding the complete harness model, auditing an existing harness |
| [references/diagnostic-loop.md](references/diagnostic-loop.md) | Something failed — root cause analysis across the five layers |
| [references/minimal-pack.md](references/minimal-pack.md) | Creating harness files from scratch — templates and file contents |
| [references/session-lifecycle.md](references/session-lifecycle.md) | Clock-in/clock-out routines, 16-step agent lifecycle |
| [references/verification-pipeline.md](references/verification-pipeline.md) | Designing verification — layered pipeline, evidence recording |
| [references/scope-control.md](references/scope-control.md) | WIP=1, definition of done, feature boundaries, placeholder ban |

---

## Bootstrap Gate — DO THIS FIRST

**Before answering the user, before reading any reference, before ANY other action — check whether harness files exist.** A project without these files has no harness. Creating them is the agent's first and only job.

### The Minimal Harness Pack (walkinglabs)

These four files are the minimum viable harness. Check for each one:

| # | File | Purpose | If Missing |
|---|------|---------|-------------|
| 1 | `AGENTS.md` or `CLAUDE.md` | Instructions: startup path, working rules, definition of done | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 2 | `feature_list.json` | State: machine-readable feature tracking | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 3 | `progress.md` | State: session log, verified status, next steps | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 4 | `init.sh` | Environment: install + verify + start | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |

**Gate rule:** If any of these four files are missing, the agent's ENTIRE response is: report which files are missing, create them all using the templates, then report done. Do NOT take any other action until the bootstrap gate passes.

**Gate passes when:** All four files exist on disk with real content (not placeholders). Only then proceed to Phase 1.

---

## The Outer Loop — Conductor Protocol

Once the bootstrap gate passes, every user task flows through these phases.

---

### Phase 1: SESSION START — Clock In

**Invoke `harness-engineering:session`** for the clock-in sequence.

The session sub-skill handles:
1. Read ALL state files (AGENTS.md, progress.md, feature_list.json)
2. Review recent git log (understand recent changes)
3. Run `./init.sh` (verify environment is healthy)
4. If baseline verification fails, fix BEFORE starting new work
5. Announce understanding: project state, locked decisions, current task

**Gate:** All state files read, environment healthy, agent knows exactly what to work on.

---

### Phase 2: SCOPE — Pick ONE Feature

**Invoke `harness-engineering:feature`** to select and scope the work.

The feature sub-skill handles:
1. Read `feature_list.json` — what's done, what's in progress
2. WIP=1 check — only ONE feature active at a time
3. Pick highest-priority `not_started` feature (or continue active)
4. Mark feature `active`
5. Define explicit completion criteria (definition of done)

**Gate:** Exactly one feature is `active`. Exact completion criteria are written down.

---

### Phase 3: IMPLEMENT — Spawn the Agent Pipeline

**This is the core phase. Use the decision table above to choose pipeline vs. direct path.**

#### Direct Path (simple tasks only)

For typo fixes, config values, single-line bug fixes — do the work inline. Then proceed to Phase 4.

#### Full Pipeline (non-trivial work)

The conductor spawns each agent in sequence. Each agent works independently — you wait for its result, read it, then hand off to the next agent.

---

**Step 3a — PLAN: Spawn the `planner` agent**

Spawn the planner agent using the Agent tool. Give it:
- The active feature from `feature_list.json` (ID, title, user_visible_behavior, verification criteria)
- The project directory path
- Any additional user context or constraints

```
Spawn agent: planner
Prompt: "Plan the implementation for [feature ID]: [feature title].

Feature behavior: [user_visible_behavior from feature_list.json]
Verification criteria: [verification steps from feature_list.json]
Project directory: [path]

Read AGENTS.md, progress.md, and feature_list.json for context.
Explore the codebase to understand existing types, patterns, and architecture.
For non-trivial features, consult the code-architect agent during design.

Produce a blueprint with task breakdown, dependencies, and verification steps.
Use the blueprint output format: Context → Task Breakdown → Execution Phases → Risks."
```

**The planner returns a blueprint.** Read it. The blueprint must have:
- Task breakdown table (ID, task, complexity, agent, files, dependencies, verification)
- Execution phases with parallelism noted
- Risks and mitigations

If the blueprint is vague or incomplete, send it back to the planner with specific questions. Do NOT proceed to generation until the blueprint is solid.

**Gate:** Blueprint reviewed and approved by the conductor.

---

**Step 3b — ARCHITECT (optional): Spawn the `code-architect` agent**

Required when:
- The feature creates a new module or package
- The feature spans 3+ files
- The feature introduces a new architectural pattern
- The planner's risk assessment flagged structural concerns

```
Spawn agent: code-architect
Prompt: "Review the architecture for this blueprint:

[Paste the planner's blueprint here]

Audit the proposed architecture against SOLID principles, layer discipline,
and pattern selection. Read existing code before recommending.

Produce an architecture review with violations, pattern recommendations, and verdict.
Use the output format: Summary → Violations → Pattern Recommendations → Verdict."
```

If the code-architect returns CHANGES REQUESTED or REJECTED, send the review back to the planner to adapt the blueprint. Loop until APPROVED or APPROVED WITH CHANGES.

**Gate:** Architecture approved (or step skipped for simple features).

---

**Step 3c — GENERATE: Spawn the `generator` agent**

Give the generator the approved blueprint:

```
Spawn agent: generator
Prompt: "Implement this blueprint. Follow all code-quality rules and TDD discipline.

Blueprint:
[paste the full blueprint from the planner, including any code-architect revisions]

Project directory: [path]

Before writing code:
1. Read AGENTS.md for project conventions and hard constraints
2. Read feature_list.json and progress.md for context
3. Invoke the appropriate code-quality skill (code-quality:python or code-quality:rust)
4. Discover project types — build a Type Inventory before writing function signatures

During implementation:
- TDD: write failing test first, then minimal code, then refactor
- Code quality: types everywhere, DI, enums, no bare except, flat functions, no water
- No placeholders: every function complete, no pass/TODO/NotImplementedError

After all tasks complete, produce a Generator Handoff:
- Completed tasks with commit hashes
- Files changed
- Verification: lint, type-check, and test results (Layer 1 and 2 passing)
- Notes: any env vars or dependencies added"
```

**The generator writes code and produces a handoff.** The handoff must show:
- All tasks from the blueprint completed
- Layer 1 (lint + type-check) passing
- Layer 2 (unit tests) passing
- No placeholders, no debug artifacts

If the generator reports unresolved issues, do NOT proceed. Send back specific instructions.

**Gate:** Generator handoff received, self-verification passing.

---

**Step 3d — EXECUTE: Spawn the `executor` agent**

The executor independently verifies what the generator built:

```
Spawn agent: executor
Prompt: "Verify the implementation independently.

Generator handoff:
[paste the generator's handoff]

Blueprint verification criteria:
[paste verification steps from the blueprint]

Project directory: [path]

Run the full 3-layer verification pipeline:
1. Layer 1: Static analysis (ruff + mypy / clippy) — expect 0 errors
2. Layer 2: Runtime tests (pytest / cargo test) — expect all passing
3. Layer 3: E2E / smoke tests if the feature crosses component boundaries

The Iron Law applies: never claim completion without fresh verification evidence from THIS session.

If all layers pass: report success with full output as evidence.
If any layer fails: produce an Executor Escalation with exact error output, commit hash, and files involved."
```

**Two outcomes:**

| Executor Result | Conductor Action |
|----------------|-----------------|
| **PASS** — all layers green | Proceed to Phase 4 (Verify) |
| **FAIL** — any layer red | Proceed to Step 3e (Healer) |

**Gate:** Executor reports all layers passing, OR escalation sent to healer.

---

**Step 3e — HEAL (on failure): Spawn the `healer` agent**

Only when the executor reports a failure:

```
Spawn agent: healer
Prompt: "Diagnose and prescribe a fix for this failure.

Executor escalation:
[paste the executor's escalation report]

Planner blueprint:
[paste the original blueprint]

Project directory: [path]

Follow the diagnostic protocol:
1. Investigate — read the failing output, source files, spec, and blueprint
2. Reproduce — confirm the failure is real
3. Classify — map to one of five harness layers (Instructions/Environment/State/Scope/Verification)
4. Determine root cause — specific file:line references
5. Prescribe the fix — tell the generator exactly what to change

Produce a Healer Diagnosis with:
- Root cause layer and explanation
- Exact fix instructions (file, line, change, expected result)
- Additional checks to verify
- Harness improvement: could this failure class have been prevented?"
```

After the healer responds:
1. Read the diagnosis
2. **Spawn the `generator` again** with: the original blueprint + the healer's fix instructions + "Apply these fixes"
3. **Spawn the `executor` again** with the new generator handoff
4. **Max 3 healing loops** — if the same failure persists after 3 cycles, escalate to the user with full diagnostic history

**Gate (after healer loop):** Executor reports all layers passing, or user escalation.

---

### Phase 4: VERIFY — Evidence Before Claims

**Invoke `harness-engineering:verify`** before claiming ANY completion.

The verification sub-skill enforces the walkinglabs Iron Law:

> Never claim completion without fresh verification evidence from THIS session.

1. **IDENTIFY:** What command proves this claim?
2. **RUN:** Execute the FULL command (fresh, complete, this session)
3. **READ:** Full output, check exit code, count failures
4. **VERIFY:** Does output confirm the claim?
5. **ONLY THEN:** Make the claim

**Note:** If the full pipeline ran (Phase 3), the executor already produced verification evidence. The conductor still re-runs the top-level verification command to confirm the executor's findings — two independent verifications, not one.

**Gate:** Verification command ran THIS session, output shows ZERO failures, evidence recorded.

---

### Phase 5: REVIEW — Independent Check

**Invoke `harness-engineering:review`** for non-trivial changes.

The review sub-skill enforces the walkinglabs principle: **separate the doer from the checker.** Agents systematically over-rate their own output. An independent review agent must audit the work.

**Required for:** New modules, functions >15 lines, API endpoints, changes spanning 3+ files.
**Optional for:** Single-line bug fixes, typos, config values.

**Note:** The generator, executor, and healer agents are all "doers" in this context. The review agent spawned here is independent of all of them — it has not seen the code before.

**Gate:** Review passed (or not required). All BLOCKING and MAJOR findings fixed.

---

### Phase 6: TRACK — Update State

After implementation and verification pass, update ALL state files:

1. **`progress.md`** — mark completed, update in-progress, list next steps
2. **`feature_list.json`** — mark feature `passing`, record evidence
3. **git commit** — descriptive message, safe state for next session

---

### Phase 7: SESSION END — Clock Out

**Invoke `harness-engineering:session`** for the clock-out sequence.

The session sub-skill enforces the walkinglabs exit checklist:

```
Session Exit Checklist:
- [ ] init.sh passes (install + verify)
- [ ] progress.md updated (completed, in-progress, next steps)
- [ ] feature_list.json updated (feature states accurate)
- [ ] All work committed with descriptive messages
- [ ] No debug code, print(), commented-out code, stale TODOs
- [ ] No temporary files, debug logs, scratch scripts
- [ ] Standard startup path works (./init.sh)
- [ ] Next session can start without guessing
```

**Gate:** All 8 items pass. Repo is safe for the next session.

---

## The Diagnostic Loop (When Something Fails)

**Invoke `harness-engineering:diagnose`.** Never respond to a failure by saying "the model isn't good enough."

The diagnostic loop from walkinglabs Lecture 01:

1. **Execute** — run verification, observe the failure
2. **Attribute** — which of the five layers caused it?
3. **Fix** — fix that layer of the harness
4. **Retry** — re-execute verification
5. **Never fail the same way twice** — if a failure class recurs, the harness fix was wrong

### Five-Layer Attribution

| Layer | Question | Example Failure | Harness Fix |
|-------|----------|----------------|-------------|
| **Instructions** | Was the task unclear? | "Built X but spec said Y" | Clarify AGENTS.md, add explicit rules |
| **Environment** | Were there env issues? | "Module not found: pydantic" | Fix init.sh, add missing dependency |
| **State** | Was state lost between sessions? | "Re-implemented existing feature" | Update progress.md, read it on clock-in |
| **Scope** | Did the agent overreach? | "Fixed the bug but also refactored 3 files" | Tighten definition of done, enforce WIP=1 |
| **Verification** | Were there no verification methods? | "Code looks right" (but doesn't work) | Add explicit verification commands, run them |

---

## Quick Reference

| Phase | What Happens | Who Does the Work |
|-------|-------------|-------------------|
| 0. Bootstrap | Create AGENTS.md, feature_list.json, progress.md, init.sh | Conductor via `harness-engineering:bootstrap` |
| 1. Session Start | Clock-in: read all state, verify environment | Conductor via `harness-engineering:session` |
| 2. Scope | Pick one feature, WIP=1, define done | Conductor via `harness-engineering:feature` |
| 3a. Plan | Decompose goal into structured blueprint | **`planner` agent** (opus), optionally consults `code-architect` |
| 3b. Architect | Architecture review, SOLID audit | **`code-architect` agent** (opus) — optional, for non-trivial features |
| 3c. Generate | Write all code, tests, configs following TDD + code-quality | **`generator` agent** (sonnet) |
| 3d. Execute | Run 3-layer verification pipeline, collect evidence | **`executor` agent** (sonnet) |
| 3e. Heal | Diagnose root cause, prescribe fix, close feedback loop | **`healer` agent** (opus) — only on executor failure, max 3 loops |
| 4. Verify | Evidence before claims, fresh verification | Conductor via `harness-engineering:verify` |
| 5. Review | Independent review — separate doer from checker | Conductor via `harness-engineering:review` (spawns review agent) |
| 6. Track | Update progress.md, feature_list.json, commit | Conductor |
| 7. Session End | Clock-out: 8-item exit checklist | Conductor via `harness-engineering:session` |
| On Failure | Attribute to layer → fix harness → retry | Conductor via `harness-engineering:diagnose`, or `healer` agent for code failures |

### Agent Pipeline Summary

```
CONDUCTOR (this session, any model)
    │
    ├─ Phase 1-2: Clock-in + Scope (sub-skills)
    │
    ├─ Phase 3a: Spawn PLANNER (opus) → gets blueprint
    ├─ Phase 3b: Spawn CODE-ARCHITECT (opus) → gets architecture review [optional]
    ├─ Phase 3c: Spawn GENERATOR (sonnet) → writes all code
    ├─ Phase 3d: Spawn EXECUTOR (sonnet) → runs verification
    ├─ Phase 3e: Spawn HEALER (opus) → diagnoses failure [on executor fail]
    │       └─ Back to 3c (max 3 loops)
    │
    ├─ Phase 4-5: Verify + Review (sub-skills)
    ├─ Phase 6-7: Track + Clock-out (conductor)
    │
    └─ DONE
```

## Hard Constraints (Non-Negotiable)

These come directly from walkinglabs:

1. **Check the harness first** — when the model fails on a task it should handle, the problem is in the harness
2. **Evidence before claims** — never say "done" or "passing" without fresh verification output
3. **WIP = 1** — exactly one feature active. No exceptions without explicit user approval
4. **No placeholders** — `pass`, `TODO`, `NotImplementedError` are forbidden in committed code
5. **Leave a clean state** — every session ends with the repo restartable from `./init.sh`
6. **Separate doer from checker** — the agent that wrote the code cannot be the sole judge of its quality
7. **Repo is the system of record** — if it's not in the repo, it doesn't exist for the agent
8. **Spawn agents for non-trivial work** — the conductor must spawn the planner, generator, and executor agents. Do NOT do their work inline. The pipeline exists for a reason: independent planning, implementation, and verification produce better results than one agent doing everything.

## Further Reading

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — full 12-lecture course
- [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering) — curated resources
- OpenAI: "Harness Engineering — Leveraging Codex in an Agent-First World"
- Anthropic: "Effective Harnesses for Long-Running Agents"
