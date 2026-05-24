---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the instructions, tools, environment, state, and feedback systems that make agents reliable. Use this skill whenever the user mentions setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / PROGRESS.md, session management, feature tracking, verification pipelines, task breakdowns, git workflow for agents, or anything related to "harness engineering." Also use when the user asks "how do I make this agent work better" or reports that an agent keeps failing. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering

Build everything outside the model that makes AI coding agents reliable. **The same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When agents fail, fix the harness first, not the model.

## Core Philosophy

A harness has five subsystems. All five must be present:

| Subsystem | What It Is | Concrete Forms |
|-----------|-----------|----------------|
| **Instructions** | What the agent should know and enforce | `AGENTS.md` / `CLAUDE.md`, topic docs |
| **Tools** | What the agent can execute | Shell, git, package manager, linter, test runner |
| **Environment** | Reproducible runtime | `pyproject.toml`, lock files, Docker |
| **State** | Progress + decisions across sessions | `PROGRESS.md`, `DECISIONS.md`, `GRAPH.md`, git commits |
| **Feedback** | Explicit verification that work is correct | Verification commands, test suites, lint/type checks |

**The diagnostic loop:** Every failure must be attributed to one of five layers — spec / context / environment / verification / state. Fix that layer. Never fail the same way twice.

## How This Skill Works — Conductor Model

This skill is the **conductor**. It orchestrates superpowers skills and code-quality, wrapping each with harness-specific work. The conductor never delegates control — it invokes a skill, the skill runs, then control returns here for harness state updates before the next phase.

Every phase follows the same pattern:

```
BEFORE (harness pre-work) → INVOKE (superpowers/code-quality skill) → AFTER (harness state updates)
```

### Skills This Conductor Orchestrates

| Skill | Role | Invoked At |
|-------|------|-----------|
| `superpowers:brainstorming` | Business discovery, design, spec writing | Phase 2 (CLARIFY) |
| `superpowers:writing-plans` | Bite-sized implementation plans | Phase 4 (PLAN) |
| `superpowers:test-driven-development` | Red-Green-Refactor during implementation | Phase 5 (IMPLEMENT) |
| `superpowers:subagent-driven-development` | Parallel task execution with review | Phase 5 (IMPLEMENT) |
| `superpowers:executing-plans` | Sequential task execution | Phase 5 (IMPLEMENT) |
| `superpowers:systematic-debugging` | 4-phase root cause analysis | Phase 5 (on failure) |
| `superpowers:verification-before-completion` | Iron Law — no claims without evidence | Phase 6 (VERIFY) |
| [code-quality](../code-quality/SKILL.md) | Design principles, language rules, review agent | Phase 5 + 6 (inner loop) |

## Reference Files

Load these as needed based on the task:

| Reference | When to Load |
|-----------|-------------|
| [references/repo-system.md](references/repo-system.md) | Setting up a project, writing AGENTS.md, organizing docs |
| [references/session-discipline.md](references/session-discipline.md) | Every session start and end — clock-in/out routines |
| [references/task-management.md](references/task-management.md) | Breaking down work, tracking features, parallel agents, subagent protocol |
| [references/verification.md](references/verification.md) | Iron Law, completion gate, rationalization prevention, 3-layer pipeline |
| [references/doc-first.md](references/doc-first.md) | Before implementing — specs, business docs, codebase map |
| [references/workflow.md](references/workflow.md) | 14-step flow, self-review checklists, anti-patterns, diagnostic loop |

---

## Bootstrap Gate — DO THIS FIRST

**Before answering the user, before reading any reference, before ANY other action — check whether harness files exist.** A project without these files has no harness. Creating them is the agent's first and only job.

Execute these checks immediately. For each file that is missing, CREATE it using the template from the reference:

