# tiger-skills

Two Claude Code skill systems that work together — **harness-engineering** (outer loop) builds the engineering infrastructure around AI coding agents, and **code-quality** (inner loop) enforces design principles on every line, in any language. **19 skills, 6 agents, 8 hooks, 2 commands, and a deterministic linear workflow** — one plugin. The flow is simple and linear, **one feature at a time**: grill the spec → architect plans where the code goes → generator builds in a git **worktree** branched from `dev` → reviewer + security → e2e (an integration test, run *in the worktree*) → fast-forward merge the green branch to `dev` (**`main` stays protected**) → update docs. **Skills are independent units; agents are a bundle of skills.** A **cartographer** keeps `CODEBASE_MAP.md` — Mermaid code-flow maps with function chains and inputs/outputs — current after every feature, so agents read a verified map instead of re-exploring.

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs and *Software Design for Python Programmers* by Ronald Mak.

## How It Works

The conductor runs a **Gate Sequence** on every request — mechanical, not advisory, one feature at a time:

```
GATE 0 bootstrap → GATE 1 SPEC GATE (no spec → grill first) → clock in → SCOPE (WIP=1) →
ARCHITECT (plan where the code goes) → GENERATE (worktree branched from dev: code + unit tests) →
REVIEW + SECURITY → E2E (integration test, in the worktree)
        └─ any not-pass loops back to the generator (fix in the worktree), up to 5 tries ─┘
→ fast-forward merge the green branch to dev (main stays protected) → UPDATE DOCS → clock out
```

