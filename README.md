# tiger-skills

Two Claude Code skill systems that work together — **harness-engineering** (outer loop) builds the engineering infrastructure around AI coding agents, and **code-quality** (inner loop) enforces design principles on every line of code, in any language. 13 skills, 8 agents, 8 hooks — one plugin.

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs and *Software Design for Python Programmers* by Ronald Mak.

## How It Works

The conductor runs a **Gate Sequence** on every request — mechanical, not advisory, with a live ledger it ticks off so no step is dropped:

```
GATE 0 bootstrap → GATE 1 SPEC GATE (no spec → grill first) → GATE 2 ledger →
clock in → SCOPE (WIP=1) → PLAN (persist tasks into feature_list.json) →
[architect] → GENERATE → EXECUTE → [heal ×3] → VERIFY → REVIEW →
TRACK (tasks + acceptance_criteria + commit) → clock out
```

**The outer loop** (harness-engineering) ensures the agent grills out a spec before building, knows what to work on, keeps the plan in the repo (not just chat), stays in scope, verifies before claiming completion, and leaves a clean state. **The inner loop** (code-quality) ensures every line of code follows 16 design principles and language-specific rules — and every agent must prove it invoked its required skill.

## How to Use

### Just Talk to Claude — the Skills Activate Automatically

You don't need to remember skill names. Just describe what you want, and the right skill activates:

| You say... | Skill that activates |
|------------|---------------------|
| "I want to add X" / "can we build…" / a feature idea | `harness-engineering-grill` (Spec Gate — interviews you, writes a spec, waits for approval) |
| "Set up this project for AI agents" | `harness-engineering-bootstrap` |
| "What are we working on?" / "Start a session" | `harness-engineering-session` |
| "Let's work on feature X" | `harness-engineering-feature` |
| "Is this done?" / "Verify my changes" | `harness-engineering-verify` |
| "Review my code" | `harness-engineering-review` or `code-quality-review` |
| "Why did this fail?" / "The agent keeps messing up" | `harness-engineering-diagnose` |
| "Improve this code" / "Make this cleaner" | `code-quality` (router, delegates to sub-skills) |
| "Audit this for design violations" | `code-quality-audit` |
| "Fix these violations" | `code-quality-fix` |
| "Write/review code in any language" (Python, Rust, TS, Go, Java, C#, …) | `code-quality-language` (infers the language's idioms) |

### The Full Workflow

**Phase 0 — Grill (Spec Gate):** Describe a new feature and Claude interviews you relentlessly across five dimensions (problem, happy path, errors, constraints, acceptance), one question at a time, then writes `specs/<feature-id>.md` and waits for your approval. The `spec-gate` hook makes this mechanical — no planning or code without an approved spec. Bug fixes and one-line edits skip it.

**Phase 1 — Start a session:** Just start working. The SessionStart hook reminds Claude to clock in — read `AGENTS.md`, `progress.md`, `feature_list.json`, and run `./init.sh`. For multi-step work Claude keeps a **live phase ledger** it ticks off so no step is dropped.

**Phase 2 — Pick a feature:** Say what you want to build. Claude reads `feature_list.json`, enforces WIP=1, and picks the highest-priority feature whose `depends_on` are all `passing`. The planner's blueprint is **persisted into the feature's `tasks[]`** (kanban sub-tickets) so the plan lives in the repo, not just in chat.

**Phase 3 — Build:** Claude writes code. The Explore-before-code hook ensures it reads existing types and functions first. Code-quality rules enforce types, DI, enums, logging, and flat functions on every line.

**Phase 4 — Verify:** Before claiming anything is done, Claude runs the 3-layer verification pipeline (static → unit → E2E) and records evidence. The pre-commit hook blocks commits until verification passes.

**Phase 5 — Review:** For non-trivial changes, Claude spawns an independent review agent that audits against all 16 design principles + 11 tooling rules. The agent that wrote the code cannot be the sole judge.

**Phase 6 — Wrap up:** Claude flips each `tasks[]` entry and `acceptance_criteria` item to done with evidence, marks the feature `passing` only when all of them are, and updates `progress.md`. The pre-push hook blocks pushes until state files are current. The Stop hook reminds Claude to leave a clean restart path.

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
→ harness-engineering-diagnose attributes to State layer, fixes progress.md

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
│   ├── code-quality/                   — Router: 16 principles, 13 patterns (language-agnostic)
│   ├── code-quality-language/          — Universal tooling rules; infers any language (Python/Rust = examples)
│   ├── code-quality-review/            — Independent code quality review agent (27 items)
│   ├── code-quality-audit/             — Design principle audit with ranked report
│   ├── code-quality-fix/               — Known fix patterns for each violation type
├── agents/                             — 8 custom sub-agents (explorer, planner, code-architect, generator, executor, healer, reviewer, scribe)
├── hooks/                               — 8 event-driven hook files
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
| `harness-engineering-bootstrap` | Creating AGENTS.md, feature_list.json, progress.md, init.sh from scratch |
| `harness-engineering-session` | Clock-in (read state) or clock-out (update state, 8-item exit checklist) |
| `harness-engineering-feature` | Feature lifecycle — pick one feature, WIP=1, definition of done |
| `harness-engineering-verify` | Evidence before claims — 3-layer pipeline (static → unit → E2E) |
| `harness-engineering-review` | Independent harness compliance review — separate doer from checker |
| `harness-engineering-diagnose` | Attribute failure to 1 of 5 layers, fix the harness, retry |

### Code Quality (Inner Loop)

| Skill | When to Use |
|-------|------------|
| `code-quality` | **Router** — load principles here, route to sub-skills for specific tasks |
| `code-quality-language` | Universal tooling rules for **any** language — infers its idioms (Python/Rust are worked examples) |
| `code-quality-review` | Independent review against 16 principles + 11 tooling rules (27 items) |
| `code-quality-audit` | Full design principle audit with ranked violation report |
| `code-quality-fix` | Apply known fix patterns for specific violation types |

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

8 event-driven hooks enforce the harness gates mechanically:

| Event | What It Does |
|-------|-------------|
| `UserPromptSubmit` | **Spec gate** — build request + no approved spec → invoke `grill` first |
| `SessionStart` | Clock-in reminder — read state files, run `./init.sh` |
| `PreToolUse` (Write/Edit) | Bootstrap gate — warn if harness files don't exist |
| `PreToolUse` (Write/Edit) | Explore-before-code — remind to discover types first |
| `PreToolUse` (Agent) | **Pre-agent-spawn gate** — confirm spec + ledger + WIP=1 before spawning the pipeline |
| `PreToolUse` (git commit) | Pre-commit check — confirm verification ran |
| `PreToolUse` (git push) | Pre-push check — confirm state files updated |
| `Stop` | Clock-out reminder — 8-item exit checklist |

## Agents

8 custom sub-agents in a defined workflow:

```
Explorer → Planner → [Code Architect] → Generator → Executor → [Healer] → Reviewer → Scribe
              ↑                              │            │          │
              └──────── feedback loop ───────┴───────── (heal / review loops) ┘
Scribe = single writer of feature_list.json + progress.md (applies every agent's Board Update)
```

| Agent | Model | Role | Required-skill proof line |
|-------|-------|------|---------------------------|
| `explorer` | sonnet | Read-only recon; build the Type Inventory for the planner | `Type Inventory built: YES` |
| `planner` | opus | Decompose goals into blueprints; emit `tasks[]` | `code-architect consulted: YES/NO` |
| `code-architect` | opus | Architecture review, SOLID, pattern selection | `code-quality-audit invoked: YES` |
| `generator` | sonnet | Write code from blueprints (TDD + code-quality) | `code-quality-language invoked: YES` |
| `executor` | sonnet | Run verification pipelines, collect evidence | `harness-engineering-verify invoked: YES` |
| `healer` | opus | Diagnose failures, prescribe fixes | `harness-engineering-diagnose invoked: YES` |
| `reviewer` | opus | Independent check vs. spec + 16 principles (never wrote the code) | `code-quality-review invoked: YES` |
| `scribe` | sonnet | Single writer of `feature_list.json` + `progress.md` | `feature_list.json valid after write: YES` |

**Proof of invocation:** every agent must begin its report with its proof line. The conductor rejects a handoff without one and re-spawns the agent — this is what stops agents from skipping their required skill (e.g. the architect actually running the 16-principle design audit instead of eyeballing it).

**Board Update contract:** agents never edit the board directly. Each emits a `Board Update` block (`task T2 → passing`, `acceptance_criteria AC3 → done`) and the **scribe** — the single writer — applies it, refusing anything that breaks an invariant (feature `passing` only when all tasks pass and all criteria are done; WIP=1; links reciprocal and acyclic). One writer = no drift.

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
