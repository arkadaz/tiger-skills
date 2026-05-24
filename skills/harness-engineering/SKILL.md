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

## Relationship to code-quality

This skill is the **outer loop** — process and workflow. Load [code-quality](../code-quality/SKILL.md) for the **inner loop** — how to write the code itself. Handoff points:
- `→ apply code-quality` — at workflow steps 6-10 (implement, verify, review)
- `→ follow harness verification` — after implementing, run the 3-layer verification pipeline

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
| [references/tdd.md](references/tdd.md) | During implementation — Red-Green-Refactor, testing anti-patterns |
| [references/debugging.md](references/debugging.md) | When bugs or failures occur — 4-phase systematic debugging, defense-in-depth |

## Bootstrap Gate — DO THIS FIRST

**Before answering the user, before reading any reference, before ANY other action — check whether harness files exist.** A project without these files has no harness. Creating them is the agent's first and only job.

Execute these checks immediately. For each file that is missing, CREATE it using the template from the reference. Do NOT just read the reference — CREATE the file:

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

**Gate rule:** If ≥1 files are missing, the agent's entire response is: report which files are missing, create them all, then report done. Do NOT take any other action (no implementing features, no fixing bugs, no answering other questions) until the bootstrap gate passes.

**Gate passes when:** All 9 checks above exist on disk. Only then proceed to the Outer Loop.

## The Outer Loop — Conductor Protocol

Once the bootstrap gate passes, **every user task** flows through these seven phases in strict order. Never skip a phase. Never reorder. Never jump to implementation.

### Phase 1: CLARIFY — Business Discovery, Approaches, Technical Confirmation

**Before writing code, before writing a spec, before ANY technical action — understand the business.** Every task starts with WHY. Technical decisions without business context are guesses. Do not assume purpose, users, or constraints.

#### 1a. Business Discovery — Ask WHY, One Question at a Time

Ask questions one at a time. Never batch multiple questions in one message. Each answer informs the next question. Use AskUserQuestion for multiple-choice when possible.

**Mandatory business context to discover:**
- **Purpose:** What problem does this solve? Why is this needed now?
- **Users:** Who will use this? What's their workflow? What matters to them?
- **Success criteria:** How will we know this is working? What metric or behavior?
- **Constraints:** Budget, timeline, technical restrictions, compliance, existing contracts?
- **Scope check:** Is this 1 feature or 5? If the request describes multiple independent pieces, flag it immediately — decompose before designing.

**One question per message. Prefer multiple choice. Never rush this phase.**

Example flow:
> "Who is this feature for — internal admins, end customers, or both?"
> (user answers)
> "What's the main problem they have today without this feature?"
> (user answers)
> "What would make this a success — faster completion, fewer errors, something else?"

#### 1b. Scope Gate — Decompose Large Requests

If the request spans multiple independent subsystems, STOP. Do not refine details of a project that needs decomposition first. Tell the user:
> "This looks like [N] independent pieces: [list them]. Let's focus on one at a time. Which should we design first?"

Each subsystem gets its own CLARIFY → EXPLORE → SPEC → PLAN cycle.

#### 1c. Explore Approaches — 2-3 Alternatives, Always

Once business context is clear, propose 2-3 approaches with trade-offs. **Always include at least one simpler alternative.** Lead with your recommendation and why.

Structure each option:
- **Option A (Recommended):** [approach] — [why it fits the business context]
- **Option B:** [alternative] — [trade-off: simpler but less flexible / more powerful but more complex]
- **Option C:** [alternative] — [different trade-off]

**YAGNI ruthlessly.** Remove features that don't directly serve the stated purpose. Users will add what they need later — starting simple is always easier than removing complexity.

Get the user to choose an approach before proceeding. Do not default to your recommendation without asking.

#### 1d. Technical Confirmation

Once the approach is chosen, confirm the technical specifics:
- What are the inputs and outputs? (types, formats, validation)
- Which files will this touch? (create, modify, delete — be specific)
- What does "done" look like? (specific verification command or observable behavior)
- What is the priority relative to PROGRESS.md current state?
- Are there constraints, edge cases, or gotchas?

**Red flags — STOP and ask:**
- "The requirements are clear enough" → They aren't. Ask.
- "This is a simple change" → Simple things break. Confirm scope.
- "I know what they mean" → You don't. Paraphrase back and confirm.
- "There's only one way to do this" → There are always alternatives. Find them.

**Gate:** Do not proceed to Phase 2 until: business context is understood, scope is confirmed (decomposed if needed), an approach is chosen by the user, and technical specifics are confirmed.

### Phase 2: EXPLORE — Read the Codebase First

**Before designing anything, understand what already exists.** Read, don't assume.

Exploration sequence (follow this order). **For each file that does not exist, CREATE it first from its template, then read it:**

