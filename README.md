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

## How to Use

### Just Talk to Claude — the Skills Activate Automatically

You don't need to remember skill names. Just describe what you want, and the right skill activates:

| You say... | Skill that activates |
|------------|---------------------|
| "Set up this project for AI agents" | `harness-engineering:bootstrap` |
| "What are we working on?" / "Start a session" | `harness-engineering:session` |
| "Let's work on feature X" | `harness-engineering:feature` |
| "Is this done?" / "Verify my changes" | `harness-engineering:verify` |
| "Review my code" | `harness-engineering:review` or `code-quality:review` |
| "Why did this fail?" / "The agent keeps messing up" | `harness-engineering:diagnose` |
| "Improve this code" / "Make this cleaner" | `code-quality` (router, delegates to sub-skills) |
| "Audit this for design violations" | `code-quality:audit` |
| "Fix these violations" | `code-quality:fix` |
| "Write Python code" / "Review this .py file" | `code-quality:python` |
| "Write Rust code" / "Review this .rs file" | `code-quality:rust` |

### The Full Workflow

**Phase 1 — Start a session:** Just start working. The SessionStart hook reminds Claude to clock in — read `AGENTS.md`, `progress.md`, `feature_list.json`, and run `./init.sh`.

**Phase 2 — Pick a feature:** Say what you want to build. Claude reads `feature_list.json`, enforces WIP=1, and picks the highest-priority feature.

**Phase 3 — Build:** Claude writes code. The Explore-before-code hook ensures it reads existing types and functions first. Code-quality rules enforce types, DI, enums, logging, and flat functions on every line.

**Phase 4 — Verify:** Before claiming anything is done, Claude runs the 3-layer verification pipeline (static → unit → E2E) and records evidence. The pre-commit hook blocks commits until verification passes.

**Phase 5 — Review:** For non-trivial changes, Claude spawns an independent review agent that audits against all 16 design principles + 11 tooling rules. The agent that wrote the code cannot be the sole judge.

**Phase 6 — Wrap up:** Claude updates `progress.md` and `feature_list.json`. The pre-push hook blocks pushes until state files are current. The Stop hook reminds Claude to leave a clean restart path.

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/review-branch` | Review the current branch — runs verification pipeline, spawns code quality review, checks spec compliance, produces a report |

### Example Prompts

```
"Set up harness files for this project"
→ Creates AGENTS.md, feature_list.json, progress.md, init.sh

"Make this code better"
→ Invokes code-quality: reviews against all 16 principles

"Why does Claude keep re-implementing features we already have?"
→ harness-engineering:diagnose attributes to State layer, fixes progress.md

"Review my PR before I merge"
→ Runs verification pipeline + independent code quality review

"I'm done for today"
→ Clock-out: updates all state files, runs exit checklist
```

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
├── hooks/                               — 6 event-driven hook files
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
