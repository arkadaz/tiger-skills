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

**Gate passes when:** All 9 checks above exist on disk. Only then proceed to Quick Start.

## Quick Start

Once the bootstrap gate passes, follow this execution order:

1. **Clock in:** Read PROGRESS.md → DECISIONS.md → docs/codebase-map.md → docs/GRAPH.md. Run `make check`. Understand current state before touching anything. Follow [references/session-discipline.md](references/session-discipline.md).
2. **Spec before code:** Write spec to `docs/specs/YYYY-MM-DD-<topic>.md`. Get approval for non-trivial changes. Follow [references/doc-first.md](references/doc-first.md).
3. **Implement with discipline:** Follow the 14-step workflow in [references/workflow.md](references/workflow.md). WIP=1. Never skip steps. Load [code-quality](../code-quality/SKILL.md) for code standards.
4. **Verify before declaring done:** Run the 3-layer verification pipeline (static → runtime → system). Evidence before assertions. Follow [references/verification.md](references/verification.md).
5. **Track everything:** Update PROGRESS.md, DECISIONS.md, GRAPH.md, and codebase-map.md as you go. Feature state machine: not_started → active → passing (with evidence) or blocked. Follow [references/task-management.md](references/task-management.md).