1. Read `PROGRESS.md` — what's in progress, what's completed, known issues. **Doesn't exist?** Create from [references/session-discipline.md](references/session-discipline.md) § "PROGRESS.md — The Agent's Memory", then read it.
2. Read `DECISIONS.md` — what architectural choices are locked in. **Doesn't exist?** Create from [references/session-discipline.md](references/session-discipline.md) § "DECISIONS.md — The Agent's Rationale", then read it.
3. Read `docs/codebase-map.md` — directory structure, key files by domain. **Doesn't exist?** Create from [references/repo-system.md](references/repo-system.md) § "Codebase Knowledge Map", then read it.
4. Read `docs/GRAPH.md` — relevant code flows, entry points, data transformations. **Doesn't exist?** Create from [references/doc-first.md](references/doc-first.md) § "Code Flow Graph (GRAPH.md)", then read it.
5. Read `docs/business/<domain>.md` — business rules for the affected domain. **Doesn't exist?** Create the directory and file, then read it.
6. Grep/Glob for overlapping code — is someone else already touching these files? Is there existing code that does something similar?
7. Read the actual files that will be modified — understand current implementation before changing it

**Gate:** Do not proceed to Phase 3 until you can answer: what files exist in the affected area, what they do, how they connect, and what constraints are in place.

### Phase 3: SPEC — Document Before Building

Write a spec to `docs/specs/YYYY-MM-DD-<topic>.md`. Follow [references/doc-first.md](references/doc-first.md) § spec template.

**Required for:** Any feature, any bugfix that changes behavior, any refactoring touching >1 file.
**Skippable for:** Typo fixes, single-line fixes with zero behavior change, purely conversational questions.

The spec must cover: what (user perspective), scope (in/out), I/O (types/fields/validation), design (classes/functions/data flow), files to touch (each with what changes), verification (specific command), dependencies.

**Gate:** For non-trivial work, present the spec to the user and get explicit approval. Do NOT write code until the spec is approved.

### Phase 4: PLAN — Design Before Execution

For any task touching ≥3 files or involving ≥2 distinct steps: write an implementation plan. Save to `docs/plans/YYYY-MM-DD-<topic>.md`.

Plan structure:
- Step-by-step implementation order (each step: what files, what changes, why this order)
- Dependencies between steps
- Verification checkpoint after each step
- Rollback approach if a step fails

For simpler tasks (1-2 files, single step): the spec IS the plan. Skip to Phase 5.

**Gate:** Plan exists on disk, user has approved, PROGRESS.md updated.

### Phase 5: IMPLEMENT — Subagent-Driven Execution

Follow [references/workflow.md](references/workflow.md) 14-step implementation flow. WIP=1 is non-negotiable — finish or block the current feature before starting another.

At steps 6-10, load [code-quality](../code-quality/SKILL.md) and follow all rules. Follow TDD: failing test first, minimal implementation, verify — see [references/tdd.md](references/tdd.md). Apply [references/debugging.md](references/debugging.md) on any failure — root cause first, never guess, never blindly retry.

**Bite-sized tasks:** Every task must be atomic — completeable, verifiable, and committable in one pass. No placeholders (`pass`, `todo!()`, `raise NotImplementedError`). No stubs. Every function is complete or doesn't exist yet. See [references/task-management.md](references/task-management.md) § "Bite-Sized Tasks".

**Subagent-driven development:** When the plan has ≥2 independent tasks (separate files, no shared state, no sequential dependencies), dispatch parallel subagents. Follow [references/task-management.md](references/task-management.md) § "Parallel Agents for Independent Tasks" for the full checklist and rules:

1. Verify all five parallel-checklist questions are YES
2. Write specs for each task (if not already done)
3. Mark all tasks active simultaneously
4. Write self-contained prompts per [references/task-management.md](references/task-management.md) § "Subagent Prompt Template" — include full spec, file list, verification command
5. Select model per task complexity — opus for design-heavy, sonnet for pattern-following, haiku for trivial
6. Spawn one background agent per task (`run_in_background: true`)
7. Each agent follows the 14-step flow independently
8. Each agent reports status using the Subagent Status Protocol (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)
9. When all complete: merge, run two-stage review (spec compliance + code quality), run `make check` on merged result, update all harness docs

**Critical rules for subagent execution:**
- Each agent commits before merging — no uncommitted changes left behind
- If two agents touch the same file, the second to merge handles the conflict
- If any agent reports NEEDS_CONTEXT or BLOCKED, provide context and re-spawn — do not guess
- If any agent fails, STOP the entire batch. Diagnose. Fix. Then decide whether to re-spawn or continue sequentially.
- After merge, full verification on the merged codebase — not just per-agent verification
- Two-stage review on merged result: spec compliance first, then code quality
- One agent (the main session) handles the merge + doc updates

For single-task features: implement directly in the main session. No need to spawn.

**After every commit during implementation:** Run the Phase 7 Auto-Track Checklist. Update PROGRESS.md (progress %), GRAPH.md (new flows), codebase-map.md (new/changed files), DECISIONS.md (any decisions made). Do not wait until "done" — state rots fast.

### Phase 6: VERIFY — The Iron Law

**The Iron Law: Never claim completion without fresh verification evidence from THIS session.**

Run the 3-layer verification pipeline from [references/verification.md](references/verification.md):
1. **Static:** lint + type check — zero errors
2. **Runtime:** unit + integration tests — all passing
3. **System:** E2E / smoke test — if cross-component