| # | Check | If Missing — CREATE From Template In |
|---|-------|--------------------------------------|
| 1 | `AGENTS.md` or `CLAUDE.md` | [references/repo-system.md](references/repo-system.md) § "Minimal Template" |
| 2 | `PROGRESS.md` | [references/session-discipline.md](references/session-discipline.md) § "PROGRESS.md — The Agent's Memory" |
| 3 | `DECISIONS.md` | [references/session-discipline.md](references/session-discipline.md) § "DECISIONS.md — The Agent's Rationale" |
| 4 | `docs/GRAPH.md` | [references/doc-first.md](references/doc-first.md) § "Code Flow Graph (GRAPH.md)" |
| 5 | `docs/codebase-map.md` | [references/repo-system.md](references/repo-system.md) § "Codebase Knowledge Map" |
| 6 | `Makefile` | [references/workflow.md](references/workflow.md) § "Init Acceptance Checklist" — create with targets: setup, test, lint, check, dev |
| 7 | `docs/business/` | Create the directory (empty, ready for business rule docs) |
| 8 | `docs/specs/` | Create the directory (empty, ready for per-feature specs) |
| 9 | `.env.example` | Create with all required env vars documented (no real values) |

**Gate rule:** If >=1 files are missing, the agent's entire response is: report which files are missing, create them all, then report done. Do NOT take any other action until the bootstrap gate passes.

**Gate passes when:** All 9 checks above exist on disk. Only then proceed to the Outer Loop.

---

## The Outer Loop — Conductor Protocol

Once the bootstrap gate passes, **every user task** flows through these seven phases in strict order. Never skip a phase. Never reorder. Never jump to implementation.

---

### Phase 1: SESSION START — Clock In (Harness-Specific)

Follow [references/session-discipline.md](references/session-discipline.md) clock-in sequence. This is NOT optional.

1. **Read `PROGRESS.md`** — what's completed, what's in progress, known issues
2. **Read `DECISIONS.md`** — what architectural choices are locked in
3. **Run `make check`** — confirm the repo is in a consistent state
4. **Handle failures** — if `make check` fails, diagnose BEFORE starting new work. Never build on a broken foundation.

**Gate:** Repo state is understood, `make check` passes (or failures are documented in PROGRESS.md Known Issues).

---

### Phase 2: CLARIFY — Business Discovery + Design + Spec

This phase uses `superpowers:brainstorming` with harness work layered on top.

#### BEFORE invoking brainstorming — harness exploration

Read these files to build context BEFORE the brainstorming conversation begins. This context informs every question you ask and every approach you propose:

1. Read `docs/codebase-map.md` — what files exist, directory structure
2. Read `docs/GRAPH.md` — how existing code flows connect
3. Read `docs/business/<domain>.md` — business rules for the affected domain
4. Grep/Glob for overlapping code — does something similar already exist?
5. Read the actual files that will likely be modified

#### INVOKE `superpowers:brainstorming`

The brainstorming skill handles:
- Exploring project context (files, docs, recent commits)
- Asking clarifying questions one at a time (multiple choice preferred)
- Scope decomposition for large requests (flag multi-subsystem requests immediately)
- Proposing 2-3 approaches with trade-offs and a recommendation
- Presenting the design section by section, getting approval per section
- Writing the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Spec self-review (placeholder scan, internal consistency, scope check, ambiguity check)
- Getting user approval on the written spec

**IMPORTANT:** Feed the harness context INTO brainstorming. When the brainstorming skill asks you to "explore project context," you already have it from the BEFORE step. Use it:
- Existing code flows from GRAPH.md inform which approaches are viable
- Locked decisions from DECISIONS.md constrain the design space
- Business rules from docs/business/ must be respected in the design
- Overlapping code you found must be considered (reuse vs. replace vs. extend)

#### AFTER brainstorming completes — harness state updates

Once the spec is written and approved:

1. **Update `PROGRESS.md`** — add the feature with state `active`, link to spec file
2. **Update `DECISIONS.md`** — record any architectural decisions made during design (approach chosen, alternatives rejected, constraints imposed)
3. **Create/update `docs/business/<domain>.md`** — if the spec reveals new business rules
4. **Reconcile spec location** — if brainstorming saved to `docs/superpowers/specs/`, also link from `docs/specs/` so the harness can find it

**Gate:** Spec written and approved. PROGRESS.md shows feature as `active`. DECISIONS.md updated if decisions were made.

---

### Phase 3: SPEC — Only If Brainstorming Was Skipped

If brainstorming ran in Phase 2, the spec already exists. **Skip to Phase 4.**

If brainstorming was skipped (user provided a complete spec, bug fix, or trivial change), write a spec manually:

- Write to `docs/specs/YYYY-MM-DD-<topic>.md` following [references/doc-first.md](references/doc-first.md) § spec template
- Run the spec self-review checklist from [references/workflow.md](references/workflow.md) § "Spec Self-Review"
- Present to user for approval if non-trivial

