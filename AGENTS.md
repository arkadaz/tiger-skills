# AGENTS.md

## Project Overview

tiger-skills — a Claude Code plugin providing harness engineering (outer loop) + code quality (inner loop) skills. Based on [walkinglabs learn-harness-engineering](https://walkinglabs.github.io/learn-harness-engineering/en/).

## Quick Start

- `./init.sh` — install deps, run baseline verification
- No build step — this is a skills/agents plugin, not an app

## Working Rules

1. **Run the Gate Sequence** — every request flows through the conductor's gates in order (see `skills/harness-engineering/SKILL.md`): bootstrap → spec gate → ledger → clock-in → scope → plan → … → track → clock-out. No gate is skipped silently.
2. **Spec before build** — a build request with no approved spec goes through `harness-engineering-grill` first (GATE 1). No planning or code without an approved spec.
3. **Keep a live ledger** — for multi-step work, maintain a phase checklist you tick off (GATE 2), and persist the planner's task breakdown into `feature_list.json` `tasks[]` (GATE 5) so nothing is dropped.
4. **Explore before code** — discover existing types, functions, and patterns BEFORE writing. Never duplicate an existing function, type, or constant.
5. Work on only one feature at a time (WIP=1)
6. Don't mark a feature complete unless every task is `passing`, every acceptance criterion is `done`, and verification ran and passed
7. Keep changes within the selected feature scope; prefer durable repo artifacts over chat summaries
8. Use `./init.sh` to verify baseline before starting new work

## Definition of Done

A feature is complete only when:
1. The target behavior is implemented
2. Verification ran fresh from THIS session
3. Evidence is recorded in `feature_list.json`
4. The repo remains consistent (`./init.sh` passes)

## Required Artifacts

- `feature_list.json` — source of truth for feature state. Each feature is a **kanban ticket**: `depends_on`/`blocks` (links, reciprocal, acyclic), `acceptance_criteria` (`{id,text,done}`), and `tasks[]` (the planner's persisted blueprint, each a sub-ticket on the same four-state machine).
- `progress.md` — session log and current verified status
- `specs/` — approved feature specs (grill output); features link via `spec_file`
- `init.sh` — standard startup and verification path (Layer 6 validates the feature graph)

## Directory Map

```
skills/
├── harness-engineering/       — Conductor skill + references (walkinglabs-based 5-subsystem model)
├── harness-engineering-grill/ — Phase 0: Requirements discovery, relentless interview, spec writing
├── harness-engineering-bootstrap/ — Create AGENTS.md, feature_list.json, progress.md, init.sh
├── harness-engineering-session/   — Clock-in/clock-out discipline
├── harness-engineering-feature/   — Feature lifecycle, WIP=1, state machine
├── harness-engineering-verify/    — Verification pipeline, evidence before claims
├── harness-engineering-review/    — Independent review (separate doer from checker)
├── harness-engineering-diagnose/  — Diagnostic loop (attribute failure to 1 of 5 layers)
├── code-quality/              — Router skill: 16 principles, 13 patterns (language-agnostic)
├── code-quality-language/     — Universal tooling rules; infers any language's idioms (Python/Rust = worked examples)
├── code-quality-review/       — Independent code quality review agent
├── code-quality-audit/        — Design principle audit with ranked report
├── code-quality-fix/          — Known fix patterns for each violation type
├── code-correctness-review/   — Adversarial correctness review: trace flow, prove each AC with a test (unit + E2E)
├── security-review/           — Trigger-based security review: injection, authz, secrets, crypto, deps
specs/                     — Approved feature specifications (one per feature)
agents/                    — 10 custom sub-agents (explorer, planner, code-architect, generator, executor, healer, reviewer, correctness-reviewer, security-reviewer, scribe)
commands/                  — Custom slash commands
hooks/                     — Event-driven hooks
.claude-plugin/            — Plugin manifest + marketplace config
```

## Hard Constraints

- **Explore before code** — read relevant files, discover existing types/functions/patterns before writing. Never write a function that duplicates an existing one. Build a Type Inventory before writing function signatures.
- Follow the walkinglabs 5-subsystem model (Instructions, Environment, State, Scope, Verification)
- Every harness file must exist before any other work begins (bootstrap gate)
- **Spec gate** — no build without an approved spec; grill first
- **Proof of invocation** — every spawned agent emits its required-skill proof line (e.g. `code-quality-audit invoked: YES`), or its handoff is rejected and it is re-spawned
- **Single writer of state** — only the `scribe` agent writes `feature_list.json` and `progress.md`; every other agent emits a Board Update for it to apply
- **Independent review cluster** — at GATE 11 three agents that never wrote the code audit non-trivial work: `reviewer` (quality), `correctness-reviewer` (behavior — traces the flow, proves each acceptance criterion with a test), and `security-reviewer` (when a security trigger fires)
- **Verify behavior, not just structure** — every user-facing feature ships with an E2E test of its real workflow (plus unit tests); the completion run is the full suite (no fail-fast) so regressions surface; every bug fix adds a failing-first regression test
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
