# Tiger Development Kit

Grill-first harness engineering plugin for Claude Code. **14 inspectable, directly-invokable skills** plus an optional **workflow** that runs the build end to end. One approved spec, git as the only bridge, every handoff a human-inspectable file.

Repository: https://gitlab.github.com/arkadaz/tiger-skills

---

## What It Is

The stages are **pure skills** you invoke by intent — grill, architect, code generator, e2e, update-docs (in-loop), plus standalone security and reviewer. A deterministic **workflow** (`tiger-workflow-dev`) chains the build when you want it automated. Use one skill alone (e.g. a security review of a branch), or run the whole pipeline.

**Inspectable artifacts.** Outputs live under `tiger/` as compact **markdown** plus one Robot Framework suite:

- `tiger/features/<id>/feature.md` — ONE merged doc per feature (problem + spec + decisions + business context). YAML frontmatter is the machine gate; the body is short bullets.
- `tiger/features/<id>/e2e_testcases.robot` — a broad Given/When/Then suite (Playwright behind the scenes; Robot's `report.html` is the run evidence).
- `tiger/CODEBASE_MAP.md`, `tiger/business.md`, `tiger/release_docs.md` — the global markdown docs.

Document authoring is factored into focused **`tiger-docs-*` writer skills** (feature, business, e2e, codemap, release, readme) — loadable references (no extra agents) that grill and update-docs load.

## Branch Model

- `main` = **protected release branch — the workflow never touches it.**
- `dev` = integration trunk; every feature integrates here.
- `feature/<id>` is cut **from `dev`**. The workflow rebases onto `dev` and **fast-forward merges to `dev`**.
- **`dev` → `main` is a manual human step** the kit never performs.

## Quickstart

Steps 0–2 are one-time setup.

### 0. Enable dynamic workflows (one-time, for the full build)

The end-to-end build is a **dynamic workflow** Claude Code runs as `/tiger-workflow-dev`:

- **Claude Code ≥ v2.1.154** (`claude --version`).
- **Dynamic workflows enabled.** On **Pro**, turn on the *Dynamic workflows* row in `/config`. On **Max / Team / Enterprise**, **Anthropic API**, or **Bedrock / Vertex AI / Foundry**, it's on by default. (Force-disabled by `"disableWorkflows": true`, `CLAUDE_CODE_DISABLE_WORKFLOWS=1`, or org settings.)

> Every individual skill works **without** this — only the one-command build needs the workflow feature.

### 1. Install into your project

```bash
claude plugin marketplace add --scope project https://gitlab.github.com/arkadaz/tiger-skills
claude plugin install --scope project tiger-skills@tiger-skills
```

> Your project should be a **git repo** — run `git init` first if needed.

### 2. Set up (inside Claude Code)

```text
/tiger-skills:install
```

Idempotent; never builds. It copies the workflow into `.claude/workflows/tiger-workflow-dev.js` (registering `/tiger-workflow-dev`), installs the rm guard, copies the markdown + robot templates, seeds an empty board, `progress.md`, and **both a born `main` and a born `dev` (branched from main)**, and scaffolds `init.sh` (detects `npm`/`cargo`/`go`/`pytest`/`make`; writes a fail-closed stub if none). **It also MIGRATES an old project to the current version every run** — old `*.html` artifacts → markdown, board `spec_file` → `feature.md`, and refreshes the installed workflow (backing the old up as `*.bak`) — preserving your authored content. Prints a status table and stops.

> After install, type `/` — `tiger-workflow-dev` should appear. If not: Claude Code too old, dynamic workflows disabled (step 0), or start a fresh session.

### 3. Grill and approve

"grill: add CSV export to the orders page". `tiger-grill` interviews you one question at a time, writes `feature.md` + the broad e2e suite under `tiger/features/<id>/`, and on your explicit **yes** flips the frontmatter token `tiger-status: approved`. This is the one human gate.

### 4. Build

```text
/tiger-workflow-dev
```

**No args** — it auto-discovers the approved in-progress feature. Allow the workflow when asked. Watch with `/workflows`; re-run to resume.

---

**Developing this plugin** (repo cloned): validate before committing.

```bash
./init.sh   # runs scripts/validate-plugin.sh
```

## Two Ways to Work

Full one-pager: [`docs/tiger-cheatsheet.md`](docs/tiger-cheatsheet.md).

**1. Pick one skill** — invoke by intent ("grill this feature", "security-review this branch", "refresh the codemap"). `tiger-security` and `tiger-reviewer` are **standalone, human-invoked** — not part of the automatic loop. Each skill writes only what it owns.

**2. Run the pipeline** — once grilled and approved, run with **no args**; it auto-discovers the feature and resolves today + the `dev` trunk, then drives every stage. Re-run to resume. (Optional overrides: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`.)

| # | Step | Who | You do |
|---|---|---|---|
| 1 | **Grill** | `tiger-grill`, one question at a time | Answer each (a recommendation is offered) until rules, edge cases, and acceptance criteria are closed |
| 2 | **Approve** | you | Review `feature.md` + `e2e_testcases.robot` in `tiger/features/<id>/`, then approve or send changes |
| 3 | Architect | architect | nothing; reads the board entry + `feature.md`, adds the plan (scope + tasks), refreshes `CODEBASE_MAP.md` |
| 4 | Build | code generator(s) | nothing; per wave, file-disjoint tasks build in parallel in isolated worktrees, integrated onto `feature/<id>`; TDD + simplify + **no comments**; reuses before it builds |
| 5 | Gate | e2e | nothing; the single gate — runs the suite, **appends new cases**, triages by priority: HIGH/MEDIUM block, LOW logged; pass = zero HIGH + zero MEDIUM, all tasks done |
| 6 | Document | update-docs | nothing; refreshes the markdown docs + README, fast-forward merges to `dev` |
| ✓ | Pass | system | `phase: passing`; `dev` updated (`dev` → `main` is your manual release step) |
| ✕ | Block | system | after no-progress rounds, `phase: blocked` + a fix list |

**Nothing builds until you approve.**

**Resume after a break** — state lives in git:
```bash
git log --oneline                 # how far the build got
git notes --ref=e2e show <commit> # the e2e gate's verdict (the loop writes only refs/notes/e2e)
# feature_list.json "phase": plan | build | validate | blocked | passing
```
Re-run `/tiger-workflow-dev` (no args); it reads the phase pointer and continues.

**Can't-skip rules:** grill before building · human approval before code · WIP=1 · rm guard installed · workflow installed.

## File Layout

```
.claude-plugin/plugin.json      Manifest (14 skills, 1 command, hooks)
.claude-plugin/marketplace.json Marketplace manifest
agents/                         6 subagents — 4 in-loop (architect, code-generator, e2e, update-docs) + standalone security, reviewer
workflows/tiger-workflow-dev.js The deterministic spine (becomes /tiger-workflow-dev when installed)
skills/                         14 skills, FLAT:
├── tiger-grill/                Inline interview → feature.md + broad robot e2e + approval (NOT a subagent)
├── tiger-{architect,code-generator,e2e,update-docs}/   in-loop stages
├── tiger-{security,reviewer}/                          standalone gates
├── tiger-docs-{feature,business,e2e,codemap,release,readme}/  6 doc-writer references (no owned agents)
└── tiger-code-quality/         The design principles (loaded by architect/code-gen/reviewer)
templates/                      feature.md, CODEBASE_MAP.md, business.md, release_docs.md, e2e_testcases.robot, e2e_keywords.resource, feature_list.json
commands/install.md             Copies workflow/guard/templates; migrates old→new; verifies harness state
hooks/                          Real hook wiring (JSON+script, never markdown)
├── hooks.json                  SessionStart wiring
└── tiger-session-start.sh      Injects the grill-first contract, only inside Tiger projects
project-hooks/tiger-block-rm.sh rm guard (copied into target projects)
scripts/{validate-plugin.sh,validate-board.py}
docs/                           Design diagram, cheatsheet, git/test best-practice, ADRs
init.sh / CLAUDE.md / README.md Entry-point files
```

### Plugin vs. your project

The plugin ships **templates and logic**, not runtime state. The board, logs, and per-feature artifacts are created in *your* project:

| Created by… | Path | What it is |
|---|---|---|
| `/install` | `feature_list.json` (root) | An **empty** schema-v2 board. `templates/feature_list.json` is the full-shape **reference** only. |
| `/install` | `progress.md` | Append-only human log |
| `/install` | `.claude/workflows/…js`, `.claude/hooks/tiger-block-rm.sh`, `tiger/templates/*` | Copies of the workflow, rm guard, templates |
| `grill` | `tiger/features/<id>/feature.md` + `e2e_testcases.robot` **+ the board entry** | Merged per-feature doc + broad e2e + WHY/SPECIFY fields |
| `architect` | `feature_list.json` (PLAN) + `tiger/CODEBASE_MAP.md` | Adds `scope_map` + `tasks[]`; bootstraps/refreshes the map |
| `e2e` | `tiger/features/<id>/e2e_keywords.resource` + `evidence/` | Executable keyword layer + Robot run evidence |
| `update-docs` | `tiger/{CODEBASE_MAP,business,release_docs}.md` + `README.md` | Cumulative project docs + refreshed README |

## The Pipeline

```
human ⇄ grill → architect → ( ‖ code generators → integrate ){per wave} → e2e → update docs → ff-merge to dev
```

The architect's tasks build in **dependency waves**: independent file-disjoint tasks build by parallel code-generator subagents in isolated worktrees, then a serial integrator cherry-picks them onto `feature/<id>`. **e2e is the single quality gate**, running after every wave is integrated. (In-loop security ∥ reviewer were removed for speed; both remain standalone.)

| Stage | Model | Role |
|---|---|---|
| **grill** (inline) | Opus | Interviews one question at a time; writes `feature.md` + a broad priority-tagged robot suite (loads `tiger-docs-feature` + `tiger-docs-e2e`); the only human gate |
| **architect** | Opus | Validates scope, enriches the board with the plan (scope + tasks + RED-first checks), maintains `CODEBASE_MAP.md` (sole author); per-task `files[]`/`depends_on` drive parallelism |
| **code generator** | Sonnet | Reuses before it builds (YAGNI → repo util → stdlib → platform → dep → new code); TDD RED→GREEN→**SIMPLIFY**→commit; **no comments** |
| **e2e** | Opus | The single gate: authors `e2e_keywords.resource`, runs the suite + acceptance checks for real, **appends new cases for uncovered scenarios**, triages by priority (HIGH/MEDIUM block, LOW logged); owns the board phase |
| **update-docs** | Opus | Refreshes the markdown docs + README (loads the `tiger-docs-*` writers), closes the board, rebases + fast-forward merges to `dev` (never touches `main`) |

Pass = zero HIGH + zero MEDIUM, all tasks done. Bounded retry: no-progress rounds → `phase: blocked` + a priority-ordered fix list.

## Slash Commands & Skills

- `/tiger-skills:install` — copy workflow/guard/templates, migrate old→new, verify harness. The one command.
- `/tiger-workflow-dev` — the installed workflow (created by `/install`).
- Stages are **skills**, invoked by intent: `tiger-grill`, `tiger-architect`, `tiger-code-generator`, `tiger-e2e`, `tiger-update-docs`, plus standalone `tiger-security`, `tiger-reviewer`.
- `tiger-code-quality` — the design principles; invoke alone or loaded by architect/code-gen/reviewer.
- The six `tiger-docs-*` **writer skills** (feature, business, e2e, codemap, release, readme) — focused references (no owned agents). Grill loads feature + e2e; update-docs loads codemap/business/release/readme. Invoke directly too ("refresh the README").
- No create-skill command. File new capabilities through the grill gate.

## Reference Docs

- `CLAUDE.md` — full operating manual: non-negotiables, board contract, the pipeline.
- `docs/tiger-cheatsheet.md` — the one-page operator reference.
- `docs/tiger-git-best-practice.md` — branch model (dev trunk, main protected), commits, namespaced notes.
- `docs/tiger-unit-test-best-practice.md` — TDD protocol, boundary testing, runnable acceptance checks.