**Required for:** Any feature, any bugfix that changes behavior, any refactoring touching >1 file.
**Skippable for:** Typo fixes, single-line fixes with zero behavior change.

---

### Phase 4: PLAN — Implementation Planning

This phase uses `superpowers:writing-plans` with harness work layered on top.

#### BEFORE invoking writing-plans — harness pre-checks

1. **Verify spec exists and is approved** — the spec is the input to planning. No spec = no plan.
2. **Check `PROGRESS.md`** — confirm WIP=1 (no other feature is `active`). If another feature is active, finish or block it first.
3. **Check `docs/GRAPH.md`** — understand which existing flows the plan will touch or extend
4. **Load [references/task-management.md](references/task-management.md)** — understand bite-sized task rules, the placeholder ban, the parallel agent checklist

#### INVOKE `superpowers:writing-plans`

The writing-plans skill handles:
- File structure mapping (which files created/modified, one responsibility per file)
- Bite-sized task decomposition (each step = 2-5 minutes, one action)
- Complete code in every step (no placeholders — actual code blocks required)
- Exact file paths, exact commands, exact expected output
- TDD structure per task (write failing test → verify fails → implement → verify passes → commit)
- Plan self-review (spec coverage, placeholder scan, type consistency)
- Execution handoff choice: subagent-driven (recommended) vs inline

**IMPORTANT:** Feed harness context INTO writing-plans:
- GRAPH.md flows tell the planner which integration points exist
- Task-management rules (WIP=1, placeholder ban, bite-sized tasks) must be followed
- Each task must leave `make check` passing — independently verifiable

#### AFTER writing-plans completes — harness state updates

1. **Update `PROGRESS.md`** — feature marked as `planned`, link to plan file
2. **Verify plan alignment** — each task maps to spec requirements, plan tasks touch files consistent with GRAPH.md flows
3. **Record execution choice** — note whether subagent-driven or inline was chosen

**Gate:** Plan written, reviewed, and approved. PROGRESS.md updated. Execution approach chosen.

---

### Phase 5: IMPLEMENT — Code Quality + TDD + Execution

This is the most skill-heavy phase. Three skills work together, with code-quality rules governing everything.

#### BEFORE invoking execution — codebase discovery + code-quality comprehension gate

**Load [code-quality](../code-quality/SKILL.md) and pass its comprehension gate BEFORE writing any code.** This is mandatory. The comprehension gate now includes **Codebase Type Discovery** — the agent must find and read ALL existing types before writing a single line.

**Step A — Codebase Type Discovery (MANDATORY, DO NOT SKIP):**

The #1 agent failure is writing `cfg: Any` when `AppConfig` exists 3 files away. This step prevents it.

1. **Glob/Grep for all type definitions** — models, configs, drivers, enums, type aliases. Search patterns:
   - `class.*BaseModel|class.*TypedDict|@dataclass|class.*Enum|NewType|TypeAlias`
   - `class.*Config|class.*Settings|class.*Options`
   - `class.*Driver|class.*Client|class.*Connection|class.*Session`
2. **Read EVERY matched file** — not just the class name. Read the full file with all fields and methods.
3. **Build a Type Inventory** — you must know: config types, driver/client types, domain models, enums, type aliases.
4. **For every parameter you're about to write** — verify the type exists. If it does, use it. If it doesn't, CREATE it. Never use `Any`.

**Step B — Read all project documentation:**

Read every `.md` that provides context: `AGENTS.md`, `PROGRESS.md`, `DECISIONS.md`, `docs/GRAPH.md`, `docs/codebase-map.md`, `docs/business/*.md`, and the relevant spec. These files prevent you from contradicting locked decisions, re-inventing existing patterns, or misunderstanding domain rules.

**Step C — Read code-quality reference files:**

1. **Read design principles** — [code-quality/references/design-principles.md](../code-quality/references/design-principles.md). All 13 principles.
2. **Read language rules** — [code-quality/references/python/rules.md](../code-quality/references/python/rules.md) or [code-quality/references/rust/rules.md](../code-quality/references/rust/rules.md). Naming, types, Pydantic/serde, enums, logging, flat functions, etc.
3. **Read language examples** — [code-quality/references/python/examples.md](../code-quality/references/python/examples.md) or [code-quality/references/rust/examples.md](../code-quality/references/rust/examples.md). See patterns in real code.
4. **If designing new components:** Read [code-quality/references/design-patterns.md](../code-quality/references/design-patterns.md).

