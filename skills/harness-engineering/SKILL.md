---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the five subsystems that make agents reliable. Use when setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / feature_list.json / progress.md, session management, feature tracking, verification pipelines, or diagnosing agent failures. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs. Build everything outside the model that makes AI coding agents reliable.

> A harness is not a prompt file. A harness is everything in the engineering infrastructure outside the model weights. — walkinglabs, Lecture 02

## Core Thesis

**The same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When the model fails on a task you know it can handle, check the harness first — not the model. Model capability and execution reliability are two separate dimensions.

## The Five Subsystems

A complete harness has five subsystems. Missing any one means an incomplete harness.

| Subsystem | Question It Answers | Minimal Artifact | walkinglabs Lecture |
|-----------|-------------------|------------------|---------------------|
| **Instructions** | What should the agent know? | `AGENTS.md` or `CLAUDE.md` | L02, L03, L04 |
| **Environment** | Can the agent run and verify work? | `init.sh`, `pyproject.toml` / `package.json` | L02, L06 |
| **State** | What happened last session? | `progress.md`, `feature_list.json` | L05, L08, L12 |
| **Scope** | What exactly should the agent work on? | Feature boundaries + definition of done | L07, L08 |
| **Verification** | How does the agent know it's correct? | Verification commands in AGENTS.md | L09, L10, L11 |

## How This Skill Works — Conductor Model

This skill is the **conductor**. It orchestrates sub-skills for specific harness tasks. The conductor never delegates control — it invokes a sub-skill, the sub-skill runs, control returns here for state updates.

```
User Request → Main Skill (this file) → Route to Sub-Skill → Return → State Update
```

### Sub-Skills — When to Invoke Each

| Sub-Skill | Use When |
|-----------|----------|
| `harness-engineering:bootstrap` | Setting up a new project for agents, creating AGENTS.md, feature_list.json, progress.md, init.sh from scratch |
| `harness-engineering:session` | Starting or ending a session — clock-in reads all state, clock-out updates all state and leaves clean |
| `harness-engineering:feature` | Managing feature lifecycle — not_started → active → passing/blocked, WIP=1 enforcement |
| `harness-engineering:verify` | Running verification before claiming completion — evidence before assertions always |
| `harness-engineering:review` | Spawning an independent review — separate the doer from the checker |
| `harness-engineering:diagnose` | Something failed — attribute failure to one of five layers, fix that layer, retry |

### Orchestration Pattern

The full workflow for any task:

```
SESSION START → bootstrap check → read state → pick feature → SCOPE (one feature) → IMPLEMENT → VERIFY → REVIEW → TRACK (update state) → SESSION END (clean state)
```

## Reference Files

Load these as needed. Follow the walkinglabs principle: **give a map, not an encyclopedia** — load only what the current task requires.

| Reference | When to Load |
|-----------|-------------|
| [references/five-subsystems.md](references/five-subsystems.md) | Understanding the complete harness model, auditing an existing harness |
| [references/diagnostic-loop.md](references/diagnostic-loop.md) | Something failed — root cause analysis across the five layers |
| [references/minimal-pack.md](references/minimal-pack.md) | Creating harness files from scratch — templates and file contents |
| [references/session-lifecycle.md](references/session-lifecycle.md) | Clock-in/clock-out routines, 16-step agent lifecycle |
| [references/verification-pipeline.md](references/verification-pipeline.md) | Designing verification — layered pipeline, evidence recording |
| [references/scope-control.md](references/scope-control.md) | WIP=1, definition of done, feature boundaries, placeholder ban |

---

## Bootstrap Gate — DO THIS FIRST

**Before answering the user, before reading any reference, before ANY other action — check whether harness files exist.** A project without these files has no harness. Creating them is the agent's first and only job.

### The Minimal Harness Pack (walkinglabs)

These four files are the minimum viable harness. Check for each one:

| # | File | Purpose | If Missing |
|---|------|---------|-------------|
| 1 | `AGENTS.md` or `CLAUDE.md` | Instructions: startup path, working rules, definition of done | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 2 | `feature_list.json` | State: machine-readable feature tracking | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 3 | `progress.md` | State: session log, verified status, next steps | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |
| 4 | `init.sh` | Environment: install + verify + start | **Create it** — use [references/minimal-pack.md](references/minimal-pack.md) template |

**Gate rule:** If any of these four files are missing, the agent's ENTIRE response is: report which files are missing, create them all using the templates, then report done. Do NOT take any other action until the bootstrap gate passes.

**Gate passes when:** All four files exist on disk with real content (not placeholders). Only then proceed to Phase 1.

---

## The Outer Loop — Conductor Protocol

Once the bootstrap gate passes, every user task flows through these phases.

---

### Phase 1: SESSION START — Clock In

**Invoke `harness-engineering:session`** for the clock-in sequence.

The session sub-skill handles:
1. Read ALL state files (AGENTS.md, progress.md, feature_list.json)
2. Review recent git log (understand recent changes)
3. Run `./init.sh` (verify environment is healthy)
4. If baseline verification fails, fix BEFORE starting new work
5. Announce understanding: project state, locked decisions, current task

**Gate:** All state files read, environment healthy, agent knows exactly what to work on.

---

### Phase 2: SCOPE — Pick ONE Feature

**Invoke `harness-engineering:feature`** to select and scope the work.

The feature sub-skill handles:
1. Read `feature_list.json` — what's done, what's in progress
2. WIP=1 check — only ONE feature active at a time
3. Pick highest-priority `not_started` feature (or continue active)
4. Mark feature `active`
5. Define explicit completion criteria (definition of done)

**Gate:** Exactly one feature is `active`. Exact completion criteria are written down.

