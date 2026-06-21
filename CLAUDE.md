# Tiger Development Kit Agent Manual

## Operating Principle

Humans own the WHY loop. Agents own the HOW loop. The agent must not build until the human has explicitly approved the spec produced by the grill gate. Every handoff between stages is a human-inspectable artifact (HTML or git), so a human can audit what the AI planned and did without reading a transcript.

The kit ships its stages as **pure skills** the user invokes directly, plus one **workflow** (`tiger-workflow-dev`) that runs the build automatically. The **v2 design** (`docs/dev-loop-v2.md`) is the current source of truth; it optimizes for speed. The automated workflow runs five stages in order — **grill → architect → code generator (parallel) → e2e → update-docs** — and the **e2e gate is the single in-loop quality gate**. The old in-loop `security ∥ reviewer` gates were removed from the workflow for speed; **`tiger-security` and `tiger-reviewer` remain as standalone skills** a human invokes on demand (e.g. a one-off security review). There is no conductor and no `/dev` command — the user either picks a single skill or runs the workflow for the full build.

Document authoring is factored into a family of focused **`tiger-docs-*` writer skills** (`tiger-docs-spec`, `tiger-docs-adr`, `tiger-docs-business`, `tiger-docs-e2e`, `tiger-docs-codemap`, `tiger-docs-release`, `tiger-docs-readme`) — each owns one artifact. They are **loadable reference skills with no owned agent** (the `tiger-code-quality` pattern): **grill** loads the spec/adr/business/e2e writers to author its artifacts, and the single **update-docs** agent loads the codemap/business/release/readme writers at close-out. The load is declared via the subagent **`skills:` frontmatter field**: `tiger-update-docs` preloads the four global-doc writers, and `tiger-architect`/`tiger-code-generator`/`tiger-reviewer` preload `tiger-code-quality`. Grill is inline (not a subagent), so it invokes its writers through the Skill tool instead.

## Non-Negotiables