**Pass the comprehension self-check** (all 7 must be YES):
- [ ] Can I list every type in this project's Type Inventory? (config types, driver types, domain models, enums, type aliases)
- [ ] For the code I'm about to write, do I know the EXACT type for every parameter? (not `Any`, not `object` — the real type)
- [ ] Can I name all 13 design principles and what violation each prevents?
- [ ] Can I recognize at least one violation signal for each principle?
- [ ] Do I know all 11 tooling rules (types, DI, enums, naming, logging, exceptions, lint, type-check, no-water, flat-functions, init-files)?
- [ ] Do I know what code I'm about to write and which rules are most relevant?
- [ ] If I encountered a violation while reviewing, do I know the correct fix pattern?

**If ANY answer is NO:** Re-read the reference or re-run type discovery. Do not write code.

**Announce:** "Type inventory: [N types discovered]. Read [N] reference files. Read [N] doc files. Comprehension check: [PASS/FAIL]."

#### INVOKE execution skill — with TDD and debugging layered in

**If subagent-driven (recommended):** Invoke `superpowers:subagent-driven-development`

Each subagent MUST:
- Follow `superpowers:test-driven-development` — Red-Green-Refactor, no code before tests
- Follow code-quality rules — all 13 design principles + language-specific rules
- Use `superpowers:systematic-debugging` on any failure — root cause first, never guess
- Self-review against both spec and quality before reporting
- Report status using DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED

The conductor (this session) runs two-stage review after each subagent:
- **Stage 1 — Spec compliance:** Does the code match the spec? All behaviors, all types, no scope creep.
- **Stage 2 — Code quality review:** Spawn an independent review agent per [code-quality/references/review-agent.md](../code-quality/references/review-agent.md) to audit against all design principles + tooling rules.

Both stages must pass. Fix issues, re-review. Only then move to the next task.

**If inline execution:** Invoke `superpowers:executing-plans`

Follow each plan step, applying:
- `superpowers:test-driven-development` — failing test first, every time
- Code-quality rules — continuously, on every line
- `superpowers:systematic-debugging` — on any failure, immediately

#### Harness rules that apply DURING implementation (non-negotiable)

These rules layer on top of whatever execution skill is running:

1. **WIP=1** — only one feature active at a time. Finish or block before starting another.
2. **No placeholders** — `pass`, `todo!()`, `raise NotImplementedError`, `# TODO` are forbidden in committed code. Every function is complete or doesn't exist yet.
3. **Auto-track after every commit** — run the Phase 7 Auto-Track Checklist immediately after each commit. Do not wait until "done."
4. **Code-quality compliance** — every line must pass:
   - Types fully parameterized (no bare `dict`/`list`/`set`/`tuple`)
   - Pydantic/serde at I/O boundaries
   - Enums for all fixed choice sets (no magic strings)
   - Structured logging (no `print()`)
   - No bare exceptions
   - Flat functions (no nested `def`)
   - No water (every line earns its place)
   - DI for external dependencies (constructor-injected)

#### AFTER implementation completes — harness state updates

1. **Update `PROGRESS.md`** — feature progress %, tasks completed
2. **Update `docs/GRAPH.md`** — add new code flows with IN/OUT/ADDS/COMPUTES
3. **Update `docs/codebase-map.md`** — add new files, update changed files
4. **Update `docs/business/<domain>.md`** — if business rules were implemented
5. **Update `DECISIONS.md`** — if architectural decisions were made during implementation

---

### Phase 6: VERIFY — Iron Law + 3-Layer Pipeline + Code Quality Review

This phase combines three verification systems.

#### Step 1: Invoke `superpowers:verification-before-completion`

Enforce the Iron Law: **no completion claims without fresh verification evidence from THIS session.**

The skill's gate function:
1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
5. ONLY THEN: Make the claim

#### Step 2: Run the harness 3-layer verification pipeline

From [references/verification.md](references/verification.md):

| Layer | What | Command (default) | Required For |
|-------|------|-------------------|-------------|
| **1 — Static** | Lint + type check | `ruff check src/` + `mypy src/ --strict` | Every change |
| **2 — Runtime** | Unit + integration tests | `pytest tests/ -x` | Every change |
| **3 — System** | E2E / smoke test | `pytest tests/ -x -m e2e` | Cross-component changes |

