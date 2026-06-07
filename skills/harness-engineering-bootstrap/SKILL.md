---
name: harness-engineering-bootstrap
description: Bootstrap a harness from scratch — create AGENTS.md/CLAUDE.md, feature_list.json, progress.md, and init.sh for a project that has none. Use when setting up a new project for AI agents or when a project lacks harness files.
---

# Bootstrap — Create the Minimal Harness Pack

Based on walkinglabs [Resource Library](https://walkinglabs.github.io/learn-harness-engineering/en/resources/) templates. Creates the four files that form the minimum viable harness.

## The Minimal Pack

| File | Subsystem | Purpose |
|------|-----------|---------|
| `AGENTS.md` or `CLAUDE.md` | Instructions | Startup path, working rules, definition of done |
| `feature_list.json` | State + Scope | Machine-readable feature tracking |
| `progress.md` | State | Session log, verified status, next steps |
| `init.sh` | Environment + Verification | Install + verify + start |

## Bootstrap Protocol

### Step 1: Explore the Project

Before creating ANY files, understand what's there:

1. **Read the project structure** — Glob for key files (`*.py`, `*.rs`, `*.ts`, `pyproject.toml`, `package.json`, `Cargo.toml`)
2. **Read the README** — what does the project do?
3. **Check for existing harness files** — some may already exist, don't overwrite without asking
4. **Identify the tech stack** — language, framework, package manager, test runner
5. **Identify verification commands** — what commands prove the project works?

### Step 2: Create AGENTS.md

Load [harness-engineering references/minimal-pack.md](../harness-engineering/references/minimal-pack.md) for the template.

Rules:
- Keep under 150 lines — it's a router, not an encyclopedia
- Include: project overview, quick start, working rules, definition of done, verification commands, directory map, hard constraints
- **Use REAL data from the project** — real tech stack, real directories, real commands. No placeholders.
- If the project has >150 lines worth of instructions, split into `docs/` topic docs and link from AGENTS.md

### Step 3: Create feature_list.json

Load [harness-engineering references/minimal-pack.md](../harness-engineering/references/minimal-pack.md) for the template.

Rules:
- Use the exact state machine: `not_started` → `in_progress` → `passing`, with `blocked` as side exit
- **Populate with REAL features** — read the README, git log, or ask the user what features exist/are planned
- Each feature MUST have: `user_visible_behavior` (happy path + error cases), `verification` (specific steps), `status` (one of four)
- Include the kanban fields: `depends_on`/`blocks` (ticket links, reciprocal, acyclic), `acceptance_criteria` (`{id,text,done}`), and an empty `tasks[]` (the planner fills it later from its blueprint)
- Include `task_status_legend` and `link_semantics` at the top level (see minimal-pack template)
- Leave the `evidence` array empty — that gets filled as features pass verification

### Step 4: Create progress.md

Load [harness-engineering references/minimal-pack.md](../harness-engineering/references/minimal-pack.md) for the template.

Rules:
- Record current state: latest commit, branch, verification status
- Populate Completed/In Progress from git log and feature_list.json
- Known Issues: if `./init.sh` fails, document it here with root cause
- Next Steps: ordered by priority — top item is what the next session starts with

### Step 5: Create init.sh

Load [harness-engineering references/minimal-pack.md](../harness-engineering/references/minimal-pack.md) for the template.

Rules:
- `INSTALL_CMD` — the command to install dependencies (detect from package manager)
- `VERIFY_CMD` — the command to run baseline verification (detect from project config)
- `START_CMD` — the command to start the app (detect from project scripts)
- Make it executable: `chmod +x init.sh`
- Test it: run `./init.sh` to confirm it works from a clean state

### Step 6: Test the Complete Pack

After creating all four files:

1. Run `./init.sh` — must pass from clean state
2. Verify `feature_list.json` has valid JSON syntax
3. Verify `AGENTS.md` is under 150 lines
4. Verify `progress.md` reflects current reality
5. **Seed the codebase map (recommended when the project already has code):** spawn the `cartographer` agent to create `CODEBASE_MAP.md` — Mermaid architecture + code-flow diagrams and the function inventory (inputs/outputs, file:line). From then on it is refreshed automatically at GATE 12b after every finished feature, and the explorer reads it first. For an empty/new project, skip — the first finished feature creates it.
6. Report: "Minimal harness pack created. [N] files. [./init.sh] passed. Next: pick feature-001 from feature_list.json."

## Gate Rule

If any of the four files are missing from a project, the agent's ENTIRE response is creating them. Do NOT take any other action. The bootstrap gate must pass before any other work begins.

## Anti-Patterns

- **Empty templates:** Creating AGENTS.md with placeholder text like "[Project overview here]" — the agent must populate with REAL content from the codebase
- **Skipping exploration:** Creating files without reading the codebase first — leads to wrong tech stack, wrong commands, wrong constraints
- **Overwriting without asking:** A project may have partial harness files — improve them, don't replace them
- **Encyclopedic AGENTS.md:** 500-line instruction file that no agent will actually read — keep it under 150 lines
