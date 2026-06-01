# The Five Subsystems of a Harness

From walkinglabs Lecture 02: *What a Harness Actually Is*. A harness is not a prompt file — a prompt file alone is insufficient. A harness is "everything in the engineering infrastructure outside the model weights."

> The harness determines how much of a model's capability actually gets realized. — walkinglabs

## The Model

| Subsystem | Question It Answers | Minimal Artifact | Mature Artifact | walkinglabs Lecture |
|-----------|-------------------|------------------|-----------------|---------------------|
| **Instructions** | What should the agent know? | `AGENTS.md` / `CLAUDE.md` | Topic docs in `docs/`, routing file under 150 lines | L02, L03, L04 |
| **Environment** | Can the agent run and verify? | `init.sh` | `pyproject.toml`, lock files, Docker, `.nvmrc` | L02, L06 |
| **State** | What happened last session? | `progress.md`, `feature_list.json` | `session-handoff.md`, DECISIONS.md, git log | L05, L08, L12 |
| **Scope** | What exactly should the agent do? | Feature boundaries + definition of done | Feature dependency maps, scope checklists | L07, L08 |
| **Verification** | How does the agent know it's correct? | Verification commands in AGENTS.md | Layered pipeline (static → unit → E2E), evidence tracking | L09, L10, L11 |

## Instructions — The Agent's Operating Manual

"Give a map, not a manual." — walkinglabs

The instruction file (AGENTS.md or CLAUDE.md) is a **router**, not an encyclopedia. Keep it under 150 lines. Beyond that, the lost-in-the-middle effect degrades compliance.

**What belongs in the instruction file:**
- Project overview (2-3 sentences)
- Tech stack with versions
- Startup commands (`./init.sh`)
- Hard constraints (non-negotiable rules)
- Verification commands
- Links to topic docs for detail

**What does NOT belong:**
- Full architecture documentation (→ `docs/`)
- Detailed coding conventions (→ topic docs loaded on demand)
- API reference (→ OpenAPI spec or inline docs)
- History of decisions (→ DECISIONS.md)

The walkinglabs 20/80 rule: 20% of information in AGENTS.md covers 80% of what the agent needs. The remaining 20% is in topic docs loaded on demand.

## Environment — Self-Describing Runtime

The environment must be reproducible and self-describing. The agent should never burn context on dependency errors.

**Minimum:** `init.sh` that runs install + verify
**Mature:** `pyproject.toml` / `package.json` with locked deps, `.nvmrc` / `.python-version` for runtime version, Docker for full reproducibility

The walkinglabs test: can a fresh clone run `./init.sh` and pass all verification without any manual setup? If not, the environment subsystem is incomplete.

## State — Progress Across Sessions

"Persist progress to disk; pick up where you left off." — walkinglabs

State files are what replace "hey, what were you working on yesterday?" They MUST be updated every session. A stale state file is worse than no state file — it sends the agent in the wrong direction.

**Core state files:**
- `progress.md` — session log: completed, in-progress, known issues, next steps
- `feature_list.json` — machine-readable feature state machine

**Operational protocol:**
- **Clock-in:** Read progress.md + feature_list.json FIRST
- **Clock-out:** Update both files LAST, before committing

## Scope — Work Boundaries

"One feature at a time; explicit definition of done." — walkinglabs

Without explicit scope, agents overreach (fix a bug → refactor half the codebase) and under-finish (implement the happy path → declare done → leave error handling as a TODO).

**Scope enforcement:**
- WIP = 1: exactly one feature active at a time
- Every feature has a written definition of done
- The definition of done includes verification commands
- Scope creep is the #1 cause of "almost done" that's actually broken

## Verification — Evidence-Based Completion

"The highest-ROI subsystem." — walkinglabs

Agents "confidently praise their own work" (Anthropic). The fix: explicit verification commands that must run and pass before completion can be claimed.

**The Iron Law:** Never claim completion without fresh verification evidence from THIS session.

**Verification commands must be:**
1. **Explicit** — a specific command, not "run the tests"
2. **Runnable** — works from a fresh clone after `./init.sh`
3. **Decisive** — returns clear pass/fail, not "looks good"
4. **Fresh** — must have run THIS session, after the last code change

## The Controlled Variable Exclusion Test

From walkinglabs Lecture 02: to find which subsystem matters most for your project:

1. Keep the model fixed
2. Remove one subsystem at a time (not all at once)
3. Measure the performance drop
4. The subsystem whose removal causes the largest drop has the highest marginal contribution

Anthropic's finding: as models grow stronger, some components cease being critical — but new critical components always emerge. Audit regularly.

## Harness Debt

"Harness rots like code does. Audit regularly, and pay down harness debt just like you pay down technical debt." — walkinglabs

Symptoms of harness debt:
- AGENTS.md references commands that no longer work
- feature_list.json has features marked `active` from three weeks ago
- `./init.sh` fails on a fresh clone
- Verification commands are in AGENTS.md but nobody runs them

Schedule harness audits: every 10 sessions, audit all five subsystems. Fix the lowest-scoring one.
