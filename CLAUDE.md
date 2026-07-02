# Tiger Development Kit Agent Manual

## Operating Principle

Humans own the WHY loop; agents own the HOW loop. **No build until the human approves the grilled spec.** Every handoff is a human-inspectable artifact (markdown or git), so a human can audit what the AI planned and did without reading a transcript.

The kit ships its stages as **pure skills** the user invokes directly, plus one **workflow** (`tiger-workflow-dev`) that runs the build automatically. The automated workflow is slim — **grill → lead → update-docs → ff-merge to `dev`** — where the **`tiger-lead`** stage owns the whole build loop in a single context (recon+plan → spawn coders → verify → re-plan) and **its priority-triaged e2e verification is the single in-loop quality gate**. **`tiger-security` and `tiger-reviewer` are standalone skills** a human invokes on demand; the workflow never spawns them. There is no conductor and no `/dev` command.

Document authoring is factored into focused **`tiger-docs-*` writer skills** (`tiger-docs-feature`, `tiger-docs-business`, `tiger-docs-e2e`, `tiger-docs-codemap`, `tiger-docs-release`, `tiger-docs-readme`) — loadable references with **no owned agent**. Grill loads `tiger-docs-feature` + `tiger-docs-e2e`; **update-docs** loads `tiger-docs-codemap/business/release/readme`. Loads are declared via the subagent **`skills:` frontmatter**; `tiger-lead`/`tiger-code-generator`/`tiger-reviewer` preload `tiger-code-quality`. Grill runs inline, so it invokes its writers through the Skill tool.

## Branch Model

- `main` = **protected release branch. The workflow and every build stage NEVER touch it.**
- `dev` = integration trunk; everything integrates here.
- `feature/<id>` is cut **from `dev`**. Grill creates it (`git checkout -b feature/<id> dev`) and commits the grill artifacts + board entry there.
- the lead and its coders work on `feature/<id>`; never commit onto `dev` or `main`.
- update-docs rebases `feature/<id>` onto `dev`, then **fast-forward merges to `dev`** (`git merge --ff-only`). Pushes `dev` if a remote exists. Never opens an MR, never merges to `main`.
- **`dev` → `main` is a manual human step** the kit never performs.

## Non-Negotiables

1. **Grill first for features.** For any new feature, behavior change, business process, integration, or ambiguous request, invoke `tiger-grill` before planning or coding.
2. **One question at a time.** During grill, ask a single focused question with a recommended answer.
3. **Business logic must be explicit.** Close roles, permissions, states, calculations, exceptions, data ownership, integrations, reporting, audit.
4. **Human approval is required.** The single gate is grill approval — once `feature.md` carries the frontmatter line `tiger-status: approved`, the rest of the pipeline runs autonomously.
5. **WIP = 1.** Only one feature may be `in_progress`.
6. **Explore and reuse before you build.** Read existing docs, state, types, and patterns first. The code generator climbs the lazy-senior ladder (YAGNI → repo utility → stdlib → native platform → installed dependency → minimal new code) and thinks hard before writing.
7. **Evidence before claims.** Never mark anything done without fresh verification from real execution.
8. **No comments in generated code.** Generated feature code AND the e2e keyword implementations carry NO comments — names and small functions carry meaning. The only exceptions are tool/language-required directives (shebang, `# type: ignore`, lint pragmas, legally-required license headers). The plugin's own scripts (workflow, validators, hooks) are not generated code; keep their comments but minimal.
9. **One writer per field-group; each writer commits what it owns.** Grill + human produce `tiger/features/<id>/feature.md` (merged spec + decisions + business context) plus the broad `e2e_testcases.robot` cases (each tagged `priority:high|medium|low`) **and create the board entry** (WHY + SPECIFY fields, `status: in_progress`, `phase: plan`). The **lead** enriches it with PLAN fields (`scope_map.modify`/`read_only`, `tasks[]` with `files`/`depends_on`/`context`/`verification`, RED-proven checks) and maintains `tiger/CODEBASE_MAP.md` — never rewriting grill's fields — then, once its coders have built, owns `refs/notes/e2e`, the board `phase` + `acceptance_criteria[].status`, the executable `e2e_keywords.resource`, and Robot's evidence. The **code generators** (spawned by the lead) own code, flip `tasks[].status`, append `progress.md`. **update-docs** owns the global markdown docs, the README refresh, and the passing close-out. The git note IS the grade. Always commit the board (so "resume from git + board phase" is real).
10. **Relaxed e2e case ownership.** Grill owns the agreed cases; the lead must NOT edit or delete them, but **MAY append its own cases** tagged `[Tags] source:e2e`.
11. **Scope map + per-task context required.** Every task states `MODIFY`, `READ_ONLY`, `METRIC`, plus a `context` brief (where code lives, what to reuse, how it connects, the behavior to satisfy) so a parallel generator with only the board can build it.
12. **Project rm guard required.** `install` places a PreToolUse Bash hook blocking `rm`. Do not build if it is missing. It is a speed bump, not a sandbox.

