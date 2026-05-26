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
| [references/hooks.md](references/hooks.md) | Bootstrap — hook scripts, `.harness-state` format, phase transitions |

---

## Bootstrap Gate — DO THIS FIRST

**Before answering the user, before reading any reference, before ANY other action — check whether harness files exist.** A project without these files has no harness. Creating them is the agent's first and only job.

Execute these checks immediately. For each file that is missing, CREATE it using the template from the reference:

| # | Check | If Missing — What to Do |
|---|-------|--------------------------|
| 1 | `AGENTS.md` or `CLAUDE.md` | [references/repo-system.md](references/repo-system.md) § "Minimal Template" — create from template |
| 2 | `PROGRESS.md` | [references/session-discipline.md](references/session-discipline.md) § "PROGRESS.md — The Agent's Memory" — create from template |
| 3 | `DECISIONS.md` | [references/session-discipline.md](references/session-discipline.md) § "DECISIONS.md — The Agent's Rationale" — create from template |
| 4 | `docs/GRAPH.md` | **READ the source code first**, then create with real code flows — see "Populate from Code" below |
| 5 | `docs/codebase-map.md` | **READ the source code first**, then create with real file roles — see "Populate from Code" below |
| 6 | `Makefile` | [references/workflow.md](references/workflow.md) § "Init Acceptance Checklist" — create with targets: setup, test, lint, check, dev |
| 7 | `docs/business/*.md` | **READ the source code first**, then create with real business rules — see "Populate from Code" below |
| 8 | `docs/specs/` | Create the directory (empty, ready for per-feature specs) |
| 9 | `.env.example` | Create with all required env vars documented (no real values) |
| 10 | `.harness-state` | Create with initial state — see [references/hooks.md](references/hooks.md) § "State File" |
| 11 | `.claude/hooks/*.js` | Create all 4 hook scripts from [references/hooks.md](references/hooks.md) § "Hook Scripts" |
| 12 | `.claude/settings.json` hooks | Merge hook config from [references/hooks.md](references/hooks.md) § "Settings Configuration" into existing settings |

**Item 10 — `.harness-state` (gitignored, session-specific):**

Create in project root with initial state. Add `.harness-state` to `.gitignore` if not already present:

```json
{
  "phase": "session-start",
  "docs_read": false,
  "code_quality_loaded": false,
  "codebase_read": false,
  "comprehension_gate": false,
  "tests_passed": false,
  "docs_updated": false,
  "verification_passed": false
}
```

**Items 11-12 — Hook enforcement scripts + settings:**

Create `.claude/hooks/` directory with 4 scripts (pre-edit-gate.js, pre-commit-gate.js, pre-push-gate.js, session-end-check.js) from [references/hooks.md](references/hooks.md). Merge the hook configuration into `.claude/settings.json`. These hooks enforce:

| Hook | Blocks | Until |
|------|--------|-------|
| pre-edit-gate | Edit/Write on code files | Phase = `implement` + ALL FOUR: `docs_read` + `code_quality_loaded` + `codebase_read` + `comprehension_gate` |
| pre-commit-gate | `git commit` | `tests_passed` + `docs_updated` = both true |
| pre-push-gate | `git push` | `verification_passed` = true |
| session-end-check | (advisory on Stop) | Reminds about exit checklist |

### Populate from Code — Do NOT Create Empty Files

**Items 4, 5, and 7 require reading the actual source code.** An empty template is useless — it gives the next agent zero context. When these files are missing, the agent MUST:

1. **Glob/Grep the entire codebase** — find all `.py`/`.rs` files, understand the directory structure
2. **Read the source files** — understand what each module does, what business rules are encoded, how data flows
3. **Write real documentation** — not templates, not placeholders, real content based on what the code actually does

#### 4. `docs/GRAPH.md` — Code Flow Graph

Read the source code and document how data flows through the system:

```markdown
# Code Flow Graph

## User Registration Flow
IN: POST /auth/register (CreateUserRequest)
→ auth_service.register(request)
→ password_service.hash(request.password)
→ user_repo.create(user)
→ email_service.send_welcome(user.email)
OUT: UserResponse (201)

## Order Processing Flow
IN: POST /orders (CreateOrderRequest)
→ order_service.create(request)
→ pricing.calculate(items) COMPUTES total, tax, shipping
→ inventory.reserve(items) ADDS reservation
→ order_repo.save(order)
→ notification.send(order) ADDS email queue entry
OUT: OrderResponse (201)
```

