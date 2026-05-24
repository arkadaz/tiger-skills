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
| [references/task-management.md](references/task-management.md) | Breaking down work, tracking features, parallel agents |
| [references/verification.md](references/verification.md) | Defining done, running verification, writing error messages |
| [references/doc-first.md](references/doc-first.md) | Before implementing — specs, business docs, codebase map |
| [references/workflow.md](references/workflow.md) | The 13-step implementation flow, anti-patterns, diagnostic loop |

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

### Phase 1: CLARIFY — Ask Before You Act

**Before writing code, before writing a spec, before ANY action — ask clarifying questions.** If any answer is not 100% certain, ASK the user. Do not assume. Do not guess.

Mandatory clarification checklist. For EVERY task, confirm:
- What exactly should this do? (happy path AND error/edge cases)
- What are the inputs and outputs? (types, formats, validation)
- Which files will this touch? (create, modify, delete — be specific)
- What does "done" look like? (specific verification command or observable behavior)
- What is the priority relative to PROGRESS.md current state?
- Are there constraints, edge cases, or gotchas?

**Red flags — STOP and ask:**
- "The requirements are clear enough" → They aren't. Ask.
- "This is a simple change" → Simple things break. Confirm scope.
- "I know what they mean" → You don't. Paraphrase back and confirm.

**Gate:** Do not proceed to Phase 2 until the user has confirmed the answers. Use AskUserQuestion for non-trivial choices.

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

**Gate:** For multi-step work, present the plan to the user. Get approval. Then proceed.

### Phase 5: IMPLEMENT — Subagent-Driven Execution

Follow [references/workflow.md](references/workflow.md) 14-step implementation flow. WIP=1 is non-negotiable — finish or block the current feature before starting another.

At steps 6-10, load [code-quality](../code-quality/SKILL.md) and follow all rules. Apply the diagnostic loop on any failure — never guess, never blindly retry.

**Subagent-driven development:** When the plan has ≥2 independent tasks (separate files, no shared state, no sequential dependencies), dispatch parallel subagents. Follow [references/task-management.md](references/task-management.md) § "Parallel Agents for Independent Tasks" for the full checklist and rules:

1. Verify all five parallel-checklist questions are YES
2. Write specs for each task (if not already done)
3. Mark all tasks active simultaneously
4. Spawn one background agent per task (`run_in_background: true`)
5. Each agent follows the 14-step flow independently
6. When all complete: merge, run `make check` on merged result, update all harness docs

**Critical rules for subagent execution:**
- Each agent commits before merging — no uncommitted changes left behind
- If two agents touch the same file, the second to merge handles the conflict
- If any agent fails, STOP the entire batch. Diagnose. Fix. Then decide whether to re-spawn or continue sequentially.
- After merge, full verification on the merged codebase — not just per-agent verification
- One agent (the main session) handles the merge + doc updates

For single-task features: implement directly in the main session. No need to spawn.

### Phase 6: VERIFY — Evidence Before Assertions

Run the 3-layer verification pipeline from [references/verification.md](references/verification.md):
1. **Static:** lint + type check — zero errors
2. **Runtime:** unit + integration tests — all passing
3. **System:** E2E / smoke test — if cross-component

Sequence is mandatory. Do not proceed to layer 2 if layer 1 fails. Record verification evidence.

**Never claim "done" without verification output proving it.** "Looks right" is not verification.

### Phase 7: TRACK — Update State Every Session

Before the session ends, update ALL of these:
- **PROGRESS.md** — mark completed, update in-progress (state + % + what remains), reorder next steps, add/remove known issues
- **DECISIONS.md** — record any architectural choices made (what, why, alternatives rejected, constraints imposed)
- **docs/GRAPH.md** — add new/changed code flows with IN/OUT/ADDS/COMPUTES detail
- **docs/codebase-map.md** — add/update/remove file entries
- **AGENTS.md** — if new conventions, commands, hard constraints, or topic docs emerged

**State decays. Update it now, not "next session."** The next session's agent depends on this.

### Phase Loop Diagram

```
User Request
    ↓
CLARIFY ←── Ask questions, confirm scope ──→ (ask again if unclear)
    ↓
EXPLORE ←── Read codebase, understand state
    ↓
SPEC   ←── Write spec, get approval ───────→ (revise if rejected)
    ↓
PLAN   ←── Write plan, get approval ───────→ (revise if rejected)
    ↓
IMPLEMENT → WIP=1, follow 14-step workflow
    ↓
VERIFY  ←── 3-layer pipeline ──────────────→ (fix if any layer fails)
    ↓
TRACK  ←── Update all harness files
    ↓
 Done
```

## Quick Reference

| Phase | What Happens | Gate |
|-------|-------------|------|
| 1. CLARIFY | Ask questions until scope/criteria are certain | User confirms answers |
| 2. EXPLORE | Read codebase map, graph, business docs, existing code | Can answer: what exists, how it connects |
| 3. SPEC | Write spec doc, get approval | User approves spec |
| 4. PLAN | Write step-by-step plan (if ≥3 files or ≥2 steps) | User approves plan |
| 5. IMPLEMENT | Write code, WIP=1, 14-step flow, code-quality rules, parallel subagents for independent tasks | Code compiles, self-review done |
| 6. VERIFY | 3-layer pipeline (static → runtime → system) | All layers pass, evidence recorded |
| 7. TRACK | Update PROGRESS, DECISIONS, GRAPH, codebase-map, AGENTS | All files saved, committed |
