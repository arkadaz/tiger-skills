# tiger-skills

Two Claude Code skill systems that work together — **harness-engineering** (outer loop) builds the engineering infrastructure around AI coding agents, and **code-quality** (inner loop) enforces design principles on every line of code. 13 skills, 5 agents, 6 hooks — one plugin.

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs and *Software Design for Python Programmers* by Ronald Mak.

## How It Works

```
SESSION START → bootstrap check → read state → pick feature → SCOPE →
IMPLEMENT (with code-quality rules) → VERIFY (layered pipeline) →
REVIEW (independent agent) → TRACK (update state) → SESSION END (clean)
```

**The outer loop** (harness-engineering) ensures the agent knows what to work on, stays in scope, verifies before claiming completion, and leaves a clean state. **The inner loop** (code-quality) ensures every line of code follows 16 design principles and language-specific rules.

## Project Structure

```
tiger-skills/
├── skills/
│   ├── harness-engineering/            — Conductor + 6 references (walkinglabs 5-subsystem model)
│   ├── harness-engineering-bootstrap/  — Create AGENTS.md, feature_list.json, progress.md, init.sh
│   ├── harness-engineering-session/    — Clock-in/clock-out discipline
│   ├── harness-engineering-feature/    — Feature lifecycle, WIP=1, state machine
│   ├── harness-engineering-verify/     — Layered verification, evidence before claims
│   ├── harness-engineering-review/     — Independent review (separate doer from checker)
│   ├── harness-engineering-diagnose/   — Five-layer failure attribution
│   ├── code-quality/                   — Router: 16 principles, 13 patterns
│   ├── code-quality-review/            — Independent code quality review agent (27 items)
│   ├── code-quality-audit/             — Design principle audit with ranked report
│   ├── code-quality-fix/               — Known fix patterns for each violation type
│   ├── code-quality-python/            — Python rules: types, DI, enums, naming, logging
│   ├── code-quality-rust/              — Rust rules: traits, ownership, errors, modules
├── agents/                             — 5 custom sub-agents (planner, generator, executor, healer, code-architect)
├── hooks/hooks.json                    — 6 event-driven hooks
├── commands/review-branch.md           — Branch review command
├── .claude-plugin/                     — Plugin manifest + marketplace config
├── init.sh                             — Verification (49 checks, 5 layers)
├── AGENTS.md                           — Agent operating manual
├── progress.md                         — Session log + known issues
├── feature_list.json                   — Machine-readable feature state
└── README.md
```

## The Five Subsystems (walkinglabs)

Every complete harness has five subsystems:

| Subsystem | Question It Answers | Minimal Artifact |
|-----------|-------------------|------------------|
| **Instructions** | What should the agent know? | `AGENTS.md` |
| **Environment** | Can the agent run and verify? | `init.sh` |
| **State** | What happened last session? | `progress.md`, `feature_list.json` |
| **Scope** | What exactly to work on? | Feature boundaries + definition of done |
| **Verification** | How to know it's correct? | `./init.sh` verification pipeline |

## Skills Reference

### Harness Engineering (Outer Loop)

| Skill | When to Use |
|-------|------------|
| `harness-engineering` | **Conductor** — orchestrates the full agent workflow. Start here for any task. |
| `harness-engineering:bootstrap` | Creating AGENTS.md, feature_list.json, progress.md, init.sh from scratch |
| `harness-engineering:session` | Clock-in (read state) or clock-out (update state, 8-item exit checklist) |
| `harness-engineering:feature` | Feature lifecycle — pick one feature, WIP=1, definition of done |
| `harness-engineering:verify` | Evidence before claims — 3-layer pipeline (static → unit → E2E) |
| `harness-engineering:review` | Independent harness compliance review — separate doer from checker |
| `harness-engineering:diagnose` | Attribute failure to 1 of 5 layers, fix the harness, retry |

### Code Quality (Inner Loop)

| Skill | When to Use |
|-------|------------|
| `code-quality` | **Router** — load principles here, route to sub-skills for specific tasks |
| `code-quality:review` | Independent review against 16 principles + 11 tooling rules (27 items) |
| `code-quality:audit` | Full design principle audit with ranked violation report |
| `code-quality:fix` | Apply known fix patterns for specific violation types |
| `code-quality:python` | Python rules — types, DI, enums, naming, logging, project structure |
| `code-quality:rust` | Rust rules — traits, ownership, error handling, module structure |

## 16 Design Principles

| # | Principle | # | Principle |
|---|-----------|---|-----------|
| 1 | Single Responsibility | 9 | Least Astonishment |
| 2 | Encapsulate What Varies | 10 | Lazy Evaluation |
| 3 | Least Knowledge (Law of Demeter) | 11 | Class Invariant |
| 4 | Don't Repeat Yourself (DRY) | 12 | Precondition |
| 5 | Open-Closed | 13 | Postcondition |
| 6 | Code to the Interface | 14 | Delegation |
| 7 | Liskov Substitution | 15 | Factory |
| 8 | Composition over Inheritance | 16 | Defensive Programming |

## Hard Constraints (Non-Negotiable)

1. **Explore before code** — read existing files, discover types/functions/patterns BEFORE writing
2. **Check the harness first** — when the model fails, the problem is in the harness
3. **Evidence before claims** — never say "done" without fresh verification output
4. **WIP = 1** — exactly one feature active at a time
5. **No placeholders** — `pass`, `TODO`, `NotImplementedError` forbidden in committed code
6. **Leave a clean state** — every session ends with the repo restartable from `./init.sh`
7. **Separate doer from checker** — independent review agent must audit non-trivial work

## Hooks

6 event-driven hooks enforce the harness gates mechanically:

| Event | What It Does |
|-------|-------------|
| `SessionStart` | Clock-in reminder — read state files, run `./init.sh` |
| `PreToolUse` (Write/Edit) | Bootstrap gate — warn if harness files don't exist |
| `PreToolUse` (Write/Edit) | Explore-before-code — remind to discover types first |
| `PreToolUse` (git commit) | Pre-commit check — confirm verification ran |
| `PreToolUse` (git push) | Pre-push check — confirm state files updated |
| `Stop` | Clock-out reminder — 8-item exit checklist |

## Agents

5 custom sub-agents in a defined workflow:

```
Planner (Opus) → Code Architect (Opus, optional) → Generator (Sonnet) → Executor (Sonnet) → Healer (Opus)
```

| Agent | Model | Role |
|-------|-------|------|
| `planner` | opus | Decompose goals into structured blueprints |
| `code-architect` | opus | Architecture review, SOLID compliance, pattern selection |
| `generator` | sonnet | Write code from blueprints following TDD + code-quality |
| `executor` | sonnet | Run verification pipelines, collect evidence |
| `healer` | opus | Diagnose failures, prescribe fixes, close the feedback loop |

## Install

### From marketplace

```bash
claude plugin marketplace add https://github.com/arkadaz/tiger-skills.git
claude plugin install tiger-skills@arkadaz
```

### Manual

```bash
git clone https://github.com/arkadaz/tiger-skills.git
# Plugin auto-discovers skills/, agents/, commands/, hooks/ from .claude-plugin/plugin.json
```

### Verification

```bash
./init.sh
# Expected: 49 passed, 0 failed
```

## Update

```bash
cd tiger-skills && git pull
# Claude Code reloads skills automatically on restart
```

## License

MIT