---

### Phase 3: IMPLEMENT — Build the Feature

The agent implements the feature. Harness rules that apply:

1. **WIP=1** — no scope creep, no "while I'm here" refactoring
2. **No placeholders** — `pass`, `TODO`, `NotImplementedError` are forbidden in committed code
3. **Every commit must leave `init.sh` passing** — never commit broken state
4. **Auto-track after every commit** — update progress.md, feature_list.json

**CRITICAL:** The walkinglabs principle: agents must NOT declare completion just because code was written. Evidence required. Verification must run. That's Phase 4.

---

### Phase 4: VERIFY — Evidence Before Claims

**Invoke `harness-engineering:verify`** before claiming ANY completion.

The verification sub-skill enforces the walkinglabs Iron Law:

> Never claim completion without fresh verification evidence from THIS session.

1. **IDENTIFY:** What command proves this claim?
2. **RUN:** Execute the FULL command (fresh, complete, this session)
3. **READ:** Full output, check exit code, count failures
4. **VERIFY:** Does output confirm the claim?
5. **ONLY THEN:** Make the claim

**Gate:** Verification command ran THIS session, output shows ZERO failures, evidence recorded.

---

### Phase 5: REVIEW — Independent Check

**Invoke `harness-engineering:review`** for non-trivial changes.

The review sub-skill enforces the walkinglabs principle: **separate the doer from the checker.** Agents systematically over-rate their own output. An independent review agent must audit the work.

**Required for:** New modules, functions >15 lines, API endpoints, changes spanning 3+ files.
**Optional for:** Single-line bug fixes, typos, config values.

**Gate:** Review passed (or not required). All BLOCKING and MAJOR findings fixed.

---

### Phase 6: TRACK — Update State

After implementation and verification pass, update ALL state files:

1. **`progress.md`** — mark completed, update in-progress, list next steps
2. **`feature_list.json`** — mark feature `passing`, record evidence
3. **git commit** — descriptive message, safe state for next session

---

### Phase 7: SESSION END — Clock Out

**Invoke `harness-engineering:session`** for the clock-out sequence.

The session sub-skill enforces the walkinglabs exit checklist:

```
Session Exit Checklist:
- [ ] init.sh passes (install + verify)
- [ ] progress.md updated (completed, in-progress, next steps)
- [ ] feature_list.json updated (feature states accurate)
- [ ] All work committed with descriptive messages
- [ ] No debug code, print(), commented-out code, stale TODOs
- [ ] No temporary files, debug logs, scratch scripts
- [ ] Standard startup path works (./init.sh)
- [ ] Next session can start without guessing
```

**Gate:** All 8 items pass. Repo is safe for the next session.

---

## The Diagnostic Loop (When Something Fails)

**Invoke `harness-engineering:diagnose`.** Never respond to a failure by saying "the model isn't good enough."

The diagnostic loop from walkinglabs Lecture 01:

1. **Execute** — run verification, observe the failure
2. **Attribute** — which of the five layers caused it?
3. **Fix** — fix that layer of the harness
4. **Retry** — re-execute verification
5. **Never fail the same way twice** — if a failure class recurs, the harness fix was wrong

### Five-Layer Attribution

| Layer | Question | Example Failure | Harness Fix |
|-------|----------|----------------|-------------|
| **Instructions** | Was the task unclear? | "Built X but spec said Y" | Clarify AGENTS.md, add explicit rules |
| **Environment** | Were there env issues? | "Module not found: pydantic" | Fix init.sh, add missing dependency |
| **State** | Was state lost between sessions? | "Re-implemented existing feature" | Update progress.md, read it on clock-in |
| **Scope** | Did the agent overreach? | "Fixed the bug but also refactored 3 files" | Tighten definition of done, enforce WIP=1 |
| **Verification** | Were there no verification methods? | "Code looks right" (but doesn't work) | Add explicit verification commands, run them |

---

## Quick Reference

| Phase | Sub-Skill to Invoke | What Happens |
|-------|-------------------|--------------|
| 0. Bootstrap | `harness-engineering:bootstrap` | Create AGENTS.md, feature_list.json, progress.md, init.sh |
| 1. Session Start | `harness-engineering:session` | Clock-in: read all state, verify environment |
| 2. Scope | `harness-engineering:feature` | Pick one feature, WIP=1, define done |
| 3. Implement | — | Build the feature (no sub-skill — just work) |
| 4. Verify | `harness-engineering:verify` | Evidence before claims, fresh verification |
| 5. Review | `harness-engineering:review` | Independent review agent |
| 6. Track | — | Update progress.md, feature_list.json, commit |
| 7. Session End | `harness-engineering:session` | Clock-out: 8-item exit checklist |
| On Failure | `harness-engineering:diagnose` | Attribute to layer → fix harness → retry |

## Hard Constraints (Non-Negotiable)

These come directly from walkinglabs:

1. **Check the harness first** — when the model fails on a task it should handle, the problem is in the harness
2. **Evidence before claims** — never say "done" or "passing" without fresh verification output
3. **WIP = 1** — exactly one feature active. No exceptions without explicit user approval
4. **No placeholders** — `pass`, `TODO`, `NotImplementedError` are forbidden in committed code
5. **Leave a clean state** — every session ends with the repo restartable from `./init.sh`
6. **Separate doer from checker** — the agent that wrote the code cannot be the sole judge of its quality
7. **Repo is the system of record** — if it's not in the repo, it doesn't exist for the agent

## Further Reading

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — full 12-lecture course
- [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering) — curated resources
- OpenAI: "Harness Engineering — Leveraging Codex in an Agent-First World"
- Anthropic: "Effective Harnesses for Long-Running Agents"