## Standard Startup

```bash
./init.sh
```

Read these per-project runtime files before work (they live in the target project, not this template):

- `CLAUDE.md`, `progress.md`, `feature_list.json`
- The active `tiger/features/<id>/feature.md` (plus its `e2e_testcases.robot` sibling), if any
- `tiger/CODEBASE_MAP.md` (structural map)

## Feature Board Contract

`feature_list.json` uses schema version 2. Each feature is a detailed kanban ticket:

- **WHY** (grill): `problem_statement`, `jtbd`, `problem_classification`, `user_context`
- **SPECIFY** (grill): `spec_file` (the `feature.md` path), `spec_status`, `approval`, `acceptance_criteria`, `scope_map.metric`
- **PLAN** (lead): `scope_map.modify`, `scope_map.read_only`, `tasks[]` (each with `files`, `depends_on`, `context`, `verification`)
- **BUILD** (code generator): `tasks[].status`, `tasks[].evidence`
- **VALIDATE** (lead): `validation`, acceptance evidence, metric notes
- **LEARN** (update-docs): `learning.technical/product/process/harness_updates`

The board must preserve reciprocal, acyclic `depends_on`/`blocks` links. `current_feature` must match the single `in_progress` feature or be `null`. The `phase` pointer is `plan | build | validate | blocked | passing`. Resume = `git log` + `git notes --ref=e2e` + board phase. The e2e note (`grade: pass|changes|blocked` + per-priority `blockers:` + ordered `fixes:`) IS the in-loop grade.

**Every stage reads the current board first and updates only its own fields — via the Python helper, never by dumping/hand-rewriting the JSON.** `install` copies `scripts/board.py` to the project as `tiger/board.py`. Read with `python3 tiger/board.py summary` (compact overview), `... current`, `... in-progress`, `... get <id> [field]`. Patch with `... set-phase`, `set-status`, `set-current`, `set-task <id> <task> <status> [--evidence …]`, `set-ac`, `add-learning`, `approve`, `add-task`, `add-feature`. It loads the full board, mutates one spot, re-checks the invariants (WIP=1, current_feature, reciprocal + acyclic links, valid status/phase), and writes back preserving everything else — refusing (exit 1, board untouched) any write that would break an invariant. This keeps reads token-cheap and writes corruption-proof.

**Memory is in git, not hidden agent state:** the board's `learning.*`, `progress.md`, `tiger/CODEBASE_MAP.md`, `tiger/business.md`, and `CLAUDE.md` — all version-controlled. Subagents deliberately do NOT use the `memory:` frontmatter field. update-docs records durable lessons in `learning.harness_updates` for a human to promote into `CLAUDE.md`.

## The Pipeline

```
human ⇄ grill → lead ───────────────────────────────────────────────────────→ update docs → ff-merge to dev
  (only gate)   opus, ONE context:  recon+plan → ( ∥ code generators in worktrees → integrate ){per wave}       opus (main untouched)
                                    → author + run Robot e2e (Playwright UI) → triage[HIGH+MED block, LOW logged]
                                    (spawns sonnet coders; the planner IS the verifier; the lead spawns update-docs on PASS)
        └── e2e "not pass" ⟲ in-context delta re-plan → rebuild → re-e2e   (≤2 no-progress rounds → blocked) ──┘
tiger-security / tiger-reviewer → STANDALONE-only (on demand; not in the loop)
```