#### 5. `docs/codebase-map.md` — File Roles

Read every directory and key file, document what each one does:

```markdown
# Codebase Map

## Directory Structure
- `src/api/` — HTTP endpoints (FastAPI routes)
- `src/services/` — Business logic orchestration
- `src/repositories/` — Database queries (Neo4j/PostgreSQL)
- `src/models/` — Domain models, Pydantic schemas, enums
- `src/core/` — Config, database connection, logging setup
- `tests/` — Unit and integration tests

## Key Files
- `src/core/config.py` — AppConfig (Pydantic settings, all env vars)
- `src/models/checkpoint.py` — Checkpoint class (pipeline state tracking)
- `src/services/committee.py` — Committee pipeline (multi-agent analysis)
```

#### 7. `docs/business/*.md` — Business Rules

**This is the most critical one.** Without business docs, every future agent will misunderstand the domain.

**Two sources — use both:**

1. **Read the source code** — search for constants (`THRESHOLD`, `MAX_`), conditionals in services (`if score < ...`), validations, enums, and test names. Extract what you can understand from the code.
2. **Ask the user** — the code doesn't capture everything. Ask the user about the business domain: "What does this system do? What are the key business rules? What edge cases matter?" The user knows context that isn't in the code.

**Write the docs from both sources.** Code tells you WHAT the rules are. The user tells you WHY they exist and what's missing from the code.

```markdown
# Committee Pipeline Rules

## Agent Voting
- Rule: Each agent produces a verdict (buy/sell/hold) with a confidence score 0.0-1.0
- Rule: Committee verdict requires ≥60% agent agreement (COMMITTEE_THRESHOLD = 0.6)
- Rule: If confidence < 0.5 for any agent, that vote is excluded from the tally
- Implemented: src/services/committee.py:89 (tally_votes)

## Checkpoint Recovery
- Rule: Pipeline checkpoints save after each agent completes, not at the end
- Rule: On restart, completed agents are skipped (checkpoint has their results)
- Implemented: src/models/checkpoint.py:23 (Checkpoint.load, Checkpoint.save)
```

**Gate rule:** If >=1 files are missing, the agent's entire response is: report which files are missing, create them all (with REAL content from the codebase for items 4, 5, 7), then report done. Do NOT take any other action until the bootstrap gate passes.

**Gate passes when:** All 12 checks above exist on disk AND items 4, 5, 7 contain real content (not empty templates) AND hooks are configured (items 10-12). Only then proceed to Phase 1 — which READS every file.

**CRITICAL:** Creating files is NOT using them. The bootstrap gate ensures files EXIST with real content. Phase 1 ensures you READ them. Both gates must pass.

---

## The Outer Loop — Conductor Protocol

Once the bootstrap gate passes, **every user task** flows through these eight phases in strict order. Never skip a phase. Never reorder. Never jump to implementation.

---

### Phase 1: SESSION START — Clock In (Harness-Specific)

Follow [references/session-discipline.md](references/session-discipline.md) clock-in sequence. This is NOT optional. **You must READ every harness file, not just verify it exists.**

**Step 1 — Read ALL harness state files (MANDATORY):**

Read every single one. Not "check if it exists" — OPEN and READ the full content. **If any doc file is empty or a bare template, treat it as missing — read the source code and populate it NOW before proceeding.**

1. **Read `AGENTS.md` or `CLAUDE.md`** — project conventions, hard constraints, architecture rules, topic doc links. This tells you HOW to work in this codebase.
2. **Read `PROGRESS.md`** — what's completed, what's in progress, known issues, next steps. This tells you WHERE the project is.
3. **Read `DECISIONS.md`** — locked architectural choices, rejected alternatives, imposed constraints. This tells you what NOT to change.
4. **Read `docs/GRAPH.md`** — code flow connections. **If empty/template:** read the source code, trace the data flows, and write real flow documentation NOW.
5. **Read `docs/codebase-map.md`** — file roles and dependencies. **If empty/template:** Glob the project, read key files, and write real file descriptions NOW.
6. **Read `docs/business/*.md`** — all business rule docs. **If the directory is empty:** read the source code to extract what you can, then ASK the user about the business domain ("What does this system do? What are the key rules?"). Write the business docs from both sources — code tells you WHAT, the user tells you WHY.
7. **Read `docs/specs/*.md`** — at minimum the spec for the current task. This tells you WHAT to build.

