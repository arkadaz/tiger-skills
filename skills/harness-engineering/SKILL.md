---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the instructions, tools, environment, state, and feedback systems that make agents reliable. Use this skill whenever the user mentions setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / PROGRESS.md, session management, feature tracking, verification pipelines, task breakdowns, git workflow for agents, or anything related to "harness engineering." Also use when the user asks "how do I make this agent work better" or reports that an agent keeps failing. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering

The discipline of building everything outside the model that makes AI coding agents reliable. The core insight: **the same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When agents fail, fix the harness first, not the model.

## Core Philosophy

A harness has five subsystems. All five must be present:

| Subsystem | What It Is | Concrete Forms |
|-----------|-----------|----------------|
| **Instructions** | What the agent should know and enforce | `AGENTS.md` / `CLAUDE.md`, topic docs |
| **Tools** | What the agent can execute | Shell, git, package manager, linter, test runner |
| **Environment** | Reproducible runtime | `pyproject.toml`, lock files, Docker, devcontainers |
| **State** | Progress + decisions across sessions | `PROGRESS.md`, `DECISIONS.md`, git commits |
| **Feedback** | Explicit verification that work is correct | Verification commands, test suites, lint/type checks |

**The diagnostic loop:** Every failure must be attributed to one of five layers:
1. **Task specification** — ambiguous prompt? Add detail.
2. **Context provision** — missing convention? Add to AGENTS.md.
3. **Execution environment** — missing dep? Fix config.
4. **Verification feedback** — no test? Add verification command.
5. **State management** — lost progress? Create PROGRESS.md.

Fix that layer. Never fail the same way twice.

## 1. Repo as System of Record

The agent can see: system prompts, repo files, tool output. It CANNOT see: Slack, Jira, Confluence, your mental model, hallway conversations. Information not in the repo, for all practical purposes, does not exist for the agent.

### AGENTS.md / CLAUDE.md as Routing File

The entry instruction file MUST be a router, not an encyclopedia. Keep it under 150 lines. It answers exactly five questions:

1. What is this system? (2-3 sentence overview + stack)
2. How is it organized? (directory map, architecture at a glance)
3. How do I run it? (`make setup`, `make dev`, `make test`)
4. How do I verify it? (`make check` or equivalent)
5. What are the hard constraints? (≤15 rules that CANNOT be broken)

**Template:**
```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what this is, primary stack]

## Quick Start
- Install: `make setup`
- Run dev: `make dev`
- Test: `make test`
- Full verification: `make check`

## Hard Constraints
- [≤15 non-negotiable rules]
- Each rule = one line, active voice, MUST or MUST NOT

## Topic Docs
- [docs/topic.md](path) — when doing X
- [docs/topic.md](path) — when doing Y

## Verification Commands
- Lint: `ruff check src/`
- Type check: `mypy src/ --strict`
- Tests: `pytest tests/ -x`
- Full: `make check`
```

**Rules for the entry file:**
- If removing a rule wouldn't change agent behavior, delete it immediately
- Put critical constraints at the TOP or BOTTOM of the file (never buried in the middle — lost-in-the-middle effect)
- Manage instructions like dependencies: unused = deleted, outdated = updated with the code that changed them
- If the file exceeds 150 lines, split into topic docs — the entry file links to them with clear "when to read" conditions

### Topic Docs

Each topic doc: 50–150 lines, single subject, loaded only when the agent's task matches its trigger condition.

**Structure:**
```
project/
├── AGENTS.md              # Router: overview, run, hard constraints
├── docs/
│   ├── api-patterns.md     # When adding/modifying API endpoints
│   ├── database-rules.md   # When modifying DB schema or queries
│   ├── testing-standards.md # When writing or modifying tests
│   └── architecture.md     # When changing cross-cutting concerns
├── PROGRESS.md             # Current state (machine-updated)
├── DECISIONS.md            # Why we chose what we chose
└── Makefile                # setup, test, lint, check, dev
```

### Knowledge Visibility

Every piece of critical project knowledge MUST live in the repo. The cold-start test: a fresh agent session must be able to answer all five entry-file questions from the repo alone. If it can't, the harness is incomplete.

## 2. Session Discipline

Sessions are the unit of work. Every session must begin with a clock-in and end with a clock-out. There is no "I'll clean up later."