1. **Grill first for features.** For any new feature, user-visible behavior change, business process, integration, or ambiguous request, invoke `tiger-grill` before planning or coding.
2. **One question at a time.** During grill, ask a single focused question with a recommended answer or choices. Do not batch questions.
3. **Business logic must be explicit.** Close rules for roles, permissions, states, calculations, exceptions, data ownership, integrations, reporting, and audit needs.
4. **Human approval is required.** A generated spec is a draft until the user explicitly approves it. The single human gate is grill approval — once `spec.html` carries the approval token, the rest of the pipeline runs autonomously.
5. **WIP = 1.** Only one feature may be `in_progress` in `feature_list.json`.
6. **Explore before code, and reuse before you build.** Read existing docs, state, types, and patterns before editing. The code generator climbs a lazy-senior decision ladder (YAGNI → an existing repo utility → the standard library → a native platform feature → an installed dependency → minimal new code) and **thinks hard about what to do before writing** — if a lib or standard/repo function already does the job, use it rather than reinventing it.
7. **Evidence before claims.** Never mark a task, criterion, or feature done without fresh verification evidence from real execution.
8. **One writer per field-group, and each writer commits what it owns.** Grill + human produce `tiger/features/<id>/{spec,adr,business}.html` plus the Robot Framework `e2e_testcases.robot` CASES (each case tagged `priority:high|medium|low`) **and create the feature's board entry with its WHY/SPECIFY fields** (`feature_list.json`: problem/jtbd/spec_file/acceptance_criteria/metric, `status: in_progress`, `phase: plan`), committing all of it on approval. The Architect **enriches** that entry with the PLAN fields (`scope_map.modify`/`read_only`, `tasks[]` each carrying `files`/`depends_on`/`context`/`verification`, RED-proven acceptance-check commands) and bootstraps `tiger/codemap.html` if missing, **and commits that** — it never rewrites grill's WHY/SPECIFY fields. The Code Generator owns code, commits code, flips `tasks[].status`, and appends `progress.md`. The **E2E gate** is the single in-loop gate: it owns `refs/notes/e2e` (the priority-graded note), the board `phase` pointer and `acceptance_criteria[].status` **during the loop**, the executable `e2e_keywords.resource` (the Robot Framework keyword implementations — Playwright behind the scenes — it authors for grill's agreed cases; it never edits the cases), and Robot's run evidence, **and commits each phase update**. **Security and Reviewer are standalone-only** now: when a human runs them they own their namespaced git notes (`refs/notes/security`, `refs/notes/review`) — no commits, no board, no code — but the automated workflow does not run them. Update-Docs owns the global HTML docs, the project `README.md` refresh, and the **passing close-out** of the board (authoring each by loading the `tiger-docs-codemap/business/release/readme` writer skills), **and commits all of it in one close-out commit**. The git note IS the grade. The board must always be committed: that is what makes "resume from `git log` + `git notes` + board phase" real and keeps a dirty board from blocking branch operations.
9. **Workflow-driven orchestration; spawn the spine, never inline it.** The deterministic spine is the saved dynamic workflow `tiger-workflow-dev.js`. It first runs a **bootstrap** discovery step (reads the board to find the approved in-progress feature, resolves today + the `main` trunk — which is why `/tiger-workflow-dev` needs no args), then spawns Architect → (parallel Code Generators in isolated worktrees → Integrator){per dependency wave} → E2E (bug-priority gate; on "not pass" it loops back to the **Architect to re-plan** delta tasks → rebuild → re-e2e, ≤2 no-progress rounds → blocked) → Update-Docs, in fixed order. The build stages are subagents the workflow spawns; the user may also invoke a single stage skill standalone. A stage never does another stage's work — the boundaries are the git/board ownership in #8. **The grill is the one deliberate exception: it runs inline in the main session** because it interviews the human one question at a time, and a subagent has no channel to ask a question and wait. Grill is therefore a skill, not an agent.
10. **Scope map + per-task context required.** Every build task must state `MODIFY`, `READ_ONLY`, and `METRIC` before code changes, plus a `context` brief (where the code lives, which existing code to reuse, how it connects, the behavior it must satisfy) so a parallel generator with only the board can build it.
11. **Project rm guard required.** The `install` command places a PreToolUse Bash hook that blocks `rm` before execution. Do not build if the guard is missing or unverified. The guard is a speed bump, not a sandbox: it blocks the `rm` token, not every deletion path.

## Standard Startup

```bash
./init.sh
```

Read these files before work. They are per-project runtime state that lives in the target project, not this plugin template:

- `CLAUDE.md`
- `progress.md`
- `feature_list.json`
- The active `tiger/features/<id>/spec.html`, if any (plus its `adr.html`, `business.html`, and `e2e_testcases.robot` siblings)
- `tiger/codemap.html` (structural map)

## Feature Board Contract

`feature_list.json` uses schema version 2. Every feature is a detailed kanban ticket with:

- WHY-loop fields: `problem_statement`, `jtbd`, `problem_classification`, `user_context`
- SPECIFY fields: `spec_file` (the `spec.html` path), `spec_status`, `approval`, `acceptance_criteria`, `scope_map.metric`
- PLAN fields: `scope_map.modify`, `scope_map.read_only`, persisted `tasks[]` (each with `files`, `depends_on`, `context`, `verification`)
- BUILD fields: `tasks[].status`, `tasks[].evidence`
- VALIDATE fields: `validation`, acceptance evidence, business metric notes
- LEARN fields: `learning.technical`, `learning.product`, `learning.process`, `learning.harness_updates`

The field-groups map one-to-one onto the stage that writes them, which is what "one writer per field-group" means: **grill** creates the entry and writes WHY + SPECIFY; **architect** adds PLAN; **code generator** writes BUILD (`tasks[].status`/`evidence`); **e2e** writes VALIDATE during the loop; **update-docs** writes LEARN + the passing close-out. No stage rewrites another's fields.

The board must preserve reciprocal, acyclic `depends_on`/`blocks` links. `current_feature` must match the single `in_progress` feature or be `null`.

The board carries a `phase` pointer (`plan | build | validate | blocked | passing`). Resume from interruption = `git log` + `git notes --ref=e2e` + board phase. The e2e gate's git note (`grade: pass|changes|blocked` + per-priority `blockers:` + priority-ordered `fixes:`) IS the in-loop grade; there is no separate board field. (When a human runs the standalone gates, `git notes --ref=security|review` add their grades too.)

**Memory is in git, not in hidden agent state.** The kit's cross-feature memory is the board's `learning.*` fields, `progress.md`, `tiger/codemap.html` (structural memory carried feature→feature), `tiger/business.html` (the cumulative per-feature product catalog), and `CLAUDE.md` (conventions) — all version-controlled and human-inspectable. The subagents therefore deliberately do NOT use the `memory:` frontmatter field: a private, cross-session store would add behavior-shaping state outside the artifacts, break the "resume from git" determinism, and (with `user` scope) leak one project's learnings into another. update-docs records durable lessons in `learning.harness_updates` for a human to promote into `CLAUDE.md`.

## The Pipeline (v2 — `docs/dev-loop-v2.md`)

```
human ⇄ grill → architect → ( ∥ code generators in worktrees → integrate ){per wave} → e2e[bug-priority] → update docs → MR(→ main)
  (only human gate)  opus          sonnet, parallel          sonnet         opus: HIGH+MED block,        opus, rebase onto main
                                                                            LOW logged
        └── e2e "not pass" ⟲ back to ARCHITECT → re-plan (delta tasks) → rebuild → re-e2e   (≤2 no-progress rounds → blocked) ──┘
tiger-security / tiger-reviewer → STANDALONE-only (invoke on demand; not in the automated loop)
```

- **bootstrap** (sonnet) reads `feature_list.json` to find the approved in-progress feature, re-checks the `spec.html` approval token, and resolves `today` + the `main` trunk. This is why the workflow needs no args.
- **Architect** (opus) reads grill's board entry + the four grill artifacts + codemap, validates scope against the real codebase, writes the blueprint, enriches the board entry with the PLAN fields (scope_map + `tasks[]` with per-task `context`/`files`/`depends_on` + RED-proven checks), bootstraps the codemap, commits the board plan. **The architect is the SOLE reader of `tiger/codemap.html`** — it distils the relevant structure into each task's `context`; the code generators build from that context and never read the codemap. On a re-plan it re-recons and refreshes the codemap.
- **Code Generator** (sonnet) implements with strict TDD, **reusing before it builds**. The workflow builds the architect's `tasks[]` in **dependency waves**: a 1-task wave is one solo TDD commit; a wave of independent **file-disjoint** tasks is built by concurrent generator subagents, **each in its own isolated git worktree** (full TDD + full verify + one code/tests-only commit on a per-task branch), then a serial integrator cherry-picks those disjoint branches onto `feature/<id>` and records the board.
- **E2E** (opus) runs **once after all waves are built** (not per round). It authors `e2e_keywords.resource` (the executable Robot Framework keyword implementations, Playwright behind the scenes), then runs the agreed `e2e_testcases.robot` suite with `robot` and the architect's acceptance checks as real processes; **triages every defect by priority** (HIGH/MEDIUM block, LOW logged), records `refs/notes/e2e` with priority-ordered "where to solve" fixes, moves the board phase. On CHANGES the gate **always returns to the Architect to re-plan** (the open blockers become delta tasks that rebuild through the wave machinery → re-e2e), never an ad-hoc code-gen patch; bounded by 2 no-progress rounds → `phase: blocked`.
- **Update-Docs** (opus) refreshes the codemap/business/release HTML **and the project `README.md`** (loading the `tiger-docs-*` writer skills), records any LOW e2e defects as known issues, closes the board to `passing`, rebases onto `main`, and opens the MR (never merges).

Speed model (the v2 wins): no in-loop security/reviewer gates; independent tasks build in parallel in isolated git worktrees (file-disjoint → conflict-free cherry-pick; shared board written once by the integrator); e2e fires once at the end. A deeply sequential feature degrades gracefully to one task per wave.

Bounded retry: on e2e CHANGES the gate always routes back to the Architect to re-plan (delta tasks → rebuild → re-e2e); a no-progress re-plan round increments a stuck counter; **2 no-progress rounds → `phase: blocked`** with a priority-ordered fix list, stop for human. Git workflow and inter-stage boundaries are in `docs/tiger-git-best-practice.md` (trunk-based on `main`); test standards in `docs/tiger-unit-test-best-practice.md`; design-quality principles in the independent `tiger-code-quality` skill (which the architect, code generator, and standalone reviewer load). The current design diagram is `docs/dev-loop-v2.md`; the prior design is `docs/dev-architect.md` (historical).

## Repository Layout

- `skills/dev/tiger-grill/`: grill SKILL.md (inline interview → four artifacts + approval; the only human-interactive stage)
- `skills/dev/tiger-{architect,code-generator,e2e,update-docs}/`: the four automated build-stage skills, each invoked directly by the user or spawned by the workflow
- `skills/dev/tiger-{security,reviewer}/`: the two **standalone-only** review gates (invoke on demand; not in the automated workflow)
- `skills/dev/tiger-docs-{spec,adr,business,e2e,codemap,release,readme}/`: the 7 focused doc-writer reference skills (no owned agents); grill loads spec/adr/business/e2e, update-docs loads codemap/business/release/readme
- `skills/dev/tiger-code-quality/`: an independent reference skill (the 16 design principles); the architect, code generator, and reviewer load it
- `workflows/tiger-workflow-dev.js`: the deterministic spine (a saved dynamic workflow; install copies it into a project's `.claude/workflows/`, where it becomes `/tiger-workflow-dev`). Args-optional — bootstrap discovers the feature from the board.
- `agents/`: 6 self-contained stage subagents (architect, code-generator, e2e, update-docs, plus the standalone security + reviewer); model tier declared in frontmatter (opus everywhere except sonnet for the code generator)
- `templates/`: the starting-point files install places in a project — 5 self-contained HTML artifact templates (spec, adr, business, codemap, release_docs) plus 2 Robot Framework e2e templates (`e2e_testcases.robot` = the priority-tagged CASES grill writes, `e2e_keywords.resource` = the executable implementations the e2e gate writes) copied into `tiger/templates/`, plus `feature_list.json`, the empty schema-v2 kanban board seeded to the project root
- `hooks/`: real Claude Code hook wiring, `hooks.json` + `tiger-session-start.sh` (SessionStart context injection, scoped to Tiger projects). Hooks are JSON+script, never markdown.
- `commands/install.md`: the one slash command — copies the workflow/guard/templates and verifies harness state (including the `main` trunk)
- `project-hooks/tiger-block-rm.sh`: rm guard copied into target projects
- `scripts/validate-plugin.sh`: structural + schema validation (run by `init.sh`)
- `scripts/validate-board.py`: board-invariant checker for `feature_list.json`

## Doc Style

When producing any standalone HTML page or rich doc (an overview, design doc, report, or a spec/ADR rendered for reading), follow `docs/tiger-doc-style.md` — the house style: light GitHub palette, sticky numbered TOC, semantic callouts, and Mermaid + highlight.js via CDN. Lift its CSS `:root` verbatim so artifacts stay visually identical. This is the plugin-level analog of a user-level doc-style file: it travels with the kit, so the look never depends on anyone's personal `~/.claude` config. The HTML artifact templates under `templates/` follow this palette too — inline and self-contained (no CDN; `codemap` is the only one allowed the Mermaid module import). The e2e contract is the exception: it is a Robot Framework `.robot`/`.resource` pair, not HTML — human-readable as plain Given/When/Then text, and Robot's own generated `report.html` is the browser-openable evidence.

## Skill Extension Rules

Add a new skill only when the new capability has a distinct trigger, owned agents, state contract, workflow phase, or verification evidence. Otherwise, extend the existing skill.

When adding or changing a skill:

- Update the skill pack under `<chosen-skill-pack-path>/SKILL.md` and its owned agent(s).
- Add the skill path to `.claude-plugin/plugin.json` under `skills`.
- Add matching root `agents/*.md` registry files (frontmatter `name`/`description`/`model`/`tools`) when a skill adds owned agents.
- Update `CLAUDE.md` when operating rules, routing, required artifacts, non-negotiables, or definition of done change.
- Update `README.md` when users need install/use/invocation guidance.
- Update `commands/install.md`, `workflows/tiger-workflow-dev.js`, or the plugin-level `hooks/hooks.json` (+ scripts) when the stage spine, setup steps, or mechanical enforcement changes. Hooks must be real JSON+script wiring, never markdown. Do not add other slash commands without explicit approval.
- Update `feature_list.json` and `progress.md` when the skill work is tracked as a feature.
- Run `./init.sh` before claiming completion.

## Commands, Skills & the Workflow

- `/tiger-skills:install` — the one slash command. Copies the workflow, rm guard, and the artifact templates (HTML + the Robot Framework e2e `.robot`/`.resource`) into the project and verifies/seeds `init.sh`/board/`progress.md`/`main` trunk. Idempotent; never grills or builds.
- The automated stages are **skills**, invoked by intent: `tiger-grill`, `tiger-architect`, `tiger-code-generator`, `tiger-e2e`, `tiger-update-docs`. Use one on its own, or grill → approve → run the workflow.
- The two **review gates** are **standalone skills**: `tiger-security`, `tiger-reviewer` — invoke on demand to audit a branch/commit. They are not part of the automated workflow.
- The seven **`tiger-docs-*` writer skills** (`spec`, `adr`, `business`, `e2e`, `codemap`, `release`, `readme`) are loadable references with no owned agents — grill and update-docs load them, or invoke one directly (e.g. "refresh the README", "write the robot e2e cases").
- `/tiger-workflow-dev` — the installed workflow. **No args required**: it auto-discovers the approved in-progress feature from `feature_list.json`. Run it (or re-run it to resume) after a spec is approved. Optional overrides: `featureId`, `specFile`, `projectDir`, `today`, `proModel`, `fastModel`.

## Existing Project Adoption

`/tiger-skills:install` seeds harness state when it is missing — it creates or merges `feature_list.json`, `progress.md`, and a minimal `CLAUDE.md`, installs the rm guard, ensures a born `main` branch, and preserves existing conventions without clobbering. It never reads source, grills, or builds. Existing work without approval evidence gets a retrospective grill (via the `tiger-grill` skill) before any build.

## Definition of Done

A feature can become `passing` (only Update-Docs may set it) when:

- The spec is human-approved (the approval token is present in `spec.html`).
- Every task in `tasks[]` is complete.
- Every acceptance criterion is done with evidence from real execution.
- The e2e gate passed on the built feature with **zero HIGH and zero MEDIUM defects** (LOW defects, if any, are logged as known issues), all with fresh notes.
- The verification pipeline has fresh passing output.
- `feature_list.json`, `progress.md`, the global HTML docs (including the cumulative `tiger/business.html` catalog), and learning fields are current.