**Sequence is mandatory.** Do not proceed to layer 2 if layer 1 fails. Do not proceed to layer 3 if layer 2 fails.

#### Step 3: Code quality review — spawn independent review agent

After all 3 layers pass, spawn an independent code quality review:

- Load [code-quality/references/review-agent.md](../code-quality/references/review-agent.md)
- Spawn a review agent that audits the diff against all 13 design principles + all tooling rules
- The review agent checks independently — it does NOT trust the implementer's self-assessment
- Fix every MAJOR and BLOCKING finding. Re-run verification after fixes.

#### The Completion Gate

ALL of these must be TRUE before claiming done:

```
COMPLETION GATE — all must be TRUE:
1. Layer 1 ran THIS session, AFTER last code change    → paste output
2. Layer 2 ran THIS session, AFTER last code change    → paste output
3. Layer 3 ran THIS session (if required)              → paste output
4. Every output shows ZERO failures                    → no "expected failures"
5. Evidence is recorded in verification file           → file path cited
6. Code quality review passed                          → MAJOR/BLOCKING findings = 0
7. Spec compliance confirmed                           → all spec behaviors implemented
```

**If ANY item is FALSE, you are NOT done.** See [references/verification.md](references/verification.md) § "Rationalization Prevention."

#### AFTER verification passes — harness state updates

1. **Update `PROGRESS.md`** — feature state → `passing`, link verification evidence
2. **Record evidence** — save verification output to `docs/verification/` or inline in PROGRESS.md
3. Run full Phase 7 Auto-Track Checklist

---

### Phase 7: TRACK — Auto-Update ALL Harness Files (Harness-Specific)

**This is NOT optional. No superpowers delegation. This is pure harness work.**

After EVERY implementation, EVERY verification pass, EVERY decision made — update the harness files immediately. Do not batch. Do not defer.

#### 7a. The Auto-Track Checklist

Run after EVERY code change, commit, or decision:

```
Auto-Track Checklist:
- [ ] PROGRESS.md — feature state change? Mark NOW. Progress % accurate? Update NOW.
- [ ] DECISIONS.md — architectural choice made? Record NOW (what, why, alternatives rejected).
- [ ] docs/GRAPH.md — new/modified code flow? Document NOW (IN/OUT/ADDS/COMPUTES, mermaid diagram).
- [ ] docs/codebase-map.md — file created/deleted/renamed? Update NOW (path, role, dependencies).
- [ ] docs/business/<domain>.md — new/changed business rule? Document NOW (rule, reason, implementation file:line).
- [ ] AGENTS.md — new convention, command, constraint, or topic doc? Add NOW.
- [ ] Spec doc — difference between spec and what was built? Update NOW.
- [ ] Plan doc — task completed/blocked? Update NOW.
```

**Gate: If any applicable item is unchecked, you are NOT done.**

#### 7b. When Auto-Track Fires

| Trigger | Update |
|---------|--------|
| After Phase 2 (CLARIFY) completes | PROGRESS.md (clarified, link spec), DECISIONS.md |
| After Phase 3 (SPEC) is approved | PROGRESS.md (specced, link spec) |
| After Phase 4 (PLAN) is approved | PROGRESS.md (planned, feature → active) |
| After each commit during Phase 5 | PROGRESS.md (%), GRAPH.md (flows), codebase-map.md (files), business.md (rules) |
| After Phase 6 (VERIFY) passes | PROGRESS.md (passing + evidence), full checklist |
| After any architectural decision | DECISIONS.md |
| After any new convention | AGENTS.md |
| After any file create/delete/rename | codebase-map.md |

---

### Phase 8: SESSION END — Clock Out (Harness-Specific)

Follow [references/session-discipline.md](references/session-discipline.md) clock-out checklist. ALL 8 items must pass:

```
Session Exit Checklist:
- [ ] make check passes (lint + type-check + ALL tests)
- [ ] PROGRESS.md updated (completed items marked, in-progress accurate, next steps clear)
- [ ] DECISIONS.md updated (any new decisions with full rationale)
- [ ] All work committed with clean, descriptive messages
- [ ] No debug code, print(), commented-out code, or stale TODOs in the diff
- [ ] No temporary files, debug logs, scratch scripts in working tree
- [ ] Standard startup path works (make dev or equivalent)
- [ ] AGENTS.md updated if new conventions or topic docs were introduced
```