- **bootstrap** (sonnet): **recency-aware** — reads `feature_list.json` for the **newest approved, non-passing** feature (creation order, via `python3 tiger/board.py newest-approved`), **auto-parks a stuck older `in_progress` feature** to switch to the newer one instead of re-pinning to the old one (state is in git, so a parked feature resumes later by its `featureId`), re-checks the `feature.md` approval token, resolves `today` + the `dev` trunk (creates `dev` from `main` if missing). New board.py reads: `newest-approved`, `candidates`. This is why the workflow needs no args.
- **Lead** (opus): the merged plan+verify+orchestrator that runs the whole build loop in **ONE context**. Reads the board entry + `feature.md` + `CODEBASE_MAP.md`, validates scope against the real codebase, writes the blueprint, enriches the board with PLAN fields, and **is the SOLE author of `tiger/CODEBASE_MAP.md`** — distilling relevant structure into each task's `context` (generators build from that context and never read the map); bootstraps the map when missing and refreshes it on a re-plan. It then **SPAWNS the `tiger-code-generator` coders itself** (via the Agent tool, in parallel isolated git worktrees, in **dependency waves**), integrates each wave, and **authors `e2e_keywords.resource` (Playwright behind the scenes for UI, Process/OS for the rest) and runs the agreed `e2e_testcases.robot` suite + its own acceptance checks as real processes** — then thinks of uncovered scenarios and APPENDS new `source:e2e` cases and re-runs until no meaningful scenario remains. Triages by priority (HIGH/MEDIUM block, LOW logged), records `refs/notes/e2e`, moves the board phase. On CHANGES it does a **bounded in-context delta re-plan** (open blockers → delta tasks → rebuild → re-e2e); bounded by 2 no-progress rounds → `phase: blocked`. It **never writes product code** (its coders do), **never edits grill's agreed cases or `feature.md`**, and **never closes the board to `passing`**; on a clean pass it **spawns `tiger-update-docs`** to finalize.

  **Why merged:** the old architect (plan) and e2e (verify) were separate agents that lost all context at the handoff, so every fix round paid a cold re-recon twice and the verifier re-derived coverage from scratch — the loop ran long and UI cases got missed. Merged into `tiger-lead` (one context), **the planner IS the verifier**: it knows every acceptance check and UI path it planned, so the loop is short and UI coverage is complete. The lead also has the `Write` tool the old e2e agent lacked (a root cause of stubbed UI keyword bodies).
- **Code Generator** (sonnet): unchanged except it is now **spawned by the lead** (not the workflow). Implements with strict TDD — **RED → GREEN → SIMPLIFY → re-verify GREEN → commit** — reusing before building. SIMPLIFY = shorten, apply tiger-code-quality, delete dead code, **strip all comments**, tests stay GREEN. The lead builds tasks in **dependency waves**: a 1-task wave is one solo commit; a wave of file-disjoint tasks builds by concurrent generators each in its own isolated git worktree (full TDD + verify + one commit on a per-task branch), then a serial integrator cherry-picks the disjoint branches onto `feature/<id>` and records the board.
- **Update-Docs** (opus): unchanged — **spawned by the lead on PASS**; refreshes `tiger/CODEBASE_MAP.md`, `tiger/business.md`, `tiger/release_docs.md`, and the project `README.md` (loading the `tiger-docs-*` writers), logs LOW e2e defects as known issues, closes the board to `passing`, rebases onto `dev` and **fast-forward merges to `dev`** (never touches `main`).

Speed model: no in-loop security/reviewer; independent tasks build in parallel in isolated worktrees (file-disjoint → conflict-free cherry-pick); the lead verifies in-context once every wave is integrated, so fix rounds pay no cold re-recon. A sequential feature degrades to one task per wave. Git conventions in `docs/tiger-git-best-practice.md`; test standards in `docs/tiger-unit-test-best-practice.md`; design principles in `tiger-code-quality`.

## Repository Layout

