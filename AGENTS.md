# AGENTS.md

## Project Overview

tiger-skills — a Claude Code plugin providing harness engineering (outer loop) + code quality (inner loop) skills. Based on [walkinglabs learn-harness-engineering](https://walkinglabs.github.io/learn-harness-engineering/en/).

## Quick Start

- `./init.sh` — install deps, run baseline verification
- No build step — this is a skills/agents plugin, not an app

## Working Rules

1. **Explore before code** — read all relevant files and discover existing types, functions, and patterns BEFORE writing any new code. Search for what already exists. Never create a duplicate of an existing function, type, or constant.
2. Work on only one feature at a time (WIP=1)
3. Don't mark a feature complete unless verification ran and passed
4. Keep changes within the selected feature scope
5. Prefer durable repo artifacts over chat summaries
6. Use `./init.sh` to verify baseline before starting new work

## Definition of Done

A feature is complete only when:
1. The target behavior is implemented
2. Verification ran fresh from THIS session
3. Evidence is recorded in `feature_list.json`
4. The repo remains consistent (`./init.sh` passes)

## Required Artifacts

- `feature_list.json` — source of truth for feature state
- `progress.md` — session log and current verified status
- `init.sh` — standard startup and verification path

## Directory Map

```
skills/
├── harness-engineering/       — Conductor skill + references (walkinglabs-based 5-subsystem model)
├── harness-engineering-bootstrap/ — Create AGENTS.md, feature_list.json, progress.md, init.sh
├── harness-engineering-session/   — Clock-in/clock-out discipline
├── harness-engineering-feature/   — Feature lifecycle, WIP=1, state machine
├── harness-engineering-verify/    — Verification pipeline, evidence before claims
├── harness-engineering-review/    — Independent review (separate doer from checker)
├── harness-engineering-diagnose/  — Diagnostic loop (attribute failure to 1 of 5 layers)
├── code-quality/              — Router skill: 16 principles, 13 patterns
├── code-quality-review/       — Independent code quality review agent
├── code-quality-audit/        — Design principle audit with ranked report
├── code-quality-fix/          — Known fix patterns for each violation type
├── code-quality-python/       — Python rules: types, DI, enums, naming, logging
├── code-quality-rust/         — Rust rules: traits, ownership, errors, modules
agents/                    — 5 custom sub-agents (planner, generator, executor, healer, code-architect)
commands/                  — Custom slash commands
hooks/                     — Event-driven hooks
.claude-plugin/            — Plugin manifest + marketplace config
```

## Hard Constraints

- **Explore before code** — read relevant files, discover existing types/functions/patterns before writing. Never write a function that duplicates an existing one. Build a Type Inventory before writing function signatures.
- Follow the walkinglabs 5-subsystem model (Instructions, Environment, State, Scope, Verification)
- Every harness file must exist before any other work begins (bootstrap gate)
- Evidence before claims — never say "done" without fresh verification
- WIP=1 — one feature active at a time
- No placeholders in committed code
- Leave clean state for next session

## Verification Commands

- Plugin validation: verify `.claude-plugin/plugin.json` is valid JSON, all auto-discovered paths resolve
- Skills validation: every `skills/*/SKILL.md` has valid frontmatter (name, description)
- Agents validation: every `agents/*.md` has valid frontmatter (name, description, model)

## Topic Docs

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — full 12-lecture course
- [skills/harness-engineering/SKILL.md](skills/harness-engineering/SKILL.md) — conductor skill, route to sub-skills
- [skills/code-quality/SKILL.md](skills/code-quality/SKILL.md) — router skill, 16 principles + 13 patterns
- [feature_list.json](feature_list.json) — machine-readable feature state
- [progress.md](progress.md) — session log
