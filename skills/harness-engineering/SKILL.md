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

## Quick Start

1. If setting up a new project: read [references/repo-system.md](references/repo-system.md) first
2. Every session: read [references/session-discipline.md](references/session-discipline.md)
3. Before implementing: read [references/doc-first.md](references/doc-first.md) — includes GRAPH.md for code flow understanding
4. During implementation: follow [references/workflow.md](references/workflow.md)
5. Before declaring done: read [references/verification.md](references/verification.md)
6. When tracking work: read [references/task-management.md](references/task-management.md)