- `skills/tiger-grill/`: inline interview → `feature.md` + broad robot e2e + approval (the only human-interactive stage)
- `skills/tiger-{lead,code-generator,update-docs}/`: the three automated build-stage skills
- `skills/tiger-{security,reviewer}/`: the two **standalone-only** review gates (skills with no owned agent)
- `skills/tiger-docs-{feature,business,e2e,codemap,release,readme}/`: the 6 doc-writer references (no owned agents)
- `skills/tiger-code-quality/`: the design principles (loaded by lead, code generator, reviewer)
- `workflows/tiger-workflow-dev.js`: the slim deterministic spine — **bootstrap → `tiger-lead`** (the lead runs the build waves, e2e, re-plan, and spawns update-docs internally; the JS no longer orchestrates them). Install copies it to a project's `.claude/workflows/`, where it becomes `/tiger-workflow-dev`. Args-optional.
- `agents/`: 3 stage subagents (lead, code-generator, update-docs); opus for the lead + update-docs, sonnet for the code generator. `tiger-security`/`tiger-reviewer` are standalone skills with no owned agent.
- `templates/`: the markdown + robot starting-point files install copies into `tiger/templates/` (`feature.md`, `CODEBASE_MAP.md`, `business.md`, `release_docs.md`, `e2e_testcases.robot`, `e2e_keywords.resource`) plus the empty schema-v2 `feature_list.json` seeded to the project root
- `hooks/`: real hook wiring — `hooks.json` + `tiger-session-start.sh` (SessionStart context injection, scoped to Tiger projects). JSON+script, never markdown.
- `commands/install.md`: the one slash command — copies workflow/guard/templates, migrates old→new, verifies harness (including `main` + `dev`)
- `project-hooks/tiger-block-rm.sh`: rm guard copied into target projects
- `scripts/validate-plugin.sh` + `scripts/validate-board.py`: structural/schema + board-invariant validation

## Doc Style

Per-feature and global docs are **compact markdown** — prefer bullets and tables over paragraphs; YAML frontmatter is the machine gate. The e2e contract is a Robot Framework `.robot`/`.resource` pair (plain Given/When/Then; Robot's generated `report.html` is the browser-openable evidence). `tiger/CODEBASE_MAP.md` may include a fenced ```mermaid flowchart (GitHub renders it; stays plain-text readable) — no CDN, no HTML, no inline CSS. When a standalone rich HTML page is ever needed, follow `docs/tiger-doc-style.md` (the house palette), but the Tiger artifacts themselves are markdown.

## Skill Extension Rules

Add a new skill only when the capability has a distinct trigger, owned agents, state contract, workflow phase, or verification evidence. Otherwise extend the existing skill. When adding or changing a skill:

- Update `skills/<skill>/SKILL.md` and its owned agent(s).
- Add the skill path to `.claude-plugin/plugin.json` under `skills`.
- Add matching root `agents/*.md` registry files (frontmatter `name`/`description`/`model`/`tools`) when a skill adds owned agents.
- Update `CLAUDE.md` when rules, routing, artifacts, non-negotiables, or definition of done change; `README.md`/`AGENTS.md` for user/orientation guidance.
- Update `commands/install.md`, `workflows/tiger-workflow-dev.js`, or `hooks/` when the spine, setup, or mechanical enforcement changes. Hooks must be real JSON+script. Do not add other slash commands without explicit approval.
- Run `./init.sh` before claiming completion.

## Commands, Skills & the Workflow

- `/tiger-skills:install` — the one slash command. Copies the workflow, rm guard, and templates; **migrates an old project to the current version every run**; seeds/verifies `init.sh`/board/`progress.md` and a born `main` + `dev`. Idempotent; never grills or builds.
- The automated stages are **skills**: `tiger-grill`, `tiger-lead`, `tiger-code-generator`, `tiger-update-docs`. Use one alone, or grill → approve → run the workflow.
- The two **review gates** are **standalone skills**: `tiger-security`, `tiger-reviewer` — not in the automated loop.
- The six **`tiger-docs-*` writers** (`feature`, `business`, `e2e`, `codemap`, `release`, `readme`) are loadable references — grill and update-docs load them, or invoke one directly.
- `/tiger-workflow-dev` — the installed workflow. **No args required**; auto-discovers the **newest approved, non-passing** feature (auto-parking a stuck older one). Optional overrides: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`.

## Existing Project Adoption

`/tiger-skills:install` seeds harness state when missing and **migrates** an old-version project on every run — converting old HTML artifacts to the markdown set, rewriting board `spec_file` to `feature.md`, refreshing the installed workflow (old kept as `*.bak`), ensuring a born `main` + `dev` — preserving human-authored content (plugin-owned formats/names are migrated; your content is not clobbered). It never reads source, grills, or builds. Existing work without approval evidence gets a retrospective grill before any build.

## Definition of Done

A feature can become `passing` (only update-docs sets it) when:

- `feature.md` carries `tiger-status: approved`.
- Every task in `tasks[]` is complete.
- Every acceptance criterion is done with evidence from real execution.
- The lead's e2e verification passed with **zero HIGH and zero MEDIUM defects** (LOW logged as known issues), with fresh notes.
- The verification pipeline has fresh passing output.
- `feature_list.json`, `progress.md`, the global markdown docs (including the cumulative `tiger/business.md`), and learning fields are current.