Sequence is mandatory. Do not proceed to layer 2 if layer 1 fails. Record verification evidence.

**The Completion Gate** (from [references/verification.md](references/verification.md)):
1. Layer 1 ran THIS session, AFTER last code change → paste output
2. Layer 2 ran THIS session, AFTER last code change → paste output
3. Layer 3 ran THIS session (if required) → paste output
4. Every output shows ZERO failures
5. Evidence is recorded in verification file

**If ANY gate item is FALSE, you are NOT done.** Do not say "done." Do not say "almost done." Do not say "done pending X." See [references/verification.md](references/verification.md) § "Rationalization Prevention" for the full list of rationalizations agents use to skip this gate.

**After verification passes:** Immediately record evidence in PROGRESS.md (what passed, when, output summary). Update feature state to `passing`. Then run the full Phase 7 Auto-Track Checklist — every harness file that needs updating gets updated NOW.

### Phase 7: TRACK — Auto-Update ALL Harness Files After Every Change

**This is NOT optional. After EVERY implementation, EVERY verification pass, EVERY decision made — update the harness files immediately.** Do not batch updates. Do not "do it next session." State decays the moment code changes without documentation.

The agent MUST update these files in this order after every meaningful action:

#### 7a. What to Update — The Auto-Track Checklist

Run this checklist after EVERY code change, commit, or decision:

```
Auto-Track Checklist:
- [ ] PROGRESS.md — any feature state change? Mark it NOW. In-progress % accurate? Update NOW. Known issue found/fixed? Add/remove NOW.
- [ ] DECISIONS.md — any architectural choice made? Record NOW (what, why, alternatives rejected, constraints).
- [ ] docs/GRAPH.md — any new/modified code flow? Document NOW with IN/OUT/ADDS/COMPUTES. Stale graph lies to the next agent.
- [ ] docs/codebase-map.md — any file created/deleted/renamed? Update NOW. Stale map sends agents to wrong files.
- [ ] AGENTS.md — any new convention, command, constraint, or topic doc? Add NOW.
- [ ] Spec doc — any difference between spec and what was built? Update NOW.
- [ ] Plan doc — any task completed/blocked? Update NOW.
```

**Gate: If the Auto-Track Checklist has any unchecked item that applies (e.g., you changed code but didn't update GRAPH.md), you are NOT done.** The agent must run through the checklist and report what was updated.

#### 7b. When Auto-Track Fires

Auto-track fires at these trigger points — not just "before session ends":

| Trigger | Update |
|---------|--------|
| After CLARIFY completes | PROGRESS.md (clarification done, link design doc) |
| After SPEC is approved | PROGRESS.md (spec done, link spec) |
| After PLAN is approved | PROGRESS.md (plan done, feature → active) |
| After each commit during IMPLEMENT | PROGRESS.md (progress %), GRAPH.md (new flows), codebase-map.md (new files) |
| After VERIFY passes | PROGRESS.md (feature → passing, evidence linked) |
| After any architectural decision | DECISIONS.md |
| After any new convention emerges | AGENTS.md |
| After any file create/delete/rename | codebase-map.md |

**The rule: code changes → harness files update. No exceptions. No delays.**

### Phase Loop Diagram

```
User Request
    ↓
CLARIFY ←── Business discovery, 2-3 approaches, technical specifics
    ↓  └→ AUTO-TRACK: PROGRESS.md (clarified)
EXPLORE ←── Read codebase, create missing harness files
    ↓
SPEC   ←── Technical spec, self-review, get approval
    ↓  └→ AUTO-TRACK: PROGRESS.md (specced)
PLAN   ←── Bite-sized tasks, checkpoints, dependencies
    ↓  └→ AUTO-TRACK: PROGRESS.md (planned)
IMPLEMENT → code-quality + TDD + subagent dispatch
    ↓  └→ AUTO-TRACK: after EVERY commit (PROGRESS, GRAPH, codebase-map, DECISIONS)
VERIFY  ←── Iron Law: 3-layer pipeline, completion gate
    ↓  └→ AUTO-TRACK: PROGRESS.md (passing + evidence), full checklist
TRACK  ←── Final auto-track sweep: all 5 harness files current
    ↓
 Done
```

## Quick Reference

| Phase | What Happens | Gate |
|-------|-------------|------|
| 1. CLARIFY | Business discovery, 2-3 approaches, technical confirmation | User confirms |
| 2. EXPLORE | Read codebase map, graph, business docs, existing code | Can answer: what exists, how it connects |
| 3. SPEC | Write spec, self-review, get approval | User approves |
| 4. PLAN | Bite-sized tasks, checkpoints, dependencies | User approves |
| 5. IMPLEMENT | TDD + code-quality rules + subagent parallel execution | Two-stage review passes |
| 6. VERIFY | Iron Law: 3-layer pipeline, completion gate | Fresh evidence THIS session |
| 7. TRACK | Update PROGRESS, DECISIONS, GRAPH, codebase-map, AGENTS | All files committed |
