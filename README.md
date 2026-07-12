# Tiger Development Kit

Grill-first harness engineering plugin for Claude Code. You drive it with **two entry points — `tiger-grill` and the `tiger-workflow-dev` workflow**; **10 skills** power the build the workflow runs. One approved spec, git as the only bridge, every handoff a human-inspectable file.

Repository: https://gitlab.github.com/arkadaz/tiger-skills

---

## What It Is

The stages are **pure skills** you invoke by intent — grill, lead, code generator, update-docs (in-loop), plus the standalone `tiger-review` gate. Grill interviews you deeply and writes **two docs per feature**: a detailed, agent-facing `spec.md` (exact requirements, rules, error tables, worked examples, testable acceptance criteria) and a one-page human `feature.md` carrying the approval token. The **lead** merges planning and end-to-end verification into one agent: it plans from `spec.md`, **authors the broad e2e suite itself** (covering everything it judges can happen — not a fixed set), and for a typical feature **builds + verifies inline in one warm context** (the fast path). A **workflow** (`tiger-workflow-dev`) chains the build when you want it automated as a **thin launcher** — it makes one spawn, the lead in CONDUCT mode, and the **lead itself** spawns coders for genuinely large features (parallel isolated worktrees per dependency wave + an integrator; nested subagents work in Claude Code v2.1.172+, depth ≤ 5). Use one skill alone, or run the whole pipeline.

**Inspectable artifacts.** Outputs live under `tiger/` as compact **markdown** plus one Robot Framework suite per feature:

- `tiger/features/<id>/spec.md` — the DETAILED requirements (agent-facing; the behavior contract).
- `tiger/features/<id>/feature.md` — the one-page human summary; its YAML frontmatter is the approval gate.
- `tiger/features/<id>/e2e_testcases.robot` — the lead-authored broad Given/When/Then suite (Playwright behind the scenes; Robot's `report.html` is the run evidence).
- `tiger/CODEBASE_MAP.md`, `tiger/business.md`, `tiger/release_docs.md` — the global markdown docs.

All document-authoring rules live in ONE loadable reference — the **`tiger-docs`** skill; the build discipline (design principles + write-less + say-less) lives in **`tiger-code-quality`**.

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

Idempotent; never builds. It copies both workflows into `.claude/workflows/` (registering `/tiger-workflow-dev` and `/research-workflow`), installs the rm guard, copies the markdown + robot templates, seeds an empty board, `progress.md`, and **both a born `main` and a born `dev`**, and scaffolds `init.sh` (detects `npm`/`cargo`/`go`/`pytest`/`make`; writes a fail-closed stub if none). **It also MIGRATES an old project to the current version every run** — old `*.html` artifacts → markdown, board `spec_file` → `feature.md`, plugin-owned workflows/templates refreshed (old kept as `*.bak`) — preserving your authored content. Research-loop files are optional: a missing source degrades to `NEEDS HUMAN`, never a failed install. Prints a status table and stops.

> After install, type `/` — `tiger-workflow-dev` should appear. If not: Claude Code too old, dynamic workflows disabled (step 0), or start a fresh session.

### 3. Grill and approve

"grill: add CSV export to the orders page". `tiger-grill` interviews you one question at a time — and it asks a LOT, until every requirement is concrete — then writes `spec.md` (detailed, for the agents) + `feature.md` (the summary you approve) under `tiger/features/<id>/`. On your explicit **yes** it flips the frontmatter token `tiger-status: approved`. This is the one human gate.

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

**1. Pick one skill** — invoke by intent ("grill this feature", "review this branch", "refresh the codemap"). `tiger-review` (quality + security in one pass) is **standalone, human-invoked** — not part of the automatic loop. Each skill writes only what it owns.

**2. Run the pipeline** — once grilled and approved, run with **no args**; it auto-discovers the feature and resolves today + the `dev` trunk, then drives every stage. Re-run to resume. (Optional overrides: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`.)

| # | Step | Who | You do |
|---|---|---|---|
| 1 | **Grill** | `tiger-grill`, one question at a time | Answer each (a recommendation is offered) until every rule, edge case, and acceptance criterion is spec-grade concrete |
| 2 | **Approve** | you | Review `feature.md` (+ the `spec.md` detail) in `tiger/features/<id>/`, then approve or send changes |
| 3 | Plan · e2e · build · verify | lead (spawns coders itself only for large features) | nothing; the lead recons + plans from `spec.md`, **authors the broad e2e suite** (boundary/typical/adversarial/error, priority-tagged), then DEFAULT builds + verifies the feature inline in one warm context — or, for a genuinely large feature, spawns parallel worktree coders + an integrator itself, then verifies. Verify always runs the whole `tiger/features/` folder for real (Playwright for UI) and triages by priority: HIGH/MEDIUM block (bounded delta re-plan), LOW logged |
| 4 | Document | update-docs | nothing; refreshes the markdown docs + README, fast-forward merges to `dev` |
| ✓ | Pass | system | `phase: passing`; `dev` updated (`dev` → `main` is your manual release step) |
| ✕ | Block | system | after no-progress rounds, `phase: blocked` + a fix list |

**Nothing builds until you approve.**

**Resume after a break** — state lives in git:
```bash
git log --oneline                 # how far the build got
git notes --ref=e2e show <commit> # the lead's e2e verdict (the loop writes only refs/notes/e2e)
# feature_list.json "phase": plan | build | validate | blocked | passing
```
Re-run `/tiger-workflow-dev` (no args); it reads the phase pointer and continues.

**Can't-skip rules:** grill before building · human approval before code · WIP=1 · rm guard installed · workflow installed.

## File Layout

```
.claude-plugin/plugin.json      Manifest (10 skills, 1 command, hooks)
.claude-plugin/marketplace.json Marketplace manifest
agents/                         5 subagents: dev (lead, code-generator, update-docs) + research (tiger-researcher, tiger-novelty-critic)
workflows/tiger-workflow-dev.js The deterministic dev spine (becomes /tiger-workflow-dev when installed)
workflows/research-workflow.js  The git-free research spine (becomes /research-workflow when installed)
skills/                         10 skills, FLAT:
├── tiger-grill/                Inline interview → spec.md + feature.md + approval (NOT a subagent)
├── tiger-{lead,code-generator,update-docs}/   in-loop stages
├── tiger-review/               the standalone quality + security gate (skill only, no owned agent)
├── tiger-docs/                 ONE doc-writer reference: spec/feature/e2e/codemap/business/release/README
├── tiger-code-quality/         design principles + SIMPLIFY + write-less ladder + say-less handoffs
└── research-goal/ + tiger-{researcher,novelty-critic}/  the research loop: /research-goal gate + iteration agent + novelty veto
templates/                      spec.md, feature.md, CODEBASE_MAP.md, business.md, release_docs.md, e2e_testcases.robot, e2e_keywords.resource, feature_list.json, research/*
scripts/                        board.py + research.py (project helpers), validate-plugin.sh, validate-board.py, validate-research.py
commands/install.md             Copies workflows/guard/templates; migrates old→new; verifies harness state
hooks/                          Real hook wiring (JSON+script, never markdown)
├── hooks.json                  SessionStart wiring
└── tiger-session-start.sh      Injects the grill-first contract, only inside Tiger projects
project-hooks/tiger-block-rm.sh rm guard (copied into target projects)
docs/                           Design diagram, cheatsheet, git/test best-practice, ADRs
init.sh / CLAUDE.md / README.md Entry-point files
```

### Plugin vs. your project

The plugin ships **templates and logic**, not runtime state. The board, logs, and per-feature artifacts are created in *your* project:

| Created by… | Path | What it is |
|---|---|---|
| `/install` | `feature_list.json` (root) | An **empty** schema-v2 board. `templates/feature_list.json` is the full-shape **reference** only. |
| `/install` | `progress.md` | Append-only human log |
| `/install` | `.claude/workflows/…js`, `.claude/hooks/tiger-block-rm.sh`, `tiger/templates/*` | Copies of the workflows, rm guard, templates |
| `grill` | `tiger/features/<id>/spec.md` + `feature.md` **+ the board entry** | Detailed requirements + human summary + WHY/SPECIFY fields |
| `lead` | `feature_list.json` (PLAN) + `tiger/CODEBASE_MAP.md` + `tiger/features/<id>/e2e_testcases.robot` | Adds `scope_map` + `tasks[]`; bootstraps/refreshes the map; authors the broad e2e suite |
| `lead` | `tiger/features/<id>/e2e_keywords.resource` + `tiger/evidence/` | Executable keyword layer + Robot run evidence |
| `update-docs` | `tiger/{CODEBASE_MAP,business,release_docs}.md` + `README.md` | Cumulative project docs + refreshed README |

## The Pipeline

```
human ⇄ grill (spec.md + feature.md) → lead CONDUCT (recon + plan + AUTHOR e2e suite)
   → DEFAULT inline: lead builds + verifies in one warm context ──────────────────────────┐
   → waves (large): the LEAD spawns coders itself ( ‖ worktrees + integrate )             │
       → VERIFY ( robot over all of tiger/features/ → priority triage → bounded           │
         delta re-plan; lead rebuilds itself ) ──────────────────────────────────────────┤
   → on PASS the LEAD finalizes (inline: itself · waves: spawns update-docs) → ff-merge to dev ◄─┘
```

The **lead** owns planning, the e2e suite, verification, AND the conducting: it spawns coders itself only when it chose waves (nested subagents work in Claude Code v2.1.172+). Because the planner IS the verifier AND the suite's author, every acceptance check and UI path it planned is one it knows how to test — and because the suite is authored from `spec.md` **before any code exists**, the inline fast path stays honest: the lead is graded by cases it pre-committed. On a clean pass the lead finalizes — in inline mode it closes out itself; in waves mode it spawns update-docs. (In-loop security/review was removed for speed; `tiger-review` remains standalone.)

| Stage | Model | Role |
|---|---|---|
| **grill** (inline) | Opus | Interviews one question at a time, deeply; writes `spec.md` (detailed, agent-facing) + `feature.md` (human summary + gate token) via the `tiger-docs` writer; the only human gate |
| **lead** | Opus | The merged plan+e2e+verify: validates scope against the real code, writes the board plan (scope + tasks + RED-first checks), sole in-loop author of `CODEBASE_MAP.md`, **authors the broad priority-tagged e2e suite from spec.md**; DEFAULT builds + verifies inline (one warm context); for large features spawns coders itself (parallel worktrees + integrator) then verifies; runs the whole folder for real (Playwright for UI), triages by priority, owns `refs/notes/e2e`; bounded delta re-plan; on PASS finalizes (inline: closes out itself; waves: spawns update-docs) |
| **code generator** | Sonnet | Spawned by the lead in waves mode (solo for a 1-task wave; isolated worktrees + an integrator for a multi-task wave); reuses before it builds; TDD RED→GREEN→**SIMPLIFY**→commit; **no comments** |
| **update-docs** | Opus | Spawned by the lead on PASS **in waves mode** (in inline mode the warm lead does this close-out itself); refreshes the markdown docs + README (per the `tiger-docs` sections), closes the board, rebases + fast-forward merges to `dev` (never touches `main`) |

Pass = zero HIGH + zero MEDIUM, all tasks done. Bounded retry: no-progress rounds → `phase: blocked` + a priority-ordered fix list.

## Research Loop (discovery, git-free)

A **second, standalone loop** alongside the dev pipeline — **discovery, not delivery**. The dev pipeline *delivers* one approved feature onto `dev` (git bridges every handoff); the research loop *discovers* a better method by running many **novel** experiments against a frozen, deterministic metric. It is **git-free — local files/folders only** (no branch, commit, note, or merge), so it runs in **any directory**: no repo, no board.

Two entry points (everything else is internal):

- **`/research-goal`** — the goal grill (mirrors `tiger-grill`): inline, one question at a time, writes `research/<goalId>/goal.md` (metric + direction + target, frozen controlled vars, the one deterministic harness command, budget, taxonomy). Gated by a `tiger-status: approved` line — the one human gate.
- **`/research-workflow`** — the autonomous loop. **No args**; reads the approved goal and self-paces. Each iteration a fresh `tiger-researcher` (opus) reconstructs from files, **deliberates** a next-move (recorded in `deliberation.md`), mines fresh sources, clears the **novelty gate** (`tiger/research.py`: no pure tuning; every experiment must add a never-seen method component + a freshly-fetched source), then builds + runs the harness **for real** and logs one immutable `experiments/experimentN/` card.

Internal, workflow-spawned, `tiger-*` namespaced: `tiger-researcher`, `tiger-novelty-critic`, `tiger/research.py`.

**State is the folder tree — resume = re-run `/research-workflow`** (it reads `research/<goalId>/research_ledger.json` + the experiment folders and continues). On stop it writes `research/<goalId>/REPORT.md` (idea → hypothesis → result table, the winning method + its provenance chain, the dead-ends) that **points at** the best experiment folder — promoting a winner into real code is a **manual human step**.

## Slash Commands & Skills

- `/tiger-skills:install` — copy workflows/guard/templates, migrate old→new, verify harness. The one command.
- `/tiger-workflow-dev` — the installed dev workflow (created by `/install`). `/research-workflow` — the installed research loop.
- Stages are **skills**, invoked by intent: `tiger-grill`, `tiger-lead`, `tiger-code-generator`, `tiger-update-docs`, plus standalone `tiger-review`.
- `tiger-code-quality` — design principles + write-less + say-less; invoke alone or loaded by the loop agents.
- `tiger-docs` — every artifact's writing rules in one reference (spec, feature, e2e, codemap, business, release, README). Grill/lead/update-docs load the sections they own; invoke directly too ("refresh the README").
- No create-skill command. File new capabilities through the grill gate.

## Reference Docs

- `CLAUDE.md` — full operating manual: non-negotiables, board contract, the pipeline.
- `docs/tiger-cheatsheet.md` — the one-page operator reference.
- `docs/tiger-git-best-practice.md` — branch model (dev trunk, main protected), commits, namespaced notes.
- `docs/tiger-unit-test-best-practice.md` — TDD protocol, boundary testing, runnable acceptance checks.