**Step 2 — Run `make check`:**

Confirm the repo is in a consistent state. See [references/verification.md](references/verification.md).

**Step 3 — Handle failures:**

If `make check` fails, diagnose BEFORE starting new work. Never build on a broken foundation.

**Step 4 — Announce understanding:**

After reading all files, the agent MUST announce: "Clock-in complete. Read [N] harness files. Project state: [summary]. Current task: [what]. Locked decisions: [key constraints]."

**Step 5 — Confirm `.harness-state` is current:**

The `.harness-state` file tracks this session's phase. If it exists from a prior session, reset it:

```json
{
  "phase": "session-start",
  "docs_read": false,
  "code_quality_loaded": false,
  "codebase_read": false,
  "comprehension_gate": false,
  "tests_passed": false,
  "docs_updated": false,
  "verification_passed": false
}
```

**Gate:** ALL harness files read (not just checked for existence), repo state understood, `make check` passes (or failures documented in PROGRESS.md Known Issues), `.harness-state` shows `phase: "session-start"`.

**Anti-pattern — the "create and forget" agent:**
```
❌ Bootstrap: "docs/business/ missing, creating it." → immediately starts coding
   (Created the directory but never read any .md files — has zero project context)

✓ Bootstrap: "docs/business/ missing, creating it."
  Phase 1: "Reading AGENTS.md... Reading PROGRESS.md... Reading DECISIONS.md...
  Reading GRAPH.md... Reading codebase-map.md... Reading business docs... Reading specs...
  Clock-in complete. Read 7 harness files. Project state: 3 features done, pagination in progress.
  Locked decisions: SQLAlchemy 2.0, Pydantic at boundaries. Current task: add user avatar upload."
```

---

### Phase 2: CLARIFY — Business Discovery + Design + Spec

**State transition:** Update `.harness-state` → `"phase": "clarify"`

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

**State transition:** Update `.harness-state` → `"phase": "plan"`

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

**State transition:** Update `.harness-state` → `"phase": "implement"`, all implementation flags `false` (`docs_read`, `code_quality_loaded`, `codebase_read`, `comprehension_gate`, `docs_updated`)

This is the most skill-heavy phase. Three skills work together, with code-quality rules governing everything.

**Hook enforcement:** The pre-edit-gate hook now BLOCKS Edit/Write on code files. The hook checks `.harness-state` and denies code edits until ALL FOUR gates pass: `docs_read`, `code_quality_loaded`, `codebase_read`, AND `comprehension_gate`. Each gate has its own deny message telling the agent exactly what to do next.

#### BEFORE invoking execution — 4-gate unlock sequence

The agent must pass four gates in order before editing ANY code file. The pre-edit-gate hook enforces this mechanically — the agent physically cannot edit code until all four are `true`.

**Gate 1 — Read all harness docs (MANDATORY):**

**Read EVERY harness .md file.** This ensures the agent knows what exists, what's decided, what's in progress, and how the code flows — before touching anything. The hook blocks code edits without it.

1. **Read `AGENTS.md` or `CLAUDE.md`** — project conventions, hard constraints, architecture rules
2. **Read `PROGRESS.md`** — what's completed, in progress, known issues
3. **Read `DECISIONS.md`** — locked architectural choices, rejected alternatives
4. **Read `docs/GRAPH.md`** — code flow connections (IN/OUT/ADDS/COMPUTES)
5. **Read `docs/codebase-map.md`** — file roles and dependencies
6. **Read `docs/business/*.md`** — all business rule docs
7. **Read `docs/specs/*.md`** — at minimum the spec for the current task

**When complete:** Update `.harness-state` → `"docs_read": true`

**Gate 2 — Load code-quality skill (MANDATORY):**

**Load [code-quality](../code-quality/SKILL.md) and read ALL its references.** This is mandatory — the hook blocks code edits without it.

1. **Invoke the code-quality skill** — load the full skill content
2. **Read design principles** — [code-quality/references/design-principles.md](../code-quality/references/design-principles.md). All 13 principles.
3. **Read language rules** — [code-quality/references/python/rules.md](../code-quality/references/python/rules.md) or [code-quality/references/rust/rules.md](../code-quality/references/rust/rules.md).
4. **Read language examples** — [code-quality/references/python/examples.md](../code-quality/references/python/examples.md) or [code-quality/references/rust/examples.md](../code-quality/references/rust/examples.md).
5. **If designing new components:** Read [code-quality/references/design-patterns.md](../code-quality/references/design-patterns.md).

