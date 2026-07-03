# Tiger Development Kit Agent Manual

## Operating Principle

Humans own the WHY loop; agents own the HOW loop. **No build until the human approves the grilled spec.** Every handoff is a human-inspectable artifact (markdown or git), so a human can audit what the AI planned and did without reading a transcript.

The kit ships its stages as **pure skills** the user invokes directly, plus one **workflow** (`tiger-workflow-dev`) that runs the build automatically. **The workflow is the conductor** — it spawns every agent itself, because a subagent cannot spawn its own subagents (the runtime caps agent nesting at one level). The spine is **grill → lead PLAN → (workflow builds each dependency wave with tiger-code-generator coders) → lead VERIFY → re-plan loop → (workflow spawns update-docs) → ff-merge to `dev`**. **PLAN is adaptive:** for a small, low-risk feature the lead builds + verifies it **inline in one warm context** (fastest — no cold coder spawns; doer=checker, held to grill's agreed e2e + RED-proven acceptance) and returns a grade, so the workflow skips straight to finalize; for a larger feature it returns dependency waves and the conductor spawns independent coders + a separate VERIFY. The **`tiger-lead`** stage owns planning and verification (two conductor-driven modes: PLAN — adaptively returns dependency waves OR builds inline; VERIFY runs the suite + returns the grade/delta) and **its priority-triaged e2e verification is the single in-loop quality gate**. **`tiger-security` and `tiger-reviewer` are standalone skills** a human invokes on demand; the workflow never spawns them. No `/dev` command.

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
9. **One writer per field-group; each writer commits what it owns.** Grill + human produce `tiger/features/<id>/feature.md` (merged spec + decisions + business context) plus the broad `e2e_testcases.robot` cases (each tagged `priority:high|medium|low`) **and create the board entry** (WHY + SPECIFY fields, `status: in_progress`, `phase: plan`). The **lead** enriches it with PLAN fields (`scope_map.modify`/`read_only`, `tasks[]` with `files`/`depends_on`/`context`/`verification`, RED-proven checks) and maintains `tiger/CODEBASE_MAP.md` — never rewriting grill's fields — then, once its coders have built, owns `refs/notes/e2e`, the board `phase` + `acceptance_criteria[].status`, the executable `e2e_keywords.resource`, and Robot's evidence. The **code generators** (spawned by the workflow-conductor, one per task) own code, flip `tasks[].status`, append `progress.md`. **update-docs** owns the global markdown docs, the README refresh, and the passing close-out. The git note IS the grade. Always commit the board (so "resume from git + board phase" is real).
10. **Per-feature e2e cases; the lead runs the WHOLE folder every verify.** Each feature keeps its own `tiger/features/<id>/e2e_testcases.robot` + `e2e_keywords.resource`. The lead verifies by running **every feature's suite as a regression** — `robot tiger/features/` — not just the current feature. Grill owns the agreed cases; the lead must NOT edit or delete them, but **MAY append its own cases** tagged `[Tags] source:e2e`. A case of an already-**passing** feature that regresses is **HIGH — it blocks and must be fixed until green regardless of its priority tag** (a new feature must not break a shipped one). **Dedup exception:** when the folder run exposes genuine DUPLICATION with a prior feature (a copy-pasted keyword/case, contradictory coverage), the lead MAY reconcile/dedupe that prior feature's e2e — the ONE scoped exception to "never edit agreed cases," recorded in `progress.md` + the note; changing a prior feature's AGREED behavior is a spec conflict → `blocked`, never a silent overwrite.
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
human ⇄ grill → [ WORKFLOW = CONDUCTOR, spawns every agent (subagents can't nest-spawn) ] → ff-merge to dev
  (only gate)   bootstrap → lead PLAN (opus, ADAPTIVE): recon+plan →                       (main untouched)
                          → buildMode=inline (small): lead builds+verifies in one warm context → finalize
                          → buildMode=waves (larger): workflow builds each wave: ∥ file-disjoint sonnet coders in worktrees + integrator (1-task wave = solo)
                          → lead VERIFY (opus): author + run Robot e2e for ALL features (robot tiger/features/,
                            Playwright UI) → triage[HIGH+MED block, regression=HIGH, LOW logged]
        └── VERIFY "not pass" ⟲ lead writes delta tasks → workflow rebuilds → re-VERIFY  (≤3 rounds → blocked) ──┘
                          → on PASS the workflow spawns update-docs (opus) → ff-merge to dev
tiger-security / tiger-reviewer → STANDALONE-only (on demand; not in the loop)
```

- **bootstrap** (sonnet): **recency-aware** — reads `feature_list.json` for the **newest approved, non-passing** feature (creation order, via `python3 tiger/board.py newest-approved`), **auto-parks a stuck older `in_progress` feature** to switch to the newer one instead of re-pinning to the old one (state is in git, so a parked feature resumes later by its `featureId`), re-checks the `feature.md` approval token, resolves `today` + the `dev` trunk (creates `dev` from `main` if missing). New board.py reads: `newest-approved`, `candidates`. This is why the workflow needs no args.
- **Lead** (opus): the plan+verify agent the conductor drives in two modes. **MODE PLAN (adaptive)** — reads the board entry + `feature.md` + `CODEBASE_MAP.md`, validates scope against the real codebase, writes the blueprint, enriches the board with PLAN fields, is the **SOLE author of `tiger/CODEBASE_MAP.md`** (distilling structure into each task's `context` so coders build from the board and never read the map), then **decides `buildMode`** (its own call, no hard cap): **`inline`** for a small/low-risk feature — it builds the feature itself in this one warm context (TDD per task) AND runs the verify itself, returning a `grade` (fast — no cold coder spawns; doer=checker, held to grill's agreed e2e + RED-proven acceptance); **`waves`** for a larger feature — it **returns dependency WAVES of file-disjoint tasks** for the conductor to build (concurrent worktree coders per wave + an integrator) + a separate VERIFY. **MODE VERIFY** (waves mode) — **authors `tiger/features/<id>/e2e_keywords.resource` (Playwright for UI, Process/OS otherwise) and runs the WHOLE `tiger/features/` folder — every feature's `e2e_testcases.robot`, a regression run — + acceptance checks as real processes**, appends `source:e2e` cases for uncovered scenarios, triages by priority (HIGH/MEDIUM block, LOW logged; a regression in an already-passing feature is HIGH, and a proven cross-feature duplication may be deduped), records `refs/notes/e2e`, moves the board phase. On CHANGES it writes the **delta tasks** and **returns them as `deltaWaves`** for the conductor to rebuild (bounded by 3 no-progress rounds → `phase: blocked`). In **`waves` mode it never writes product code** (the coders do) and **never spawns coders** (the conductor does — subagents can't nest-spawn); in **`inline` mode it builds the small feature itself**. Either way it **never edits grill's agreed cases or `feature.md`** and **never closes the board to `passing`**.

  **Why the conductor spawns, not the lead:** a subagent cannot spawn its own subagents. The lead is spawned by the workflow, so if it tried to spawn coders those level-2 spawns would silently no-op and the lead would do everything itself. So in `waves` mode the workflow (level 0) spawns bootstrap, lead-plan, the coders, lead-verify, and update-docs. Keeping plan and verify in ONE agent *definition* still means the verifier knows every acceptance check and UI path the planner wrote — coverage stays complete — even though each is now its own spawn. **The `inline` fast path turns that limitation into a feature:** for a small feature the lead is already warm from planning, so it just builds + verifies inline (no coder spawn to nest, nothing to no-op) — collapsing bootstrap + plan + build + verify into `bootstrap → lead(inline) → update-docs`, recovering the single-warm-context speed while keeping the real e2e gate and the docs/merge close-out.
- **Code Generator** (sonnet): **spawned by the workflow-conductor**, one per task within a dependency wave — reads its work packet from the board (`board.py get <id>`), builds ONE task with strict TDD — **RED → GREEN → SIMPLIFY → re-verify GREEN → commit** — reusing before building. SIMPLIFY = shorten, apply tiger-code-quality, delete dead code, **strip all comments**, tests stay GREEN. A 1-task wave commits solo on `feature/<id>` (flips its own `tasks[].status`); a multi-task wave builds each coder in an isolated worktree on `feature/<id>-w<N>-<task>` (code/tests only), then an **integrator** coder cherry-picks the wave onto `feature/<id>` and records the board.
- **Update-Docs** (opus): **spawned by the workflow-conductor on PASS**; refreshes `tiger/CODEBASE_MAP.md`, `tiger/business.md`, `tiger/release_docs.md`, and the project `README.md` (loading the `tiger-docs-*` writers), logs LOW e2e defects as known issues, closes the board to `passing`, rebases onto `dev` and **fast-forward merges to `dev`** (never touches `main`).

Speed model: no in-loop security/reviewer; independent tasks build in parallel in isolated worktrees (file-disjoint → conflict-free cherry-pick); the lead verifies in-context once every wave is integrated, so fix rounds pay no cold re-recon. A sequential feature degrades to one task per wave. Git conventions in `docs/tiger-git-best-practice.md`; test standards in `docs/tiger-unit-test-best-practice.md`; design principles in `tiger-code-quality`.

## Repository Layout

- `skills/tiger-grill/`: inline interview → `feature.md` + broad robot e2e + approval (the only human-interactive stage)
- `skills/tiger-{lead,code-generator,update-docs}/`: the three automated build-stage skills
- `skills/tiger-{security,reviewer}/`: the two **standalone-only** review gates (skills with no owned agent)
- `skills/tiger-docs-{feature,business,e2e,codemap,release,readme}/`: the 6 doc-writer references (no owned agents)
- `skills/tiger-code-quality/`: the design principles (loaded by lead, code generator, reviewer)
- `workflows/tiger-workflow-dev.js`: the deterministic **conductor** spine — **bootstrap → lead PLAN → (build each dependency wave: parallel `tiger-code-generator` worktrees + an integrator; solo for a 1-task wave) → lead VERIFY → bounded re-plan loop → (spawn `tiger-update-docs`)**. It spawns every agent itself (subagents can't nest-spawn). Install copies it to a project's `.claude/workflows/`, where it becomes `/tiger-workflow-dev`. Args-optional.
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
- The lead's e2e verification passed **across the WHOLE `tiger/features/` folder (every feature's suite — a regression run)** with **zero HIGH and zero MEDIUM defects** — a regression in any previously-passing feature is HIGH — (LOW logged as known issues), with fresh notes.
- The verification pipeline has fresh passing output.
- `feature_list.json`, `progress.md`, the global markdown docs (including the cumulative `tiger/business.md`), and learning fields are current.

## The Research Loop (second workflow)

A **second, standalone, GIT-FREE research loop** lives ALONGSIDE the dev pipeline. Where the dev pipeline builds ONE approved feature, this loop hunts for a genuinely **new method** that moves ONE frozen metric — iterating, self-deliberating, and mining fresh sources until the goal is met or novelty is exhausted. Shares the dev idioms (grill-first, one human gate, memory-in-files, board.py-style helper, fail-closed spine) but touches NO git.

### Operating Principle

Humans approve ONE grilled `research/<goalId>/goal.md`; the loop then runs **autonomously**. Same shape as dev: the human owns the WHY (what metric, what's frozen, what harness), the agents own the HOW (which new method to try). **No experiments until the human approves the grilled goal** (`tiger-status: approved`). Every handoff is a human-inspectable file — the experiment card, the recorded deliberation, the raw evidence — so a human audits the search without reading a transcript.

### Non-Negotiables (research)

1. **Novelty over tuning.** The whole point. A run must find a **new way**, not a better knob. Enforced by the **frozen controlled-vars + the G0–G4 gate, run TWICE** (PRE on the declared vector, POST on the actually-built method files). Moving only a controlled var is REFUSED as tuning.
2. **Every experiment cites a freshly-fetched source AND adds a never-seen component.** G4 requires ≥1 source fetched THIS iteration and present in that experiment's `sources.md` (blocks hallucinated/recycled citations). G3 requires ≥1 method component never seen in any prior experiment.
3. **Evidence from a real harness run (the Iron Law).** The metric comes from a REAL run of the goal's pinned deterministic fixture harness THIS iteration — bounded background process, hard timeout, seeded/deterministic — **NEVER asserted**. No number without a run log in `evidence/`.
4. **In-loop semantic critic.** `tiger-novelty-critic` is spawned EVERY iteration on the real method for a NOVEL-and-smart veto (`TIGER_NOVELTY: NOVEL|DUPLICATE`) — the structural gate is necessary, the semantic critic catches gaming the gate passes.
5. **Frozen vars core, one carve-out.** Controlled vars equal the goal's frozen set (G0). The ONLY exception: a genuinely NEW component MAY bring its OWN intrinsic var, allowed **only** when it attaches to a never-seen component (G3).
6. **Big-swing when stalled.** Pacing escalates: exploit → explore → force an untried family. Repeats and micro-moves are the enemy.

### Git-Free Files-Only Model

**State is the folder tree — no branches, no notes, no merge.** Runs in ANY directory; requires no git repo and no board. Resume = read the ledger + experiment folders.

```
research/<goalId>/
  goal.md                     grilled spec + approval token + metric + controlled vars + harness + budget + taxonomy
  research_ledger.json        append-only, invariant-checked state index (schema_version 1)
  taxonomy.md                 approach-family vocabulary (goal-authored; ML-seeded default families)
  experiment0/                the baseline run (bootstrap), same shape
  experiments/experimentN/    one per iteration, N monotonic from 1, IMMUTABLE once done
    experiment.md             the card: approach vector (frontmatter) + method + result + notes
    deliberation.md           recorded self-discussion: candidate next-moves weighed + why this one won
    run.sh (+ method files)   the comment-free reproducible method under the frozen controlled vars
    sources.md                fetched web/arxiv sources (provenance)
    metrics.json              raw harness numbers
    evidence/                 real run logs/outputs (the openable proof)
  REPORT.md                   synthesis, written on stop (points at the best experiment folder)
```

`tiger/research.py` is the ledger helper — SEPARATE from `board.py`, same discipline: **load → validate → mutate ONE spot → re-check invariants → save preserving everything else; fail-closed** (exit 1 = REFUSED, ledger UNTOUCHED); reads are token-cheap to stdout. Subcommands: `init --goal <goalId>`, `summary`, `vectors`, `frontier`, `next-n`, `novelty-check <vector.json> [--built <dir>]`, `register <experimentN>`, `record-result <experimentN> --metric <v> --status <improved|neutral|regressed>`, `alias <tagA> <tagB>`, `stall-check`, `set-status <running|success|stalled|blocked>`, `close`. Install copies it to the project as `tiger/research.py`.

### The Novelty Engine (the anti-tuning crux)

`approach_vector = { family (one taxonomy value), components[] (method-element slugs), controlled_vars{} (= goal frozen set), sources[] (fetched ids/urls), hypothesis, nearest_prior }`. The **structural set S = {family} ∪ components, POINTEDLY EXCLUDING controlled_vars** — that exclusion is the anti-tuning lever. Guards, run PRE (declared vector) and POST (parsed from the built files — NO git):

| Guard | Rule | REFUSE reason |
|---|---|---|
| **G0** frozen-vars | `controlled_vars` = goal frozen set (carve-out: a NEW component MAY add its own intrinsic var, only per G3) | "controlled variables changed = tuning, not a new way" |
| **G1** near-duplicate | `max Jaccard(S, any prior S) ≥ 0.8` | near-duplicate of a prior approach |
| **G2** pure-tuning | S identical to a prior AND only `controlled_vars` moved | "parameter tuning, not a new way" |
| **G3** new-component | `components(new) − ∪ all prior components == ∅` | every accepted experiment MUST add ≥1 never-seen component |
| **G4** new-source | `sources(new) ⊆ some single prior experiment's sources` | must cite ≥1 freshly-fetched source absent from all priors AND present in that experiment's `sources.md` |

The POST-check (`--built`) reads the real method files to extract the ACTUAL component set and compares to the declared vector — a researcher who promised a new method but shipped a constant tweak is REFUSED and left uncredited. `alias <tagA> <tagB>` folds synonym component tags so the gate can't be gamed by renaming.

### The Research Pipeline

```
human ⇄ /research-goal → /research-workflow ──────────────────────────────────────→ REPORT.md (no merge — git-free)
   (only gate)   bootstrap (fast, once): approval-gate goal.md → seed experiment0 → tiger/research.py init
                 LOOP (SERIAL, self-paced): tiger-researcher (opus, FRESH each iter, memory-from-files)
                   reconstruct → deliberate (∥ ideation panel) → mine sources → vector → novelty PRE
                   → spawn tiger-code-generator (method) → run harness (REAL) → novelty POST(--built)
                   → tiger-novelty-critic → write experimentN/ → tiger/research.py register + record-result → 6 tokens
                 PACING: exploit (noImprove 0–1) | explore (2) | big-swing (≥3, force untried family)
                 STOP fail-closed: goal-met→SUCCESS | budget→BUDGET | exhausted/patience/novelty-floor→STALL | 2×BLOCKED→BLOCKED
```

- **bootstrap** (fast model, once): resolves `projectDir`/`today` (via a `date +%F` shell call — never a JS clock), **approval-gates** `goal.md` by grepping `tiger-status:.*approved` (aborts with a "run `/research-goal` to grill + approve a goal first" message if absent — same shape as the dev `feature.md` gate), reads `metric{name,direction,target,baseline}`, frozen controlled vars, the harness command, `budget{max_iters,patience_K,epsilon,novelty_floor,wall_hours}`, and the taxonomy; seeds `experiment0` by running the harness once if the baseline is missing; runs `tiger/research.py init`. Creates NO branches.
- **tiger-researcher** (opus, ONE merged context, **FRESH each iteration with NO prior agent memory** — reconstruct from files only): (1) RECONSTRUCT via `tiger/research.py summary + vectors + frontier` + the last 2–3 `experiment.md` bodies; (2) DELIBERATE — spawn a small PARALLEL ideation panel (Explore/general-purpose) from DISTINCT angles (learn-from-the-worst-failure / attack-the-current-best-weakness / import-a-fresh-source / bold cross-family composition), debate+rank grounded in prior results + novelty + feasibility, WRITE `deliberation.md`; (3) MINE SOURCES — WebSearch + WebFetch (arxiv for technical goals), SAVE each `{id-or-url,title,quoted_claim}` to `sources.md`, distill ONE falsifiable hypothesis; (4) build the vector, `novelty-check` PRE must exit 0 or re-deliberate (bounded 3 tries → `NOVELTY_EXHAUSTED`); (5) IMPLEMENT under frozen vars — spawn `tiger-code-generator` (NO comments); (6) RUN the harness for REAL; (7) `novelty-check --built` POST, mark rejected+uncredited if REFUSED; (8) spawn `tiger-novelty-critic`; (9) WRITE `experimentN/` (card via `tiger-experiment-log`, `metrics.json`, `evidence/`), `tiger/research.py register` + `record-result`; (10) END with the six machine tokens.
- **tiger-novelty-critic** (spawned every iteration): semantic NOVEL-and-smart veto on the real method. Ends with `TIGER_NOVELTY: NOVEL|DUPLICATE` (+ a smart? y/n note).
- **tiger-code-generator** (reused from the dev pipeline): implements the method under the frozen vars, no comments.
- **SYNTHESIS** on any clean stop: `tiger-researcher` in a synthesis mode writes `REPORT.md` — an idea→hypothesis→result table, the winning method + its provenance chain, the dead-ends. **NO merge** (git-free): `REPORT.md` points at the best experiment folder; promoting a winner into real code is a MANUAL human step.

**Machine tokens** — `tiger-researcher` ENDS its report with these six lines; the workflow JS parses the LAST occurrence of each, fail-closed (mirrors `tiger-workflow-dev.js` `lastToken`/`lastTokenLine`):

```
TIGER_RESEARCH: <IMPROVED|NEUTRAL|REGRESSED|NOVELTY_EXHAUSTED|BLOCKED>
EXPERIMENT: <experimentN>
METRIC: <numeric metric value measured THIS iteration>
NOVELTY_DISTANCE: <0..1>
DELTA_VS_BEST: <signed number>
GOAL_MET: <YES|NO>
```

`GOAL_MET` is advisory — **the workflow JS RE-derives goal-met** from best-vs-target given direction (max: `best ≥ target`; min: `best ≤ target`) and never trusts the token blindly. A missing/garbled token defaults to the safe verdict (continue = NO, goal-met = NO) so a broken agent never burns budget or false-claims success.

### Stop Conditions (fail-closed toward STOPPING)

- **SUCCESS** — goal-met (JS-derived from best vs target).
- **BUDGET** — `iter > budget.max_iters` OR cumulative wall > `budget.wall_hours`.
- **STALL** — `TIGER_RESEARCH == NOVELTY_EXHAUSTED` OR `noImprove ≥ budget.patience_K` OR rolling novelty mean < `budget.novelty_floor`.
- **BLOCKED** — BLOCKED on two consecutive iterations.

The LOOP is **SERIAL** (never parallel across iterations — each experiment must see the full frontier to be judged novel). A null researcher spawn returns the dev-spine-style backend-mismatch abort payload.

### Repository Layout (research additions)

- `skills/research-goal/`: inline goal grill → `goal.md` + approval (the only human-interactive research stage; **not** `tiger-*` namespaced — it is a human entry point).
- `skills/tiger-researcher/`, `skills/tiger-novelty-critic/`, `skills/tiger-experiment-log/`: the internal, workflow-spawned research skills (`tiger-*` namespaced).
- `workflows/research-workflow.js`: the git-free research spine — CLONES the `tiger-workflow-dev.js` idioms (`phase()`/`agent()`/`log()`, `pick()`/`argStr()` model helpers, `lastToken()`/`lastTokenLine()` fail-closed parsing, a bootstrap StructuredOutput spawn, `proModel`/`fastModel`/`"inherit"` passthrough, the null-spawn abort payload). Install copies it to `.claude/workflows/` as `/research-workflow`. **Args-optional**: `goalId`, `goalFile`, `projectDir`, `today`, `proModel`, `fastModel`, `maxIter`. NEVER names a JS current-time or randomness API (the validator string-scans workflow files) — `today` comes from a `date +%F` shell call in bootstrap.
- `agents/`: registry files for `tiger-researcher` (opus) + `tiger-novelty-critic` (opus). `research-goal` runs inline (no owned agent); `tiger-experiment-log` is a loadable writer (no owned agent).
- `scripts/research.py`: the append-only ledger helper install copies to the project as `tiger/research.py`.
- `templates/`: research starting-point files install copies into `research/templates/` (`goal.md`, `taxonomy.md`, `experiment.md`, `deliberation.md`, the empty schema-1 `research_ledger.json`).

### Research Entry Points

- `/research-goal` — the goal grill. Inline human interview writing `research/<goalId>/goal.md`, gated by a `tiger-status: approved` line. Pins the ONE deterministic metric+harness, the frozen controlled vars, the budget, and seeds the taxonomy. The ONLY interactive research stage.
- `/research-workflow` — the autonomous loop. **No args required**; auto-discovers the approved goal. Runs bootstrap → the serial researcher loop → synthesis. Returns `{goalId, iterationsRun, best:{experiment,value}, target, outcome, passed, inspect}`; `inspect` = "open `research/<goalId>/REPORT.md`; resume = re-run `/research-workflow`". Never touches git.