**The outer loop** (harness-engineering) grills out a spec before building, keeps the plan in the repo, stays in scope, verifies before claiming completion, and leaves a clean state. **The inner loop** (code-quality) enforces 16 design principles and language-specific rules on every line — and every agent must prove it invoked its required skill.

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
| "Review my code" | `code-quality-review` (quality) + `code-correctness-review` (behavior) |
| "Why did this fail?" / "The agent keeps messing up" | `harness-engineering-diagnose` |
| "Improve this code" / "Make this cleaner" | `code-quality` (router, delegates to sub-skills) |
| "Audit this for design violations" | `code-quality-audit` |
| "Fix these violations" | `code-quality` (apply the fix patterns inline) |
| "Write/review code in any language" (Python, Rust, TS, Go, Java, C#, …) | `code-quality-language` (infers the language's idioms) |

### The Full Workflow

**Grill (Spec Gate):** Describe a feature and Claude interviews you relentlessly — problem, behavior, edge/error cases, data model, NFRs, rollout, observability, acceptance — one question at a time, then writes the feature's docs (`specs.md`, `adr.md`, `e2e_testcases.md`, `business.html`) plus a `feature_list.json` entry, and waits for your approval. The `spec-gate` hook makes it mechanical — no code without an approved spec. Bug fixes and one-line edits skip it.

**Plan:** The `code-architect` reads `CODEBASE_MAP.md` + the docs and plans **where the code goes** and which patterns to follow (there's no separate planner — the architect plans).

**Build (in a worktree):** The `generator` creates a git worktree branched from `dev`, writes the feature + unit tests there with simple, readable code, and commits. `main` stays untouched.

**Validate (in the worktree):** `reviewer` (quality **and** correctness — proves every acceptance criterion has a real test) and `security-reviewer` (when triggered) audit the code; then the `executor` authors the E2E and runs the **full** suite (static → unit → E2E). Because the worktree holds all of `dev` + the feature, the e2e there is a real integration test. Any not-pass loops back to the generator to fix **in the worktree** — up to 5 tries.

**Ship:** Once everything is green, the branch is **fast-forwarded onto `dev`** (trivial — `dev` hasn't moved, so there's nothing to re-test). **`main` stays protected**; promoting `dev → main` is a separate release step.

**Update docs:** The `cartographer` refreshes `CODEBASE_MAP.md`, flips the feature to `passing` in `feature_list.json` + `progress.md`, and writes `release_docs.html` + refreshes `business.html`.

### Slash Commands

| Command | What it does |
|---------|-------------|
| `/tiger-skills:review-branch` | Review the current branch — runs verification pipeline, spawns code quality review, checks spec compliance, produces a report |
| `/tiger-skills:install-workflow` | Copy the bundled deterministic Workflow into this project's `.claude/workflows/` so the team gets it on clone |

### Deterministic Workflow — run the pipeline the same way every time

The conductor's mechanical part also ships as a **deterministic, git-committed Claude Code Workflow** — a JS script that runs the linear flow the same way every run, instead of the conductor re-improvising. You review it once in a PR and trust it forever.

```
read backlog → for each approved feature (one at a time):
   architect (plan) → generator (worktree branched from dev: code + unit tests)
   → reviewer + security → e2e + full suite (all IN THE WORKTREE)
        └─ any not-pass → generator fixes in the worktree → re-validate (≤5 tries) ─┘
   → fast-forward merge the green branch to dev (main stays protected) → update docs
```

**`main` stays protected, by construction:** each feature builds in its own git worktree branched from `dev`; the worktree holds all of `dev` + the feature, so the e2e there is a real integration test; you only ever fast-forward an *already-green* branch onto an unchanged `dev` — nothing to re-test, nothing left broken. Promoting `dev → main` is a separate release step.

**Boundary:** the human gates stay interactive — bootstrap, grill, and **spec approval** happen in conversation first; the workflow runs only *already-approved* features. The mechanical part is deterministic; the judgment part stays with you.

**Use it:**

1. **Install it into a project (once):** run `/tiger-skills:install-workflow`, then commit `.claude/workflows/tiger-pipeline.js` so teammates get it on clone.
2. **Finish the human gates in chat:** bootstrap, grill, **approve the spec(s)**.
3. **Run it by its own name:** `/tiger-pipeline` with `args` — `projectDir`, `today`, and optionally `integrationBranch` (default `dev`), `featureIds`, `proModel`/`fastModel`. It reads `feature_list.json` itself, so you don't pass per-feature details. A saved workflow becomes its own slash command — **`/workflows` (no name) only lists and watches runs, it does not launch one.** Launched **bare**, it aborts softly with `howToLaunch` usage before any agent spawns. See [`workflows/README.md`](workflows/README.md) for the full table.
4. **Watch live** with `/workflows` — `p` pause, `x` stop an agent, `r` restart, `s` save.

> **Prerequisites:** Claude Code ≥ 2.1.154 with dynamic workflows enabled, and the `tiger-skills` plugin installed (the workflow spawns its agents). The Workflow runtime is a research-preview API — dry-run on a small approved feature before making it a team default. Full guide: [`workflows/README.md`](workflows/README.md).
>
> **Non-Anthropic backend and every subagent dies with a thinking/effort `400`?** That's a Claude Code runtime param conflict, not a plugin bug — v4.10.7 bundles a repair proxy (`tools/anthropic-compat-proxy.js`) with a step-by-step launch guide: [`workflows/README.md` → Troubleshooting](workflows/README.md#troubleshooting-non-anthropic-backends).

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
│   ├── harness-engineering-diagnose/   — Five-layer failure attribution
│   ├── code-quality/                   — Router: 16 principles, 13 patterns (language-agnostic)
│   ├── code-quality-language/          — Universal tooling rules; infers any language (Python/Rust = examples)
│   ├── code-quality-review/            — Independent code quality review agent (27 items)
│   ├── code-quality-audit/             — Design principle audit with ranked report
│   ├── code-correctness-review/        — Adversarial correctness review (trace flow, prove each AC with a test)
│   ├── security-review/                — Trigger-based security review (injection, authz, secrets, crypto, deps)
│   ├── e2e-authoring/                  — Author the user-flow E2E (Playwright) after the feature is built
│   ├── doc-spec, doc-adr, doc-e2e-cases — per-document format skills (.md, for agents)
│   ├── doc-business, doc-release       — per-document format skills (.html, for the human)
├── agents/                             — 6 sub-agents (code-architect, generator, reviewer, security-reviewer, executor, cartographer)
├── hooks/                               — 8 event-driven hook files
├── commands/                           — Slash commands (review-branch, install-workflow)
├── workflows/                          — Deterministic Workflow (tiger-pipeline.js) + README — copy to .claude/workflows/
├── .claude-plugin/                     — Plugin manifest + marketplace config
├── init.sh                             — Verification (6 layers)
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
| `harness-engineering-diagnose` | Attribute failure to 1 of 5 layers, fix the harness, retry |
| `e2e-authoring` | Author the user-flow E2E (Playwright) after the feature is built — real entry point, one asserting flow per acceptance criterion |

### Code Quality (Inner Loop)

| Skill | When to Use |
|-------|------------|
| `code-quality` | **Router** — load principles here, route to sub-skills for specific tasks |
| `code-quality-language` | Universal tooling rules for **any** language — infers its idioms (Python/Rust are worked examples) |
| `code-quality-review` | Independent review against 16 principles + 11 tooling rules (27 items) |
| `code-quality-audit` | Full design principle audit with ranked violation report |
| `code-correctness-review` | Adversarial behavior review — trace flow, enumerate edge cases, hunt logic bugs, prove every acceptance criterion with a real test (unit + E2E) |
| `security-review` | Trigger-based security audit — injection, authz, secrets, crypto, deserialization, deps, DoS |

### Documents (one skill per doc type — the format authority + a readability gate)

| Skill | Doc it owns |
|-------|------------|
| `doc-spec` | `specs.md` — the feature contract (`.md`, agent-facing) |
| `doc-adr` | `adr.md` — architecture decisions, Michael Nygard format (`.md`) |
| `doc-e2e-cases` | `e2e_testcases.md` — Given/When/Then, one case per acceptance criterion (`.md`) |
| `doc-business` | `business.html` — the business case (`.html`, for you) |
| `doc-release` | `release_docs.html` — the user-facing changelog (`.html`, for you) |

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
7. **Separate doer from checker** — the generator never writes its own E2E or judges its own work; the `executor` authors the E2E, and an independent `reviewer` (quality + correctness) + `security-reviewer` audit it — none of them wrote the code. **Skills are independent units; agents are a bundle of skills.**
8. **Verify behavior, not just structure** — user-facing features ship an E2E test of the real workflow; the full suite runs (no fail-fast) to catch regressions; every fix adds a failing-first regression test

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

6 sub-agents, run **one at a time** in the linear flow. **Skills are independent units; each agent is a bundle of the skills it needs.**

```
architect → generator (worktree) → reviewer + security → e2e → fast-forward merge → cartographer (update docs)
                ▲________ any not-pass: back to the generator (fix IN THE WORKTREE, ≤5 tries) ________|
```

| Agent | Model | Role | Skills it bundles | Proof line |
|-------|-------|------|-------------------|------------|
| `code-architect` | opus | Plan where the code goes (the planning step — no separate planner) | `code-quality-audit` | `code-quality-audit invoked: YES` |
| `generator` | sonnet | Build the feature + unit tests in a git worktree; run the fix loop | `code-quality-language`, `code-quality` | `code-quality-language invoked: YES` |
| `reviewer` | opus | Quality **and** correctness in one pass — prove every AC has a real test | `code-quality-review`, `code-correctness-review` | `code-quality-review invoked: YES` |
| `security-reviewer` | opus | Security audit when a trigger fires (auth, input, secrets, crypto, deps, …) | `security-review` | `security-review invoked: YES` |
| `executor` | opus | Own the E2E: author it + run static → full unit → E2E in the worktree | `e2e-authoring`, `harness-engineering-verify` | `harness-engineering-verify invoked: YES` |
| `cartographer` | opus | Update-docs: refresh `CODEBASE_MAP.md` + write state + release/business html | `doc-release`, `doc-business` | `codebase-map updated: YES` |

**Proof of invocation:** every agent must begin its report with its proof line. The conductor rejects a handoff without one and re-spawns the agent — this is what stops an agent from skipping its required skill (e.g. the architect actually running the design audit instead of eyeballing it).

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
# Expected: all checks pass (0 failed)
```

## Update

```bash
cd tiger-skills && git pull
# Claude Code reloads skills automatically on restart
```

## License

MIT