**When complete:** Update `.harness-state` → `"code_quality_loaded": true`

**Gate 3 — Read the codebase (MANDATORY):**

**Read ALL existing source code in the affected area.** The agent must see the code before changing it. The hook blocks code edits without it.

1. **Glob/Grep for all type definitions** — models, configs, drivers, enums, type aliases. Search patterns:
   - `class.*BaseModel|class.*TypedDict|@dataclass|class.*Enum|NewType|TypeAlias`
   - `class.*Config|class.*Settings|class.*Options`
   - `class.*Driver|class.*Client|class.*Connection|class.*Session`
2. **Read EVERY matched file** — not just the class name. Read the full file with all fields and methods.
3. **Read ALL source files in the area being modified** — if you're changing `src/services/`, read every file in `src/services/`. If you're adding a new endpoint, read the existing endpoints.
4. **Read all project documentation** — `AGENTS.md`, `PROGRESS.md`, `DECISIONS.md`, `docs/GRAPH.md`, `docs/codebase-map.md`, `docs/business/*.md`, and the relevant spec.
5. **Build a Type Inventory** — you must know: config types, driver/client types, domain models, enums, type aliases. For every parameter you're about to write, the type must exist or be created. Never use `Any`.

**When complete:** Update `.harness-state` → `"codebase_read": true`

**Gate 4 — Pass comprehension check (MANDATORY):**

**Pass the 7-item self-check.** All must be YES. The hook blocks code edits without it.

**Pass the comprehension self-check** (all 7 must be YES):
- [ ] Can I list every type in this project's Type Inventory? (config types, driver types, domain models, enums, type aliases)
- [ ] For the code I'm about to write, do I know the EXACT type for every parameter? (not `Any`, not `object` — the real type)
- [ ] Can I name all 13 design principles and what violation each prevents?
- [ ] Can I recognize at least one violation signal for each principle?
- [ ] Do I know all 11 tooling rules (types, DI, enums, naming, logging, exceptions, lint, type-check, no-water, flat-functions, init-files)?
- [ ] Do I know what code I'm about to write and which rules are most relevant?
- [ ] If I encountered a violation while reviewing, do I know the correct fix pattern?

**If ANY answer is NO:** Re-read the reference or re-run type/code discovery. Do not write code.

**When ALL answers are YES:** Update `.harness-state` → `"comprehension_gate": true`. All four gates are now `true` — the pre-edit-gate hook unlocks and code edits are allowed.

**Announce:** "Gate 1 (docs): read [N] harness files. Gate 2 (code-quality): loaded [N] references. Gate 3 (codebase): read [N] source files, [N] types. Gate 4 (comprehension): PASS. All edit gates unlocked."

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
4. **Test gate for commits** — after tests pass, update `.harness-state` → `"tests_passed": true`. After any subsequent code edit, reset `"tests_passed": false`. The pre-commit-gate hook blocks `git commit` until `tests_passed` is `true`.
5. **Docs gate for commits** — after updating all harness .md files (PROGRESS.md, GRAPH.md, codebase-map.md, DECISIONS.md, business docs), update `.harness-state` → `"docs_updated": true`. After any subsequent code edit, reset `"docs_updated": false`. The pre-commit-gate hook blocks `git commit` until BOTH `tests_passed` AND `docs_updated` are `true`.
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

**State transition:** Update `.harness-state` → `"phase": "verify"`

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

1. **Update `.harness-state`** → `"verification_passed": true`. This unlocks the pre-push-gate hook — `git push` is now allowed.
2. **Update `PROGRESS.md`** — feature state → `passing`, link verification evidence
3. **Record evidence** — save verification output to `docs/verification/` or inline in PROGRESS.md
4. Run full Phase 7 Auto-Track Checklist

---

### Phase 7: TRACK — Auto-Update ALL Harness Files (Harness-Specific)

**State transition:** Update `.harness-state` → `"phase": "track"`

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

**State transition:** Update `.harness-state` → `"phase": "session-end"`

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
SESSION START (harness)                          .harness-state → phase: "session-start"
    | clock-in: READ all .md files, run make check, reset .harness-state
    |
