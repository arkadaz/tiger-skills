# Tiger Development Kit

Tiger grill-first harness engineering plugin. Seven inspectable, directly-invokable skills — and an optional workflow that runs them all in order. One approved spec, files and git as the only bridge, and every handoff is an HTML artifact you can open in a browser to see exactly what the AI planned and did.

Repository: https://gitlab.github.com/arkadaz/tiger-skills

---

## What It Is

A Claude Code plugin that gives you seven development stages as **pure skills** you invoke directly — grill, architect, code generator, security, reviewer, e2e, update-docs — plus a deterministic **workflow** (`tiger-workflow-dev`) that chains them into a full feature build when you want the whole thing automated. Use one skill on its own (e.g. just a security review of a branch), or run the workflow end to end.

**Why inspectable artifacts.** Every stage's output is a human-openable file under `tiger/`: self-contained HTML for the spec, ADRs, business one-pager, codemap, and release notes; and a Robot Framework suite (`e2e_testcases.robot`) for the e2e cases — plain Given/When/Then a human reads in seconds, with Playwright behind the scenes and Robot's generated `report.html` as the run evidence. You audit the AI's plan and work by opening files, not by scrolling a transcript.

Document authoring is factored into focused **`tiger-docs-*` writer skills** (spec, adr, business, e2e, codemap, release, readme) — loadable references (no extra agents) that grill and update-docs load to write each artifact.

## Quickstart

From zero to a running build in a few steps (0–4). Steps 0–2 are one-time setup.

### 0. Enable dynamic workflows (one-time, required for the full build)

The end-to-end build ships as a **dynamic workflow** — a script Claude Code runs as the `/tiger-workflow-dev` slash command. Claude Code only runs dynamic workflows when the feature is turned on:

- **Claude Code ≥ v2.1.154** — check with `claude --version`; update if older.
- **Dynamic workflows enabled.** On **Pro**, turn on the *Dynamic workflows* row in `/config`. On **Max / Team / Enterprise**, with **Anthropic API** access, or on **Bedrock / Vertex AI / Foundry**, it's on by default. (It can be force-disabled by `"disableWorkflows": true` in settings, `CLAUDE_CODE_DISABLE_WORKFLOWS=1`, or managed org settings — if `/tiger-workflow-dev` never shows up, check those.)

> You can use every individual skill (grill, architect, e2e, …) **without** this — only the one-command full build needs the workflow feature.

### 1. Install the plugin into your project

```bash
# in your target project
claude plugin marketplace add --scope project https://gitlab.github.com/arkadaz/tiger-skills
claude plugin install --scope project tiger-skills@tiger-skills
```

> Your project should be a **git repository** — run `git init` first if it isn't (the kit is trunk-based on `main`; `/install` and the build need git). The explicit `name@marketplace` form avoids ambiguity if you have more than one marketplace added.

### 2. Set the project up (inside Claude Code)

```text
/tiger-skills:install
```

`/install` is idempotent and never builds. It copies the workflow into `.claude/workflows/tiger-workflow-dev.js` (which **registers the `/tiger-workflow-dev` slash command** for this project), installs + verifies the rm guard, copies the artifact templates, seeds an empty board, `progress.md`, and a born `main` trunk, and **scaffolds `init.sh`** — the verification entrypoint the pipeline runs as the green-cycle gate. It detects your test command (`npm test` / `cargo test` / `go test` / `pytest` / `make test`) and writes a runnable `init.sh`; if it can't detect one, it writes a fail-closed stub for you to fill in (so no build ever runs on an unverified gate). An existing `init.sh` is kept untouched. It prints a status table and stops.

> **Smooth-setup check:** after install, type `/` — `tiger-workflow-dev` should appear in autocomplete. If it doesn't: (a) your Claude Code is older than v2.1.154, (b) dynamic workflows are disabled (step 0), or (c) the session hasn't picked up the new file yet — start a fresh session. A project workflow wins over a personal one of the same name.

### 3. Grill and approve a feature

Tell Claude what you want — "grill: add CSV export to the orders page". The `tiger-grill` skill interviews you one question at a time and writes four artifacts under `tiger/features/<id>/`. Review them and approve the set (the one human gate).

### 4. Run the build

```text
/tiger-workflow-dev
```