---

## Phase Flow Diagram

```
SESSION START (harness)
    | clock-in: read PROGRESS.md, DECISIONS.md, run make check
    |
CLARIFY
    | BEFORE: read GRAPH.md, codebase-map, business docs, grep for overlaps
    | INVOKE: superpowers:brainstorming → design + spec
    | AFTER:  update PROGRESS.md (active), DECISIONS.md, business docs
    |
SPEC (if brainstorming skipped)
    | Write spec manually per doc-first template
    |
PLAN
    | BEFORE: verify spec exists, check WIP=1, read GRAPH.md, load task-management rules
    | INVOKE: superpowers:writing-plans → bite-sized tasks
    | AFTER:  update PROGRESS.md (planned), verify plan ↔ GRAPH.md alignment
    |
IMPLEMENT
    | BEFORE: codebase type discovery → read all .md docs → code-quality comprehension gate
    | INVOKE: superpowers:subagent-driven-development OR executing-plans
    |         + superpowers:test-driven-development (Red-Green-Refactor)
    |         + superpowers:systematic-debugging (on failure)
    |         + code-quality rules (every line)
    | DURING: WIP=1, no placeholders, auto-track after every commit
    | AFTER:  update PROGRESS.md, GRAPH.md, codebase-map.md, business docs, DECISIONS.md
    |
VERIFY
    | INVOKE: superpowers:verification-before-completion (Iron Law)
    | RUN:    3-layer pipeline (static → runtime → system)
    | SPAWN:  code-quality review agent (independent audit)
    | GATE:   completion gate (7 items, all TRUE)
    | AFTER:  update PROGRESS.md (passing + evidence)
    |
TRACK
    | Run full auto-track checklist (all 8 items)
    | Commit all harness file updates
    |
SESSION END (harness)
    | clock-out: 8-item exit checklist
```

---

## Diagnostic Loop (when something fails)

**INVOKE `superpowers:systematic-debugging`** for 4-phase root cause analysis (investigate → pattern analysis → hypothesis → fix).

**THEN apply the harness-specific layer diagnosis:**

1. **What failed?** — exact error message, expected vs actual
2. **Which harness layer?** — spec / context / environment / verification / state
3. **What's the fix?** — specific to the layer
4. **Apply the fix to the harness** — so this class of failure never happens again
5. **Retry** — run verification again from layer 1

| Layer | Example Failure | Harness Fix |
|-------|----------------|-------------|
| **Spec** | "I built X but you wanted Y" | Clarify spec. Run brainstorming again for the ambiguous part. |
| **Context** | "I used raw SQL because I didn't know the rule" | Add the rule to AGENTS.md hard constraints. |
| **Environment** | "Module not found: pydantic" | Fix pyproject.toml. Add to `make setup`. |
| **Verification** | "Tests pass but E2E fails — migration not run" | Add migration step to `make check`. |
| **State** | "I re-implemented something already done" | Update PROGRESS.md more clearly. Read it at clock-in. |

---

## Quick Reference

| Phase | BEFORE (Harness) | INVOKE (Skill) | AFTER (Harness) |
|-------|-------------------|----------------|-----------------|
| 1. SESSION START | Clock-in, read state files, make check | — | — |
| 2. CLARIFY | Read GRAPH, codebase-map, business docs | `superpowers:brainstorming` | PROGRESS, DECISIONS, business docs |
| 3. SPEC | (only if brainstorming skipped) | — | PROGRESS |
| 4. PLAN | Verify spec, WIP=1, read GRAPH, task rules | `superpowers:writing-plans` | PROGRESS (planned) |
| 5. IMPLEMENT | Type discovery → read all docs → code-quality gate (7 checks) | `subagent-driven-dev` or `executing-plans` + `TDD` + `debugging` + `code-quality` | PROGRESS, GRAPH, codebase-map, DECISIONS |
| 6. VERIFY | — | `verification-before-completion` + 3-layer pipeline + code-quality review agent | PROGRESS (passing + evidence) |
| 7. TRACK | — | — | Full auto-track checklist |
| 8. SESSION END | Clock-out, 8-item exit checklist | — | — |