CLARIFY                                          .harness-state → phase: "clarify"
    | BEFORE: read GRAPH.md, codebase-map, business docs, grep for overlaps
    | INVOKE: superpowers:brainstorming → design + spec
    | AFTER:  update PROGRESS.md (active), DECISIONS.md, business docs
    | HOOK:   pre-edit-gate BLOCKS code edits (phase != implement)
    |
SPEC (if brainstorming skipped)
    | Write spec manually per doc-first template
    |
PLAN                                             .harness-state → phase: "plan"
    | BEFORE: verify spec exists, check WIP=1, read GRAPH.md, load task-management rules
    | INVOKE: superpowers:writing-plans → bite-sized tasks
    | AFTER:  update PROGRESS.md (planned), verify plan ↔ GRAPH.md alignment
    | HOOK:   pre-edit-gate BLOCKS code edits (phase != implement)
    |
IMPLEMENT                                        .harness-state → phase: "implement"
    | GATE 1: read all harness .md files                    → docs_read: true
    | GATE 2: invoke code-quality skill + read all refs     → code_quality_loaded: true
    | GATE 3: read all source files + build type inventory  → codebase_read: true
    | GATE 4: pass 7-item self-check                        → comprehension_gate: true
    | HOOK:   pre-edit-gate UNBLOCKS code edits (all 4 gates true)
    | INVOKE: superpowers:subagent-driven-development OR executing-plans
    |         + superpowers:test-driven-development (Red-Green-Refactor)
    |         + superpowers:systematic-debugging (on failure)
    |         + code-quality rules (every line)
    | DURING: WIP=1, no placeholders, auto-track after every commit
    | TESTS:  tests pass → .harness-state tests_passed: true
    | DOCS:   update all .md files → .harness-state docs_updated: true
    | HOOK:   pre-commit-gate UNBLOCKS git commit (tests_passed + docs_updated)
    | AFTER:  update PROGRESS.md, GRAPH.md, codebase-map.md, business docs, DECISIONS.md
    |
VERIFY                                           .harness-state → phase: "verify"
    | INVOKE: superpowers:verification-before-completion (Iron Law)
    | RUN:    3-layer pipeline (static → runtime → system)
    | SPAWN:  code-quality review agent (independent audit)
    | GATE:   completion gate (7 items, all TRUE)
    | PASS:   → .harness-state verification_passed: true
    | HOOK:   pre-push-gate UNBLOCKS git push (verification_passed=true)
    | AFTER:  update PROGRESS.md (passing + evidence)
    |
TRACK                                            .harness-state → phase: "track"
    | Run full auto-track checklist (all 8 items)
    | Commit all harness file updates
    |
SESSION END (harness)                            .harness-state → phase: "session-end"
    | clock-out: 8-item exit checklist
    | HOOK:   session-end-check reminds about exit checklist
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

| Phase | State | BEFORE (Harness) | INVOKE (Skill) | AFTER (Harness) | Hook Gate |
|-------|-------|-------------------|----------------|-----------------|-----------|
| 1. SESSION START | `session-start` | Clock-in: READ all .md files, make check, reset `.harness-state` | — | — | — |
| 2. CLARIFY | `clarify` | Read GRAPH, codebase-map, business docs | `superpowers:brainstorming` | PROGRESS, DECISIONS | code edits blocked |
| 3. SPEC | — | (only if brainstorming skipped) | — | PROGRESS | code edits blocked |
| 4. PLAN | `plan` | Verify spec, WIP=1, read GRAPH, task rules | `superpowers:writing-plans` | PROGRESS (planned) | code edits blocked |
| 5. IMPLEMENT | `implement` | 4-gate unlock: `docs_read` → `code_quality_loaded` → `codebase_read` → `comprehension_gate` | `subagent-driven-dev` or `executing-plans` + `TDD` + `debugging` + `code-quality` | PROGRESS, GRAPH, codebase-map | edits blocked until all 4 gates; commits blocked until `tests_passed` + `docs_updated` |
| 6. VERIFY | `verify` | — | `verification-before-completion` + 3-layer pipeline + review agent → `verification_passed: true` | PROGRESS (passing) | push blocked until `verification_passed` |
| 7. TRACK | `track` | — | — | Full auto-track checklist | all unlocked |
| 8. SESSION END | `session-end` | Clock-out, 8-item exit checklist | — | — | exit warnings |