**No args** — it auto-discovers the approved in-progress feature from `feature_list.json`. Claude Code asks once to allow the workflow (choose **Yes**, or *Yes, and don't ask again*). Watch progress with `/workflows`; re-run the same command to resume (completed stages return cached results within the session).

---

**Developing this plugin** (you have this repo cloned). Validate the source tree before you commit:

```bash
./init.sh   # runs scripts/validate-plugin.sh
```

## Two ways to work

Full one-pager: [`docs/tiger-cheatsheet.md`](docs/tiger-cheatsheet.md).

**1. Pick one skill.** Each stage is a skill you invoke by intent — "grill this feature", "security-review this branch", "update the codemap". The read-only gates (security, reviewer, e2e) need no grill or approval; just point them at a branch or a test file. `tiger-security` and `tiger-reviewer` are **standalone, human-invoked** skills — run them on demand against a branch; they are not part of the automatic build loop. Each skill writes only what it owns.

**2. Run the whole pipeline.** Once a feature is grilled and approved, run the workflow with **no args** — it auto-discovers the approved in-progress feature from `feature_list.json` and resolves today's date and the `main` trunk, then drives every stage in order:

```text
/tiger-workflow-dev
```

Re-run it to resume — still no args needed. (Optional overrides only if you need them: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`.)

The build walks this loop. The only two steps where you act are **grill** and **approve**:

| # | Step | Who runs it | You do |
|---|---|---|---|
| 1 | **Grill** | the `tiger-grill` skill, one question at a time | Answer each question (a recommended answer is offered) until business rules, edge cases, and acceptance criteria are closed |
| 2 | **Approve** | you | Review all four artifacts in `tiger/features/<id>/` — `spec.html`, `adr.html`, `business.html`, `e2e_testcases.robot` (the build uses all of them) — then approve the set via the explicit question, or send changes |
| 3 | Architect | architect agent | nothing; reads grill's board entry, adds the plan (scope + tasks) + codemap, keeps `phase: plan` |
| 4 | Build | code generator(s) | nothing; per dependency wave — independent file-disjoint tasks built in parallel in isolated worktrees, then integrated onto `feature/<id>` (one semantic commit per task); reuses before it builds (YAGNI → repo utility → stdlib → platform → existing dep → minimal new code) |
| 5 | Gate | e2e | nothing; the single quality gate, runs once after all waves are integrated — triages every defect by priority: HIGH/MEDIUM block (priority-ordered fix list back to the generator), LOW logged as a known issue; pass = zero HIGH + zero MEDIUM, all tasks done |
| 6 | Document | update-docs | nothing; refreshes the HTML docs + the project README (loading the `tiger-docs-*` writers), opens the MR |
| ✓ | Pass | system | `phase: passing`, MR ready to review and merge |
| ✕ | Block | system | after 3 no-progress rounds, `phase: blocked` + a fix list; read it, decide next step |

**Nothing builds until you approve.** That is the gate that matters.

**Resume after a break.** State lives in git:
```bash
git log --oneline                 # how far the build got
git notes --ref=e2e show <commit> # the e2e gate's verdict (the automatic loop writes only refs/notes/e2e;
                                  # refs/notes/security and refs/notes/review exist only if you ran a standalone gate)
# feature_list.json "phase": plan | build | validate | blocked | passing
```
Re-run `/tiger-workflow-dev` (no args); it reads the phase pointer and continues.

**Can't-skip rules:** grill before building · human approval before code · one feature `in_progress` at a time (WIP=1) · rm guard installed · the workflow installed.

## File Layout

```
.claude-plugin/plugin.json      Plugin manifest (15 skills: 7 stages + code-quality + 7 tiger-docs-* writers, 1 command, hooks)
.claude-plugin/marketplace.json Marketplace manifest
agents/                         6 stage subagents — 4 spawned by the workflow (architect, code-generator, e2e, update-docs); security + reviewer are standalone-only (run on demand)
├── tiger-architect.md          Opus: enriches grill's board entry → blueprint + plan (scope/tasks) + codemap
├── tiger-code-generator.md     Sonnet: TDD, one commit per cycle
├── tiger-security.md           Opus: vuln + secrets audit, --ref=security note
├── tiger-reviewer.md           Opus: code/test quality audit, --ref=review note
├── tiger-e2e.md                Opus: writes e2e_keywords.resource (robot/Playwright), runs robot, --ref=e2e note, board phase
└── tiger-update-docs.md        Opus: docs + README refresh (loads tiger-docs-* skills), board close-out, MR
workflows/
└── tiger-workflow-dev.js       The deterministic spine (becomes /tiger-workflow-dev when installed)
skills/dev/                     The 7 stage skills + reference skills (each invoked directly, or loaded/spawned)
├── tiger-grill/                Inline interview → 3 HTML artifacts + a robot e2e suite + approval (NOT a subagent)
├── tiger-{architect,code-generator,security,reviewer,e2e,update-docs}/
├── tiger-docs-{spec,adr,business,e2e,codemap,release,readme}/  7 focused doc-writer reference skills (no owned agents)
└── tiger-code-quality/         Independent reference skill: the 16 design principles (loaded by architect/code-gen/reviewer)
templates/                      Starting-point files for a project + a reference:
├── {spec,adr,business,codemap,release_docs}.html  5 HTML artifact templates → tiger/templates/
├── e2e_testcases.robot / e2e_keywords.resource    Robot Framework e2e CASES (grill) + IMPLEMENTATIONS (e2e gate)
└── feature_list.json           A fully-worked schema-v2 board (tasks + a cross-feature dependency) — the REFERENCE shape only; `/install` seeds an EMPTY board inline and never copies this file
commands/
└── install.md                  Copies workflow/guard/templates; verifies harness state
hooks/                          Real Claude Code hook wiring (NOT markdown; markdown never fires)
├── hooks.json                  SessionStart wiring, auto-discovered
└── tiger-session-start.sh      Injects the grill-first contract, only inside Tiger projects
docs/                           All documentation lives here
├── README.md                   Index of what's in docs/
├── dev-loop-v2.md                       The CURRENT design diagram (the v2 pipeline) — source of truth for the shape
├── dev-architect.md            The prior design diagram (historical; superseded by dev-loop-v2.md)
├── tiger-cheatsheet.md         One-page operator cheat sheet
├── tiger-git-best-practice.md  Git handoff conventions (namespaced notes, rebase flow)
├── tiger-unit-test-best-practice.md  TDD and testing standards
├── PULL_REQUEST_TEMPLATE.md    MR template the update-docs stage opens with
├── decisions/                  Architecture decision records (ADRs)
├── specs/                      This kit's own development specs (e.g. the rebuild spec)
└── internal/                   Build history (not part of the installed plugin)
project-hooks/tiger-block-rm.sh rm guard script (copied into target projects)
scripts/
├── validate-plugin.sh          Plugin validation (invoked by init.sh)
└── validate-board.py           Board-invariant checker for feature_list.json
init.sh                         Standard startup + validation
CLAUDE.md                       Full agent operating manual
README.md                       This file
```

Root holds only the conventional entry-point files (`CLAUDE.md`, `README.md`, `init.sh`) plus the plugin's component and asset directories — everything documentation-shaped lives under `docs/`.

### What lives in the plugin vs. what's created in your project

The plugin ships **templates and logic**, not runtime state. The board, the logs, and the per-feature artifacts are **per-project runtime files** — they don't exist in this repo; `/install` and the pipeline create them in *your* project:

| Created in your project by… | Path | What it is |
|---|---|---|
| `/install` | `feature_list.json` (project root) | An **empty** schema-v2 kanban board so the project starts clean. The plugin's `templates/feature_list.json` is the full-shape **reference** (it has demo features) — never copied verbatim. **grill** then adds the first feature entry. |
| `/install` | `progress.md` | Append-only human log |
| `/install` | `.claude/workflows/tiger-workflow-dev.js`, `.claude/hooks/tiger-block-rm.sh`, `tiger/templates/*` | Copies of the plugin's workflow, rm guard, and the artifact templates (HTML + robot e2e) |
| `grill` | `tiger/features/<id>/{spec,adr,business}.html` + `e2e_testcases.robot` **+ the `feature_list.json` entry** | The approved per-feature artifact set, plus the board entry's WHY/SPECIFY fields |
| `architect` | `feature_list.json` (PLAN fields) | Adds `scope_map` + `tasks[]` to grill's entry |
| `update-docs` | `tiger/{codemap,business,release_docs}.html` + `README.md` | The cumulative project docs + the refreshed project README |
| `e2e` | `tiger/features/<id>/e2e_keywords.resource` + `tiger/features/<id>/evidence/` | The executable robot keyword layer it authors + Robot's run evidence |

## The Pipeline

```
human ⇄ grill → architect → ( ‖ code generators → integrate ){per wave} → e2e → update docs → MR
```

The build runs the architect's tasks in **dependency waves**: independent, file-disjoint tasks in a wave are built by parallel code-generator subagents, each in its own isolated git worktree, then integrated onto `feature/<id>` by a serial integrator. **e2e is the single quality gate** and runs once after every wave is integrated. A sequential feature degrades to one task per wave. (The in-loop security ∥ reviewer gates were removed for speed; both still exist as standalone skills a human runs on demand.)

| Stage | Model | Role |
|---|---|---|
| **grill** (inline skill) | Opus | Interviews you one question at a time (digging deep — it asks more, not fewer); writes the four artifacts (3 HTML + the robot e2e suite, each case priority-tagged with you) by loading the `tiger-docs-*` writers; the only human gate |
| **architect** | Opus | Validates scope vs the codebase, enriches grill's board entry with the plan (scope + tasks + RED-first checks) + codemap; precise per-task `files[]`/`depends_on` drive the parallelism |
| **code generator** | Sonnet | Thinks hard, then reuses before it builds (YAGNI → repo utility → stdlib → platform → existing dep → minimal new code), never simplifying away quality gates (validation, error handling, security/authz, accessibility, spec behavior); TDD red→green; solo (one commit on `feature/<id>`) or parallel worktree-per-task (commit on a branch) + serial integrator |
| **e2e** | Opus | The single quality gate, runs once after all waves are integrated: authors `e2e_keywords.resource` (robot/Playwright), runs the `e2e_testcases.robot` suite + acceptance checks as real processes; triages each defect by priority (HIGH/MEDIUM block, LOW logged as a known issue); owns the board phase |
| **update-docs** | Opus | Refreshes codemap/business/release HTML + the project README (loads the `tiger-docs-*` writers), closes the board to `passing`, opens the MR (never merges) |

Pass = zero HIGH + zero MEDIUM defects, all tasks done. Bounded retry: 3 no-progress rounds → `phase: blocked` + a priority-ordered fix list.

## Slash Commands & Skills

- `/tiger-skills:install` — copy the workflow/guard/templates and verify harness state. The one command.
- `/tiger-workflow-dev` — the installed workflow that runs the full pipeline (created by `/install`).
- The seven stages are **skills**, invoked by intent (`tiger-grill`, `tiger-architect`, `tiger-security`, `tiger-reviewer`, `tiger-e2e`, `tiger-update-docs`, `tiger-code-generator`). No conductor, no `/dev` command.
- `tiger-code-quality` — an independent reference skill (the 16 design principles). Invoke it on its own to review/explain design quality, or it loads as one of the skills the architect, code generator, and reviewer use. Skills are independent; agents compose the set they need.
- The seven `tiger-docs-*` **writer skills** (`spec`, `adr`, `business`, `e2e`, `codemap`, `release`, `readme`) — focused, loadable references (no owned agents), one per artifact. Grill loads spec/adr/business/e2e to author its set; update-docs loads codemap/business/release/readme at close-out. Invoke one directly too: "refresh the README", "write the robot e2e cases for `<id>`".
- No create-skill command. For new plugin capabilities, file a feature through the grill gate.

## Reference Docs

- `CLAUDE.md`: full operating manual — the 11 non-negotiables, the feature board contract, the 7-stage pipeline.
- `docs/tiger-cheatsheet.md`: the one-page operator reference.
- `docs/dev-architect.md`: the design diagram (pink = stage skills, blue = human, green = HTML artifacts, yellow = notes).
- `docs/tiger-git-best-practice.md`: branch model, semantic commits, namespaced git notes, rebase flow.
- `docs/tiger-unit-test-best-practice.md`: TDD protocol, boundary testing, runnable acceptance checks.

Build history (how the kit was made, not needed to use it) lives in `docs/internal/`.
