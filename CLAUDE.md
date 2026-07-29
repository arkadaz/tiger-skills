# Tiger Development Kit Agent Manual

## Operating Principle

Humans own the WHY loop; agents own the HOW loop. **No build until the human approves the grilled spec.** Every handoff is a human-inspectable artifact (markdown or git), so a human can audit what the AI planned and did without reading a transcript.

The kit ships its stages as **pure skills** the user invokes directly, plus one **workflow** (`tiger-workflow-dev`) that runs the build automatically. **The workflow is the conductor** — it spawns every agent itself. NOT because a subagent can't nest-spawn (it CAN, since Claude Code v2.1.172+ — the default spawn depth is 3 as of v2.1.219, tunable via `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), but because deterministic orchestration GUARANTEES every step runs and keeps each agent's context bounded to one phase — a single agent conducting a whole large feature in one window forgets steps (spawning a coder, the finalize) as its context fills; the workflow never forgets.

**Two roles, one job each: the coders build, the architect merges.** The spine is **grill → lead PLAN (recon once, complete per-task packets, author the e2e suite, return file-disjoint WAVES) → the workflow builds every wave with parallel `tiger-code-generator` coders in isolated git worktrees (the lead's E2E-PROVISION runs alongside PLAN, so no wave waits on an install) → lead INTEGRATE per non-final wave (cherry-pick + re-verify + quality audit + packet repair) → lead VERIFY (merge the last wave, run the whole `tiger/features/` folder for real, triage) → bounded re-plan loop → (workflow spawns update-docs) → ff-merge to `dev`**. Every task is built by a coder; every merge is made by the architect. There is no inline/lead-built path — doer ≠ checker is not optional.

**Grill writes TWO docs per feature:** `spec.md` — the DETAILED, agent-facing requirements (exact FRs with worked examples, business rules with real values, an errors-and-edge-cases table, testable acceptance criteria) that the lead and coders build and test against with zero follow-up questions — and `feature.md` — the one-page human summary carrying the `tiger-status` approval token. The interview digs until every requirement is spec-grade concrete; a thin interview produces a thin spec, and a thin spec is why builds come out wrong.

**The lead owns the e2e suite.** At PLAN time — before any code exists — it authors `tiger/features/<id>/e2e_testcases.robot` from `spec.md`, covering **everything it judges can happen** (boundary/typical/adversarial/error, ≥1 case per AC and per business rule, real-browser cases for UI, one priority tag each) — NOT a fixed set signed at grill. It extends the suite every verify round as new risks surface, and never deletes/weakens a case to go green. Because the suite is pre-committed before any implementation exists to bend it toward, the gate is objective. The lead's **priority-triaged whole-folder e2e verification is the single in-loop quality gate**, and its **merge audit** (reuse violations, comments in generated code, scope leaks, dead code, weakened tests) is the quality gate on every wave. **`tiger-review`** (quality + security in one pass) is a standalone skill a human invokes on demand; the workflow never spawns it. No `/dev` command.

**The boundary contract is what keeps the loop to one round.** The costliest defects are never business rules — they are type and magnitude confusion where caller-controlled data first enters the program, and no spec's prose contains them. So the lead does not *imagine* adversarial cases: at PLAN time it walks a **standing hostile-input taxonomy** (wrong type per field · missing/extra field · empty · magnitude beyond the native numeric range · non-finite results · oversized · unicode · off-by-one · duplicates · traversal/injection · malformed body · double-submit) and INSTANTIATES every applicable row into an **ABUSE corpus** in the packet of every task that touches a trust boundary — rows the coder must cover in its own tests — and the same rows become `priority:high` e2e cases. Sharing the threat enumeration is not sharing the verdict: the coder asserts at unit level, the gate still executes the whole folder independently. When the gate does confirm a boundary defect, it extends by the whole **equivalence class**, never one sibling per round.

**Context management is the design, not a detail.** Exploration is paid ONCE — by the lead, at PLAN — and pushed DOWN as complete work packets whose `REUSE:` section inlines the exact existing code a coder must call. A coder reads exactly one task (`python3 tiger/board.py task <id> <task>`), opens only the files that task names, and reports a **PACKET GAP** instead of guessing or grepping; the architect repairs the packet and re-queues the task once. Every coder returns a **structured report** (branch, commit, files touched, what it reused, any gap) that the conductor threads into the architect's merge prompt, so no agent re-derives what already happened. The lead keeps `verify_notes.md` as a journal so a cold re-spawn on a fix round resumes instead of rediscovering the environment.

Document authoring lives in ONE loadable reference — the **`tiger-docs`** skill (sections: spec/feature for grill, the e2e suite for the lead, codemap/business/release/README for update-docs) — no owned agent. The build discipline (design principles + SIMPLIFY + the write-less ladder + the say-less handoff style) lives in **`tiger-code-quality`**, loaded by the lead, code generator, researcher, and review. Grill runs inline, so it invokes its writers through the Skill tool; agents load via the subagent **`skills:` frontmatter**.

## Branch Model

- `main` = **protected release branch. The workflow and every build stage NEVER touch it.**
- `dev` = integration trunk; everything integrates here.
- `feature/<id>` is cut **from `dev`**. Grill creates it (`git checkout -b feature/<id> dev`) and commits the grill artifacts + board entry there.
- the lead and its coders work on `feature/<id>`; never commit onto `dev` or `main`.
- update-docs rebases `feature/<id>` onto `dev`, then **fast-forward merges to `dev`** (`git merge --ff-only`). Pushes `dev` if a remote exists. Never opens an MR, never merges to `main`.
- **`dev` → `main` is a manual human step** the kit never performs.

## Non-Negotiables

1. **Grill first for features.** For any new feature, behavior change, business process, integration, or ambiguous request, invoke `tiger-grill` before planning or coding.
2. **One question at a time — and a LOT of them.** During grill, ask a single focused question with a recommended answer; a dimension closes only at spec-grade detail (every vague word pinned to a number or named entity). Err toward more questions.
3. **Business logic must be explicit.** Close roles, permissions, states, calculations, exceptions, data ownership, integrations, reporting, audit — with the exact values, in `spec.md`.
4. **Human approval is required.** The single gate is grill approval — once `feature.md` carries the frontmatter line `tiger-status: approved` (approving `spec.md` with it), the rest of the pipeline runs autonomously.
5. **WIP = 1.** Only one feature may be `in_progress`.
6. **Explore and reuse before you build.** Read existing docs, state, types, and patterns first. Builders climb the lazy-senior ladder (YAGNI → repo utility → stdlib → native platform → installed dependency → minimal new code) and think hard before writing.
7. **Evidence before claims.** Never mark anything done without fresh verification from real execution.
8. **No comments in generated code.** Generated feature code AND the e2e keyword implementations carry NO comments — names and small functions carry meaning. The only exceptions are tool/language-required directives (shebang, `# type: ignore`, lint pragmas, legally-required license headers). The plugin's own scripts (workflow, validators, hooks) are not generated code; keep their comments but minimal.
9. **One writer per field-group; each writer commits what it owns.** Grill + human produce `tiger/features/<id>/spec.md` + `feature.md` **and create the board entry** (WHY + SPECIFY fields, `status: in_progress`, `phase: plan`). The **lead** enriches the board with PLAN fields (`scope_map.modify`/`read_only`, `tasks[]` with `files`/`depends_on`/`context`/`verification`, RED-proven checks), maintains `tiger/CODEBASE_MAP.md`, **authors the whole e2e layer** (`e2e_testcases.robot` + `e2e_keywords.resource` + `verify_notes.md`), and owns `refs/notes/e2e`, the board `phase`, **`tasks[].status` (recorded at merge time, from the coders' evidence)**, `acceptance_criteria[].status`, and Robot's evidence — never rewriting grill's fields or editing `spec.md`/`feature.md`. The **code generators** own product code + tests ONLY, one semantic commit each on their own per-task branch — they never write shared state (`feature_list.json`, `progress.md`, notes), because the board is the same file on every branch and concurrent writers would collide on cherry-pick. **update-docs** owns the global markdown docs, the README refresh, and the passing close-out. The git note IS the grade. Always commit the board.
10. **The lead runs the WHOLE folder every verify.** Each feature keeps its own `tiger/features/<id>/e2e_testcases.robot` + `e2e_keywords.resource`, both lead-authored. The lead verifies by running **every feature's suite as a regression** — `robot tiger/features/` — not just the current feature. A case of an already-**passing** feature that regresses is **HIGH — it blocks and must be fixed until green regardless of its priority tag**. The lead keeps the folder coherent (consolidating proven cross-feature duplication, recorded in `progress.md` + the note) but **never silently changes a shipped feature's APPROVED behavior** — that is a spec conflict → `blocked`. It never deletes or weakens a case to go green — a case wrong against `spec.md` is corrected to match the spec, called out in the note.
11. **Scope map + per-task context required.** Every task states `MODIFY`, `READ_ONLY`, `METRIC`, plus a `context` brief (where code lives, what to reuse, how it connects, the behavior to satisfy) so a parallel generator with only the board can build it.
12. **Project rm guard required.** `install` places a PreToolUse Bash hook blocking `rm`. Do not build if it is missing. It is a speed bump, not a sandbox.

## Standard Startup

```bash
./init.sh
```

Read these per-project runtime files before work (they live in the target project, not this template):

- `CLAUDE.md`, `progress.md`, `feature_list.json`
- The active `tiger/features/<id>/spec.md` + `feature.md` (plus its `e2e_testcases.robot` sibling), if any
- `tiger/CODEBASE_MAP.md` (structural map)

## Feature Board Contract

`feature_list.json` uses schema version 2. Each feature is a detailed kanban ticket:

- **WHY** (grill): `problem_statement`, `jtbd`, `problem_classification`, `user_context`
- **SPECIFY** (grill): `spec_file` (the `feature.md` path — the gate doc; `spec.md` is its frontmatter-linked sibling), `spec_status`, `approval`, `acceptance_criteria`, `scope_map.metric`
- **PLAN** (lead): `scope_map.modify`, `scope_map.read_only`, `tasks[]` (each with `files`, `depends_on`, `context`, `verification`)
- **BUILD** (the lead records it at merge time, from each coder's reported evidence): `tasks[].status`, `tasks[].evidence`
- **VALIDATE** (lead): `validation`, acceptance evidence, metric notes
- **LEARN** (update-docs): `learning.technical/product/process/harness_updates`

The board must preserve reciprocal, acyclic `depends_on`/`blocks` links. `current_feature` must match the single `in_progress` feature or be `null`. The `phase` pointer is `plan | build | validate | blocked | passing`. Resume = `git log` + `git notes --ref=e2e` + board phase. The e2e note (`grade: pass|changes|blocked` + per-priority `blockers:` + ordered `fixes:`) IS the in-loop grade.

**Every stage reads the current board first and updates only its own fields — via the Python helper, never by dumping/hand-rewriting the JSON.** `install` copies `scripts/board.py` to the project as `tiger/board.py`. Read with `python3 tiger/board.py summary` (compact overview), `... current`, `... in-progress`, `... get <id> [field]`, `... task <id> <task>` (ONE task's work packet + scope_map — a worktree coder's only board read). Patch with `... set-phase`, `set-task <id> <task> <status> [--evidence …]`, `set-ac`, `add-learning`, `approve`, `add-task`, `add-feature` — and the ATOMIC `switch <id>` (clock in, parking any other in_progress), `park <id>`, `close <id>` for any move that changes `status` and `current_feature` together (WIP=1 and current_feature consistency are validated as one rule, so a two-step `set-status`+`set-current` is refused in both orders). It loads the full board, mutates one spot, re-checks the invariants (WIP=1, current_feature, reciprocal + acyclic links, valid status/phase), and writes back preserving everything else — refusing (exit 1, board untouched) any write that would break an invariant. This keeps reads token-cheap and writes corruption-proof.

**Memory is in git, and it has ONE writer per artifact.** The kit's durable memory is the board's `learning.*`, `progress.md`, `tiger/CODEBASE_MAP.md`, `tiger/business.md`, the per-feature `verify_notes.md`, `refs/notes/e2e`, and `CLAUDE.md` — all version-controlled, all human-inspectable. This is deliberately the same shape Anthropic's own long-running-agent harness uses (a progress log + a `feature_list.json` checklist + an `init.sh` env restore, with git as the recovery mechanism): structured artifacts a fresh session can read beat opaque agent state. update-docs records durable lessons in `learning.harness_updates` for a human to promote into `CLAUDE.md`.

What actually loads, and why the kit does not use agent memory:

- **Every agent already reads the `CLAUDE.md` hierarchy** (managed → user → project → `CLAUDE.local.md` → `.claude/rules/`). A subagent inherits it too — so a work packet must NOT restate conventions that live here; that text is paid again, uncached, in every coder. Only the built-in `Explore`/`Plan` agents skip it: anything they must obey goes in their prompt.
- **Subagents deliberately do NOT set the `memory:` frontmatter field.** Not because it would be hidden — `memory: project` writes to `.claude/agent-memory/<agent>/`, which is in git — but because it would give an agent a second, private place to record state that non-negotiable #9 already assigns to exactly one artifact and one writer. Two writers for the same fact is how a board and an agent's notes silently diverge.
- **A repo-root `MEMORY.md` is not a mechanism** — nothing loads it. `MEMORY.md` is real only inside a harness-owned memory directory (the machine-local auto-memory dir, or `.claude/agent-memory/<agent>/`). Project knowledge that must load every session belongs in `CLAUDE.md` (keep it tight — long files measurably reduce adherence) or in `.claude/rules/*.md` with `paths:` frontmatter when it only matters for part of the tree.
- **Context is not enforcement.** A rule that must hold regardless of what an agent decides needs a hook, not a paragraph — which is why the `rm` guard is a `PreToolUse` hook and the approval token is a `grep`-able line.

## The Pipeline

```
human ⇄ grill → [ WORKFLOW = CONDUCTOR, spawns every agent (deterministic — steps guaranteed, contexts bounded) ] → ff-merge to dev
  (only gate)   lead PLAN (opus) ∥ E2E-PROVISION: discover+gate the feature (no bootstrap spawn) → recon ONCE from spec.md
                          → complete per-task packets (REUSE inlined) + RED-proven checks + codemap
                          + AUTHOR the e2e suite → return file-disjoint WAVES
                → per wave: ∥ sonnet CODERS, one task each, isolated worktrees, code+tests on own branch
                            (the lead's E2E-PROVISION spawn ran beside PLAN, so the runtime is already warm)
                → lead INTEGRATE (opus, each non-final wave): cherry-pick the wave → re-verify the tip →
                            quality audit (reuse/comments/scope/dead code) → repair failed packets → retry once
                → lead VERIFY (opus): merge the final wave → warm-start from verify_notes.md → run Robot e2e
                            for ALL features (robot tiger/features/, Playwright UI) + acceptance checks
                            → triage[HIGH+MED block, regression=HIGH, LOW logged]
        └── VERIFY "not pass" ⟲ lead writes delta tasks (repaired packets) → workflow rebuilds → re-VERIFY
            (≤3 rounds, or a round that completed no task and cleared no blocker → blocked) ──────────────┘
                          → on PASS the workflow spawns update-docs (opus) → ff-merge to dev
tiger-review → STANDALONE-only (quality + security on demand; not in the loop)
```

- **Discovery lives in the lead's PLAN spawn (STEP 0) — there is NO separate bootstrap agent.** It is **recency-aware**: reads `feature_list.json` for the **newest approved, non-passing** feature (`python3 tiger/board.py newest-approved`; `candidates` shows the queue), **auto-parks a stuck older `in_progress` feature** to switch to the newer one, re-checks the `feature.md` approval token, resolves `today` + the `dev` trunk (creates `dev` from `main` if missing), and returns a fail-closed `abort` if any gate fails. This is why the workflow needs no args — and why a run pays one fewer cold spawn.
- **Lead** (opus): the ARCHITECT — the conductor drives it in four modes, and it writes NO product code. **MODE PLAN** — reads the board entry + **`spec.md`** (the behavior contract; `feature.md` is the human summary + fallback on a pre-v8 feature) + `CODEBASE_MAP.md`, validates scope against the real codebase, recons ONCE into a **reuse inventory**, enriches the board with PLAN fields (`tasks[]` whose `context` packet inlines WHERE / REUSE / EXEMPLAR / INTERFACES / CONNECTS / TEST+RED / BEHAVIOR), RED-proves every acceptance check, writes an **ABUSE corpus** into the packet of every task that touches a trust boundary (instantiated from the standing hostile-input taxonomy, not improvised), **authors the WHOLE e2e layer from spec.md before any code exists — cases AND keyword bodies**, is the SOLE in-loop author of `tiger/CODEBASE_MAP.md` (distilling structure into each packet so coders never read the map), and returns dependency **WAVES** of file-disjoint task ids — as WIDE as contract-first decomposition allows, because width is wall-clock. **MODE E2E-PROVISION** — spawned in parallel with PLAN: makes the Robot/Playwright runtime ready (environment only, no repo writes), so no build wave ever waits on an install. The keyword layer itself is PLAN's. **MODE INTEGRATE** — after each non-final wave: cherry-picks that wave's coder branches onto `feature/<id>` (a real conflict means the `files[]` were not disjoint — abort, re-scope, never hand-merge), re-runs the project verification on the integrated tip, **audits the wave diff** (reuse violations first, then comments in generated code, scope leaks, dead code, weakened tests), **repairs the packet** of every failed/PACKET-GAP task and returns it for one immediate retry, and records `tasks[].status` from the coders' evidence. **MODE VERIFY** — merges the final wave, warm-starts from `verify_notes.md`, **runs the WHOLE `tiger/features/` folder — a regression run — + acceptance checks as real processes** (Playwright for UI, Process/OS otherwise), extends the suite once per round, audits the whole feature diff, triages by priority (HIGH/MEDIUM block, LOW logged; a regression in a shipped feature is HIGH), records `refs/notes/e2e`, moves the board phase. On CHANGES it writes the **delta tasks** with repaired packets and returns them as `deltaWaves` (bounded by 3 rounds AND a no-progress detector → `phase: blocked`). It **never spawns coders** (the conductor does) and **never edits `spec.md`/`feature.md`** or closes the board to `passing`.

  **Why the conductor spawns, not the lead:** nested subagents DO work (Claude Code v2.1.172+; the default spawn depth is 3 as of v2.1.219, tunable via `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), but the deterministic workflow owns the spawning so every step is GUARANTEED and each agent's context stays bounded — a single lead conducting a large feature in one window drops steps (a coder spawn, the finalize) as its window fills. So the workflow (level 0) spawns lead-PLAN, every coder, the e2e harness, lead-INTEGRATE, lead-VERIFY, and update-docs. **Why a coder always builds and never the lead:** an agent asked to grade its own code praises it — separating the doer from the checker is the one structural defence, and it costs little wall-clock because the coders run concurrently while the architect's harness warms the gate.
- **Code Generator** (sonnet): **spawned by the workflow-conductor for EVERY task, every wave, always in an isolated git worktree** — one coder per task, running concurrently with its file-disjoint siblings. Reads ONLY its own packet (`python3 tiger/board.py task <id> <task>`), opens only the files that packet names, and **never explores** the tree: a missing interface/behavior fact is a `PACKET GAP` it reports instead of guessing (ONE bounded reuse check before writing a new helper is sanctioned and expected). Builds with strict TDD — **RED → GREEN → SIMPLIFY → re-verify GREEN → commit** — reusing before building. SIMPLIFY = shorten, apply tiger-code-quality, delete dead code, **strip all comments**, tests stay GREEN. Lands exactly ONE code+tests commit on its own branch `feature/<id>-r<round>w<wave>-<task>` and writes NO shared state (`feature_list.json`, `progress.md`, notes) — the architect cherry-picks the branch and records the board.
- **Update-Docs** (opus): **spawned by the workflow-conductor on PASS**; refreshes `tiger/CODEBASE_MAP.md`, `tiger/business.md`, `tiger/release_docs.md`, and the project `README.md` (per the `tiger-docs` writer sections), logs LOW e2e defects as known issues, closes the board to `passing`, rebases onto `dev` and **fast-forward merges to `dev`** (never touches `main`).

Speed model: **wide waves** (contract-first planning maximises how many tasks build at once, in isolated worktrees — file-disjoint → conflict-free cherry-pick); **the e2e runtime is paid off the critical path** (the harness spawn provisions Playwright and authors the keyword layer while wave 1 builds); **mistakes are caught at the wave boundary** (per-wave merge + verification + quality audit, the packet repaired and retried once) instead of at the gate; the **verify journal** warm-starts each cold re-spawn; no in-loop security/reviewer. Git conventions in `docs/tiger-git-best-practice.md`; test standards in `docs/tiger-unit-test-best-practice.md`; design + write-less + say-less discipline in `tiger-code-quality`.

## Repository Layout

- `skills/tiger-grill/`: inline interview → `spec.md` + `feature.md` + approval (the only human-interactive stage)
- `skills/tiger-{lead,code-generator,update-docs}/`: the three automated build-stage skills
- `skills/tiger-review/`: the **standalone-only** quality + security gate (skill with no owned agent)
- `skills/tiger-docs/`: the ONE doc-writer reference (spec/feature/e2e/codemap/business/release/README sections; no owned agent)
- `skills/tiger-code-quality/`: design principles + SIMPLIFY + write-less ladder + say-less handoffs (loaded by lead, code generator, researcher, review)
- `workflows/tiger-workflow-dev.js`: the deterministic **conductor** spine — **lead PLAN (discover+gate → packets + e2e suite → waves) → build each wave (∥ worktree coders; E2E-PROVISION already ran ∥ PLAN) → lead INTEGRATE (merge + audit + packet repair) → lead VERIFY (merge the last wave + the whole-folder gate) → bounded re-plan loop → spawn `tiger-update-docs`**. Install copies it to a project's `.claude/workflows/`, where it becomes `/tiger-workflow-dev`. Args-optional.
- `agents/`: 5 subagents — dev (lead, code-generator, update-docs) + research (tiger-researcher, tiger-novelty-critic); opus everywhere except the code generator (sonnet).
- `templates/`: the markdown + robot starting-point files install copies into `tiger/templates/` (`spec.md`, `feature.md`, `CODEBASE_MAP.md`, `business.md`, `release_docs.md`, `e2e_testcases.robot`, `e2e_keywords.resource`) plus the empty schema-v2 `feature_list.json` seeded to the project root
- `hooks/`: real hook wiring — `hooks.json` + `tiger-session-start.sh` (SessionStart context injection, scoped to Tiger projects). JSON+script, never markdown.
- `commands/install.md`: the one slash command — copies workflows/guard/templates (refreshing plugin-owned copies with `.bak` backups), migrates old→new, verifies harness (including `main` + `dev`)
- `project-hooks/tiger-block-rm.sh`: rm guard copied into target projects
- `scripts/validate-plugin.sh` + `scripts/validate-board.py`: structural/schema + board-invariant validation

## Doc Style

Per-feature and global docs are **compact markdown** — prefer bullets and tables over paragraphs; YAML frontmatter is the machine gate. The e2e contract is a Robot Framework `.robot`/`.resource` pair (plain Given/When/Then; Robot's generated `report.html` is the browser-openable evidence). `tiger/CODEBASE_MAP.md` may include a fenced ```mermaid flowchart (GitHub renders it; stays plain-text readable) — no CDN, no HTML, no inline CSS. When a standalone rich HTML page is ever needed, follow `docs/tiger-doc-style.md` (the house palette), but the Tiger artifacts themselves are markdown.

## Skill Extension Rules

Add a new skill only when the capability has a distinct trigger, owned agents, state contract, workflow phase, or verification evidence. Otherwise extend the existing skill — **overlapping skills get merged, not multiplied** (v8 folded 19 skills into 10). When adding or changing a skill:

- Update `skills/<skill>/SKILL.md` and its owned agent(s).
- Add the skill path to `.claude-plugin/plugin.json` under `autoDiscovery.skills`.
- Add matching root `agents/*.md` registry files (frontmatter `name`/`description`/`model`/`tools`) when a skill adds owned agents.
- Update `CLAUDE.md` when rules, routing, artifacts, non-negotiables, or definition of done change; `README.md`/`AGENTS.md` for user/orientation guidance.
- Update `commands/install.md`, `workflows/tiger-workflow-dev.js`, or `hooks/` when the spine, setup, or mechanical enforcement changes. Hooks must be real JSON+script. Do not add other slash commands without explicit approval.
- Run `./init.sh` before claiming completion.

## Commands, Skills & the Workflow

- `/tiger-skills:install` — the one slash command. Copies the workflows, rm guard, and templates; **migrates an old project to the current version every run** (plugin-owned copies refreshed with `.bak` backups); seeds/verifies `init.sh`/board/`progress.md` and a born `main` + `dev`. The research-loop files are optional — missing sources degrade to `NEEDS HUMAN`, never a mid-install abort. Idempotent; never grills or builds.
- The automated stages are **skills**: `tiger-grill`, `tiger-lead`, `tiger-code-generator`, `tiger-update-docs`. Use one alone, or grill → approve → run the workflow.
- The **review gate** is ONE standalone skill: `tiger-review` (quality + security; `refs/notes/review` + `refs/notes/security`) — not in the automated loop.
- **`tiger-docs`** (all artifact-writing rules) and **`tiger-code-quality`** (design + write-less + say-less) are loadable references — grill/lead/update-docs load them, or invoke directly ("refresh the codemap", "make it terse").
- `/tiger-workflow-dev` — the installed workflow. **No args required**; auto-discovers the **newest approved, non-passing** feature (auto-parking a stuck older one). Optional overrides: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`, `mechModel`.
  **Reasoning effort is opt-in and off by default** — `{"effort":"high"}` for every stage, or per stage (`planEffort`, `provisionEffort`, `codeEffort`, `integrateEffort`, `verifyEffort`, `docsEffort`; an unknown value is dropped, never sent). It is off by default because the workflow runtime pairs the session effort with `thinking: {type:"disabled"}` on subagent requests, and backends that reject that combination kill **every** agent at spawn. Raising `planEffort` is the lever worth testing (better enumeration → one fewer fix round, and a round costs ~700s); lowering `provisionEffort`/`docsEffort` is nearly free. Never cheapen `integrate`/`verify` — that is the loop's only independent judgement.

## Existing Project Adoption

`/tiger-skills:install` seeds harness state when missing and **migrates** an old-version project on every run — converting old HTML artifacts to the markdown set, rewriting board `spec_file` to `feature.md`, refreshing the installed workflows and templates (old kept as `*.bak`), ensuring a born `main` + `dev` — preserving human-authored content. A pre-v8 feature (no `spec.md`; grill-era e2e suite) stays valid: the lead falls back to `feature.md` as the contract and owns the suite going forward. Install never reads source, grills, or builds. Existing work without approval evidence gets a retrospective grill before any build.

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

1. **Novelty over tuning.** A run must find a **new way**, not a better knob. Enforced by the **frozen controlled-vars + the G0–G4 gate, run TWICE** (PRE on the declared vector, POST on the actually-built method files). Moving only a controlled var is REFUSED as tuning.
2. **Every experiment cites a freshly-fetched source AND adds a never-seen component.** G4 requires ≥1 source fetched THIS iteration and present in that experiment's `sources.md`; G3 requires ≥1 method component never seen in any prior experiment.
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

- **bootstrap** (fast model, once): resolves `projectDir`/`today` (via a `date +%F` shell call — never a JS clock), **approval-gates** `goal.md` by grepping `tiger-status:.*approved` (aborts with a "run `/research-goal` to grill + approve a goal first" message if absent), reads `metric{name,direction,target,baseline}`, frozen controlled vars, the harness command, `budget{max_iters,patience_K,epsilon,novelty_floor,wall_hours}`, and the taxonomy; seeds `experiment0` by running the harness once if the baseline is missing; runs `tiger/research.py init`. Creates NO branches.
- **tiger-researcher** (opus, ONE merged context, **FRESH each iteration with NO prior agent memory** — reconstruct from files only): (1) RECONSTRUCT via `tiger/research.py summary + vectors + frontier` + the last 2–3 `experiment.md` bodies; (2) DELIBERATE — spawn a small PARALLEL ideation panel (Explore/general-purpose) from DISTINCT angles (learn-from-the-worst-failure / attack-the-current-best-weakness / import-a-fresh-source / bold cross-family composition), debate+rank grounded in prior results + novelty + feasibility, WRITE `deliberation.md`; (3) MINE SOURCES — WebSearch + WebFetch (arxiv for technical goals), SAVE each `{id-or-url,title,quoted_claim}` to `sources.md`, distill ONE falsifiable hypothesis; (4) build the vector, `novelty-check` PRE must exit 0 or re-deliberate (bounded 3 tries → `NOVELTY_EXHAUSTED`); (5) IMPLEMENT under frozen vars — spawn `tiger-code-generator` (NO comments); (6) RUN the harness for REAL; (7) `novelty-check --built` POST, mark rejected+uncredited if REFUSED; (8) spawn `tiger-novelty-critic`; (9) WRITE `experimentN/` (the card in the researcher's built-in format, `metrics.json`, `evidence/`), `tiger/research.py register` + `record-result`; (10) END with the six machine tokens.
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
- `skills/tiger-researcher/` + `skills/tiger-novelty-critic/`: the internal, workflow-spawned research skills (the experiment-card + deliberation formats are built into the researcher).
- `workflows/research-workflow.js`: the git-free research spine — CLONES the `tiger-workflow-dev.js` idioms (`phase()`/`agent()`/`log()`, `pick()`/`argStr()` model helpers, `lastToken()`/`lastTokenLine()` fail-closed parsing, a bootstrap StructuredOutput spawn, `proModel`/`fastModel`/`"inherit"` passthrough, the null-spawn abort payload). Install copies it to `.claude/workflows/` as `/research-workflow`. **Args-optional**: `goalId`, `goalFile`, `projectDir`, `today`, `proModel`, `fastModel`, `maxIter`. NEVER names a JS current-time or randomness API — `today` comes from a `date +%F` shell call in bootstrap.
- `agents/`: registry files for `tiger-researcher` (opus) + `tiger-novelty-critic` (opus). `research-goal` runs inline (no owned agent).
- `scripts/research.py`: the append-only ledger helper install copies to the project as `tiger/research.py`.
- `templates/research/`: research starting-point files install copies into `tiger/templates/research/` (`goal.md`, `taxonomy.md`, `experiment.md`, the empty schema-1 `research_ledger.json`).

### Research Entry Points

- `/research-goal` — the goal grill. Inline human interview writing `research/<goalId>/goal.md`, gated by a `tiger-status: approved` line. Pins the ONE deterministic metric+harness, the frozen controlled vars, the budget, and seeds the taxonomy. The ONLY interactive research stage.
- `/research-workflow` — the autonomous loop. **No args required**; auto-discovers the approved goal. Runs bootstrap → the serial researcher loop → synthesis. Returns `{goalId, iterationsRun, best:{experiment,value}, target, outcome, passed, inspect}`; `inspect` = "open `research/<goalId>/REPORT.md`; resume = re-run `/research-workflow`". Never touches git.