### Clock-In (Session Start)

At the start of every session, you MUST execute these steps in order:

1. Read `PROGRESS.md` — understand current state, what's in progress, known issues, next steps
2. Read `DECISIONS.md` — understand why past decisions were made
3. Run `make check` (or the project's full verification command) — confirm the repo is in a consistent state before touching anything
4. If `make check` fails, diagnose and fix BEFORE starting new work. Never build on a broken foundation.

### Clock-Out (Session End)

Before ending every session, you MUST execute this checklist. If any item fails, the session is NOT complete:

```
Session Exit Checklist:
- [ ] `make check` passes (or equivalent: lint + type-check + tests)
- [ ] PROGRESS.md updated (completed items marked, in-progress state updated, next steps clear)
- [ ] DECISIONS.md updated (any new architectural decisions recorded with rationale)
- [ ] All completed work committed with clean messages
- [ ] No debug code, print statements, commented-out code, or stale TODOs remain
- [ ] No temporary files, debug logs, or scratch scripts in the working tree
- [ ] Standard startup path works (`make dev` or equivalent)
- [ ] If new conventions/commands/constraints were introduced, AGENTS.md is updated
```

### PROGRESS.md

This file is the agent's memory across sessions. It MUST be updated at the end of every session.

```markdown
# Project Progress

## Current State
- Latest commit: <hash> (<message>)
- Test status: <N>/<M> passing
- Lint: <passing/failing>
- Type check: <passing/failing>

## Completed
- [x] <Feature/ task that is done, verified, committed>

## In Progress
- [ ] <Current task> (<X>% — <what's remaining>)

## Known Issues
- <Bug/issue description and any known context>

## Next Steps (ordered)
1. <Next action>
2. <Following action>
```

### DECISIONS.md

Record every architectural decision that another session might question. A decision without a recorded rationale will be undone.

```markdown
## Decision: <title>
- Date: <YYYY-MM-DD>
- Context: <what problem were we solving>
- Decision: <what we chose>
- Alternatives rejected: <what we considered and why we rejected each>
- Commit: <hash>
```

## 3. Task Management

### WIP = 1

The agent MUST work on exactly one feature at a time. Never activate a new task while another is incomplete. This is non-negotiable.

**Why:** More work-in-progress → longer lead time → higher failure probability (Little's Law). Anthropic's data: WIP=1 strategy shows 37% higher completion rate than broad prompts.

**Enforcement:**
- Before starting any new feature, check: is there an active feature in PROGRESS.md that isn't yet passing?
- If yes, finish it first. If no, mark the new feature as active and begin.
- Never "also refactor" or "also fix" unrelated code while implementing a feature.

### Feature Lists

Every feature MUST have the triple structure. Missing any one field = incomplete specification:

```json
{
  "id": "F03",
  "behavior": "POST /cart/items with {product_id, quantity} returns 201 and adds item to cart",
  "verification": "curl -X POST http://localhost:3000/api/cart/items -H 'Content-Type: application/json' -d '{\"product_id\":1,\"quantity\":2}' | jq .status == 201",
  "state": "passing",
  "evidence": "commit abc123, test output verified"
}
```

**Three required fields:**
1. **behavior** — what the feature does, in plain language
2. **verification** — an executable command that proves it works
3. **state** — one of: `not_started` | `active` | `passing` | `blocked`

**State machine rules:**
- Only one feature `active` at a time (WIP=1)
- Agent CANNOT self-declare `passing` — the verification command MUST succeed and produce evidence
- `blocked` means waiting on an external dependency or decision
- Transition from `active` → `passing` requires: verification command succeeds + evidence recorded

### Completion Evidence

"Code looks right" is not completion. Completion requires:
- Verification command executed AND passed
- Evidence saved (test output, curl result, screenshot)
- PROGRESS.md updated

### Parallel Agents for Independent Tasks

WIP=1 means one task per agent. But when the feature list contains multiple tasks that have NO shared state and NO sequential dependencies, spawn parallel subagents — one per task. This is the only exception to sequential execution.

**When to parallelize:**
- Tasks touch completely separate files with no overlap
- Task A's output is NOT required as input for Task B
- Tasks can be verified independently
- Each task is well-specified enough for an agent to complete solo

**When NOT to parallelize:**
- Tasks share files (merge conflicts, race conditions)
- Task B depends on Task A being finished first
- The codebase is unfamiliar and agents need to explore first
- One task's design decisions affect the other

**How to spawn parallel agents:**

1. Check PROGRESS.md for `not_started` tasks that qualify as independent
2. Mark all selected tasks as `active` simultaneously
3. Spawn one agent per task using the Agent tool with `run_in_background: true`
4. Each agent follows the standard flow: clock-in → spec → implement → verify → update docs → clock-out
5. Each agent works in its own context window — they cannot see each other's work mid-flight
6. When all agents complete, run `make check` on the merged result
7. Update PROGRESS.md with all results

**Critical rules for parallel work:**
- Each agent MUST commit its work before the others merge. No agent leaves uncommitted changes.
- If two agents touch the same file, the second to commit handles the merge conflict
- If any agent fails, stop the parallel batch and diagnose before spawning more
- After all parallel agents finish, run the full verification pipeline on the merged codebase
- Update `docs/codebase-map.md` after the merge to reflect all changes

**Example — valid parallel tasks:**
```
F04: Add user preferences endpoint   (src/api/preferences.py)
F05: Add email verification worker   (src/workers/email.py)
F06: Add health check endpoint       (src/api/health.py)
```
These touch different files, have no dependencies, and can be verified independently.

**Example — sequential only:**
```
F04: Add order database model       (src/models/order.py)
F05: Add order creation endpoint     (src/api/orders.py) — depends on F04
```
F05 needs F04's model to exist first. These MUST run sequentially.

## 4. Verification Pipeline

### Three-Layer Termination Check

All three layers must pass (skipping any required layer = not complete):

| Layer | What | Requirement |
|-------|------|-------------|
| **1 — Static** | Lint + type check | Zero errors. Always required. |
| **2 — Runtime** | Unit tests + integration tests | All pass. Always required. |
| **3 — System** | E2E tests, manual smoke test | Required when changes cross component boundaries |

**Sequence:** Do NOT proceed to layer 2 if layer 1 fails. Do NOT proceed to layer 3 if layer 2 fails. No "I'll fix the lint later."

### Definition of Done

Place this in every project's AGENTS.md:
```
## Definition of Done
A feature is complete ONLY when:
1. All three verification layers pass (static → runtime → system if applicable)
2. Verification evidence is recorded
3. Code is committed with a clean message
4. PROGRESS.md reflects the new state
5. Session exit checklist passes
```

### Worker ≠ Checker

The agent that writes code CANNOT be the sole judge of whether it works. Agents systematically over-rate their own output (Anthropic, 2026).

- Verification commands are the checker — they are mechanical, objective, and reproducible
- If a verification command passes, the feature passes — no human judgment needed
- If no verification command exists for a feature, the feature is not verifiable and therefore not done

### Error Messages That Actually Help

Verification failures must tell the agent HOW to fix them, not just WHAT failed:

Bad: `Test failed: test_create_order`

Good: `Test failed: test_create_order — POST /api/orders returned 500. Check that OrderRepository.save() handles duplicate ISBNs. The error originated in src/orders/repository.py:45.`

Every error message must include: **what failed** + **why it likely failed** + **where to look**.

## 5. Documentation-First Development

The agent MUST NOT jump straight to implementation. Every task flows through: **understand → document → get approval → implement → update docs.**

### Ask Before You Act

When given a task, if ANY of these are unclear, you MUST ask clarifying questions BEFORE writing code:

- The exact scope (what's in, what's out)
- The expected input/output types and formats
- Which existing code/files will be touched
- What "done" looks like (verification criteria)
- Priority relative to other in-progress work

Do not assume. Do not guess. A 30-second clarification saves a 30-minute wrong implementation.

### Spec Before Code

Before writing any implementation code for a non-trivial task, you MUST write a short spec document. Save it to `docs/specs/YYYY-MM-DD-<topic>.md`.

**Spec template:**
```markdown
# <Feature/Task Name>

## What
[2-3 sentences: what this does, from the user's perspective]

## Scope
- In: [what's included]
- Out: [what's explicitly excluded]

## Input/Output
- Input: [types, fields, validation rules]
- Output: [types, fields, meaning]

## Design
[Classes/functions to create or modify, data flow, dependencies]

## Files to Touch
- [path/to/file.py] — [what changes, why]
- [path/to/file.py] — [what changes, why]

## Verification
- [specific command that proves this works]

## Dependencies
- [anything this depends on — other features, external services, decisions]
```

After writing the spec, present it to the user for approval. Do NOT write implementation code until the spec is approved.

### Business Logic Documentation

Business rules and domain logic MUST live in version-controlled `.md` files, not just in code or conversation memory. Every significant business rule needs a written record.

**Where to save:**
- `docs/business/<domain>.md` — e.g., `docs/business/pricing.md`, `docs/business/auth.md`
- `src/<module>/README.md` — module-level rules next to the code they govern

**What to record:**
- What the rule is (in plain language)
- Why it exists (the business reason)
- Where it's implemented (file paths + line references)
- When it was added/last changed (date + commit)

**Example:**
```markdown
# Pricing Rules

## Free shipping over $50
- Rule: Orders with subtotal ≥ $50.00 get free standard shipping
- Reason: Marketing promotion, effective 2024-01-01
- Implemented: src/orders/pricing.py:45 (calculate_shipping)
- Last updated: 2024-03-15 (abc1234)

## Promo codes stack with limits
- Rule: Max 2 promo codes per order, applied in order of entry
- Reason: Prevent abuse, per CFO directive 2024-02
- Implemented: src/orders/promo.py:78 (apply_promos)
- Last updated: 2024-02-10 (def5678)
```

### Codebase Knowledge Map

The agent MUST maintain a living map of what the codebase does. This is the first thing a fresh session reads after PROGRESS.md.

Save to `docs/codebase-map.md`:

```markdown
# Codebase Map

## Directory Overview
src/
├── api/          — FastAPI route handlers, request/response models
├── services/     — Business logic, use cases
├── repositories/ — Database access, queries
├── models/       — ORM models, domain types
└── utils/        — Shared helpers (no business logic)

## Key Files
- src/api/orders.py — Order CRUD endpoints (POST /orders, GET /orders/{id})
- src/services/order_service.py — Order creation orchestration, pricing, validation
- src/repositories/order_repo.py — Order DB queries (save, find_by_id, find_by_customer)
- src/models/order.py — Order, OrderItem, OrderStatus ORM models

## Cross-Cutting Concerns
- Auth: All /api/* endpoints require OAuth2 Bearer token (src/middleware/auth.py)
- Logging: Structured JSON logging via structlog (src/utils/logging.py)
- Error handling: All services raise domain exceptions (src/errors.py)

## External Dependencies
- PostgreSQL 15 — primary database
- Redis — session cache, rate limiting
- Stripe API — payment processing
```

**Update rule:** After any session that creates, deletes, or renames files, update `docs/codebase-map.md`. A stale map is worse than no map.

### Docs-to-Code Mapping Convention

Every `.md` file that documents code MUST include file paths and line references so agents can navigate from docs to code and back. Use this format:

```
- Implemented: `src/module/file.py:123` (function_name)
```

When reading docs before implementation, the agent follows these references to find the actual code. When updating docs after implementation, the agent adds or updates these references.

### After Implementation

When a feature is complete and verified:
1. Update the spec document with what ACTUALLY happened (vs. what was planned)
2. Update business logic docs if new rules were added or existing rules changed
3. Update `docs/codebase-map.md` with new or changed files
4. Update `PROGRESS.md` (feature marked passing)
5. If new conventions emerged, update `AGENTS.md`

## 6. Git Discipline

### Commit Rules

- One logical change per commit. Never batch unrelated changes.
- Commit message: imperative mood, ≤72 chars first line, blank line, then body with what and why
- Run `make check` BEFORE committing. Never commit broken code.
- If `make check` fails, fix first, then commit. Never skip hooks.

### Before Commit Checklist
```
- [ ] make check passes
- [ ] Changes are one logical unit (not a grab bag)
- [ ] No debug code, print(), or temporary files
- [ ] Commit message explains WHAT and WHY
```

### After Implementation
- Commit the completed work
- Update PROGRESS.md (mark feature as passing with evidence)
- If architectural decisions were made, update DECISIONS.md
- If new conventions emerged, update AGENTS.md or topic docs
- Push to remote

## 7. Harness Initialization

Before any implementation work begins on a new project, there MUST be a dedicated initialization phase. Never mix init and implementation in the same session.

### Bootstrap Contract

After initialization, a fresh session must be able to:
1. **Start**: `make setup` works from scratch
2. **Test**: at least one example test passes (proving the framework works)
3. **See progress**: `PROGRESS.md` exists with task breakdown
4. **Pick up**: clear next action in PROGRESS.md

### Initialization Deliverables
- Runnable environment (deps installed, no env issues)
- Verifiable test framework (one passing test as proof)
- `AGENTS.md` (router with stack, run commands, hard constraints, verification commands)
- `PROGRESS.md` (with initial task breakdown, ≥3 tasks)
- `DECISIONS.md` (empty template ready for first decision)
- `Makefile` with targets: `setup`, `test`, `lint`, `check`, `dev`
- Initial git commit (everything above, clean)

### Initialization Acceptance Checklist
```
- [ ] make setup succeeds from a clean clone
- [ ] make test has ≥1 passing test
- [ ] AGENTS.md answers all five entry-file questions
- [ ] PROGRESS.md exists with ≥3 tasks in triple structure
- [ ] DECISIONS.md template exists
- [ ] Makefile has setup, test, lint, check, dev
- [ ] Everything committed
```

## 8. Implementation Workflow

### Normal Flow (per feature)

1. **Clock in** — read PROGRESS.md, DECISIONS.md, `docs/codebase-map.md`, run `make check`
2. **Clarify** — if ANY aspect of the task is ambiguous, ask the user before proceeding. Never guess.
3. **Mark feature active** — update PROGRESS.md, one feature at a time (WIP=1)
4. **Explore codebase** — read `docs/codebase-map.md`, `docs/business/*.md`, search for existing overlapping code; understand what's there
5. **Write spec** — create `docs/specs/YYYY-MM-DD-<topic>.md` with what, scope, I/O, design, files to touch, verification. Present to user for approval if non-trivial.
6. **Implement** — write the code, following code-quality skill rules
7. **Layer 1 verify** — run linter and type checker, fix all issues
8. **Layer 2 verify** — run tests, all must pass
9. **Layer 3 verify** — if cross-component changes, run E2E or manual smoke test
10. **Record evidence** — save verification output, update feature state to `passing`
11. **Update docs** — update the spec with what ACTUALLY happened, update `docs/business/*.md` if rules changed, update `docs/codebase-map.md` if files changed, update AGENTS.md if conventions changed
12. **Commit** — atomic commit with clean message
13. **Clock out** — run session exit checklist, update PROGRESS.md

### What To Do When Something Fails

Do NOT guess. Do NOT blindly retry. Apply the diagnostic loop:

1. What failed? (exact error message, what was expected vs. what happened)
2. Which layer? (spec / context / environment / verification / state)
3. What's the fix? (clarify the spec? add missing context? fix environment? add a test? record state?)
4. Apply the fix to the harness so this class of failure never happens again.
5. Retry.

### Anti-Patterns

**Forbidden:**
- "I'll just start coding and figure it out" — spec first, code second
- "The requirements are clear enough" — if you're not 100% sure, ask
- "I'll document it later" — update docs in the same session, or it won't happen
- "I'll fix the lint later" — fix it now, layer 1 is always required
- "Let me also refactor X while I'm here" — WIP=1, stay on task
- "Tests pass on my machine" — verification commands must be reproducible
- "The code looks right" — verification passes or it's not done
- "I'll update PROGRESS.md next session" — state decays, update now
- Starting a new feature before the current one reaches `passing`
- Committing without running `make check`
- Implementing without exploring the codebase map and business logic docs first

## Quick Reference: Files to Create

For a new project, these are the minimum viable harness files:

1. `AGENTS.md` — router: stack, run, ≤15 hard constraints, verification commands, topic doc links
2. `Makefile` — `setup`, `test`, `lint`, `check`, `dev`
3. `PROGRESS.md` — current state, completed, in progress, known issues, next steps
4. `DECISIONS.md` — empty template for architectural decisions
5. `docs/features.md` — feature list with triple structure (behavior + verification + state)
6. `docs/codebase-map.md` — directory overview, key files, cross-cutting concerns, external dependencies (with code references)
7. `docs/business/` — directory for business logic docs, one file per domain
8. `docs/specs/` — directory for per-feature spec documents (YYYY-MM-DD-<topic>.md)
