---
name: harness-engineering
description: Build and maintain the harness around AI coding agents — the five subsystems that make agents reliable. Use when setting up a project for AI agents, improving agent workflows, making agents more reliable, creating or updating AGENTS.md / CLAUDE.md / feature_list.json / progress.md, session management, feature tracking, verification pipelines, or diagnosing agent failures. This skill is rigid — its rules must be followed, not negotiated.
---

# Harness Engineering — Conductor

Based on [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) by walkinglabs. Build everything outside the model that makes AI coding agents reliable.

> A harness is not a prompt file. A harness is everything in the engineering infrastructure outside the model weights. — walkinglabs, Lecture 02

## Core Thesis

**The same model produces fundamentally different output in a bare environment vs. one with a complete harness.** When the model fails on a task you know it can handle, check the harness first — not the model.

## How to read this skill

This skill is the **conductor**. On **every request** you run the **Gate Sequence** below, top to bottom. The Gate Sequence is mechanical, not advisory:

- You do **not** skip a gate silently. If a gate does not apply (e.g. no failure → no heal), you mark it skipped on the ledger with a one-line reason.
- You keep a **live ledger** (GATE 2) of the gates for the current task and tick each one as you pass it. The ledger is the cure for "the agent loses track of what to do."
- Each gate has an **exit condition**. You do not advance until it is met.
- The conductor never delegates control. It invokes a sub-skill or spawns an agent; that component returns; control comes back here for the state update.

```
User Request → Gate Sequence (this file) → each gate updates the ledger + state
```

---

## Invocation names — these skills and agents are plugin-namespaced

This is a **plugin** (`tiger-skills`). Its skills and agents are **always** registered under that namespace, so at the actual call site you MUST use the prefixed name — the bare name does not resolve:

- **Skill tool:** pass `tiger-skills:<skill>` — e.g. `tiger-skills:harness-engineering-grill`, `tiger-skills:harness-engineering-bootstrap`, `tiger-skills:code-quality-audit`.
- **Agent / Task tool:** set `subagent_type` to `tiger-skills:<agent>` — e.g. `tiger-skills:explorer`, `tiger-skills:planner`, `tiger-skills:scribe`.

The short names used in the prose below (e.g. "spawn the planner", "invoke grill") are for readability. **Always prepend `tiger-skills:` when you actually call the tool.** A bare `explorer` or `harness-engineering-bootstrap` will fail with "not found" — that is the namespace, not a typo.

---

## THE GATE SEQUENCE — run on every request, in order

| Gate | Name | What it does | Exit condition |
|------|------|--------------|----------------|
| **0** | BOOTSTRAP | The 4 harness files exist? | All of AGENTS.md, feature_list.json, progress.md, init.sh exist with real content |
| **1** | SPEC GATE | Build request + no approved spec? → **invoke `harness-engineering-grill` NOW** | The request maps to a feature with an approved spec, OR it is a bug/question/precise-edit that needs no spec |
| **2** | LEDGER | Create the live phase ledger for this task | A checklist of the gates that apply exists and is visible |
| **3** | CLOCK IN | `harness-engineering-session` clock-in | All state files read, environment healthy, understanding announced |
| **4** | SCOPE | `harness-engineering-feature` — WIP=1 | Exactly one feature `in_progress`, definition of done written |
| **5** | EXPLORE & PLAN | Spawn `explorer` (recon) → `planner` (blueprint) → `scribe` **persists `tasks[]`** | Blueprint reviewed AND its task breakdown written into the feature's `tasks[]` by the scribe |
| **6** | ARCHITECT | Spawn `code-architect` when triggers fire | Architecture approved, OR gate marked skipped with reason |
| **7** | GENERATE | Spawn `generator` → `scribe` applies its Board Update | Handoff received with proof line; scribe flipped the tasks to `passing` |
| **7b** | E2E AUTHOR | Spawn `e2e-engineer` to author the user-flow E2E (Playwright) against the just-built feature | An asserting E2E flow exists for every acceptance criterion; proof line emitted |
| **8** | EXECUTE | Spawn `executor` → `scribe` records evidence | All layers pass with fresh evidence, OR escalation to GATE 9 |
| **9** | HEAL | Spawn `healer` on executor failure (max 3 loops) | Executor passes, or user escalation |
| **10** | VERIFY | `harness-engineering-verify` — conductor re-runs | Verification command ran THIS session, 0 failures |
| **11** | REVIEW CLUSTER | Spawn `reviewer` (quality) + `correctness-reviewer` (behavior) + `security-reviewer` (if triggered) — loop to GATE 7 on any non-APPROVED | All spawned reviewers APPROVED; BLOCKING/MAJOR/CRITICAL/HIGH findings fixed |
| **12** | TRACK | `scribe` writes feature + tasks + acceptance_criteria + `progress.md` | All state files current; scribe proof line emitted |
| **12b** | MAP | Spawn `cartographer` — refresh `CODEBASE_MAP.md` (Mermaid architecture + code-flow diagrams; function chains with real inputs/outputs); then the conductor commits | `codebase-map updated: YES` proof line; map matches the code; work committed |
| **13** | CLOCK OUT | `harness-engineering-session` clock-out | 8-item exit checklist passes |

**Phase 0 (Grill) and GATES 5–9 only run for implementation work.** A pure question or a one-line precise edit runs GATE 0 → GATE 1 (skip) → answer. Use the decision table in GATE 5 to choose pipeline vs. direct path.

---

## GATE 0 — BOOTSTRAP (do this first, always)

Before answering, before reading any reference, before ANY other action — check whether the four harness files exist.

| # | File | If missing |
|---|------|------------|
| 1 | `AGENTS.md` or `CLAUDE.md` | Create it — `harness-engineering-bootstrap` |
| 2 | `feature_list.json` | Create it — `harness-engineering-bootstrap` |
| 3 | `progress.md` | Create it — `harness-engineering-bootstrap` |
| 4 | `init.sh` | Create it — `harness-engineering-bootstrap` |

**Gate rule:** if any file is missing, the ENTIRE response is: report which are missing, create them all (via `harness-engineering-bootstrap`), report done. No other action until the gate passes.

**Bootstrap stays in its lane:** it creates ONLY the four files above. It does **not** write anything to `specs/`, does **not** stamp any spec `Status: approved`, and any features it seeds start `not_started` with no approved spec. If the user pasted a spec or feature idea, bootstrap does not consume it as "done" — that text is carried into GATE 1 as grill input. Authoring and approving specs is grill's job (GATE 1), never bootstrap's.

---

## GATE 1 — SPEC GATE (this is what makes grill mechanical)

**Before any planning or code, decide: does this request need a spec, and does it have one?**

```
Is the request a BUILD request? (add / build / implement / create / "I want…" / "can we…" / a feature idea)
├── NO  (bug fix, factual question, precise one-line edit, research) → skip grill, continue to GATE 2
└── YES
     ├── A HUMAN-approved spec already covers it? (spec_file present, AND the human
     │   explicitly approved it in an earlier turn — see the approval rule below)
     │      → continue to GATE 2
     └── Otherwise (no spec, OR a spec exists but no human approved it this/any session)?
            → INVOKE `harness-engineering-grill` NOW. Do not plan. Do not write code.
              Grill writes specs/<feature-id>.md, gets HUMAN approval, then adds the
              feature to feature_list.json. Only then continue to GATE 2.
```

**What "approved" means — and the self-approval ban (this is the hole that lets grill get skipped):**

- A spec is **approved only when a human said "yes" to it in the conversation.** The `Status:` line in a spec file is a _record_ of that human decision, never a substitute for it.
- **You may never write `Status: approved` yourself.** Only grill sets it, and only _after_ it has shown the spec to the human and received an explicit approval in the same session. A spec you (or bootstrap) authored or edited this session is a **draft**, not an approved spec — it does not satisfy this gate.
- **A spec the user pasted into the prompt is grill INPUT, not approval.** A complete-looking pasted spec does not mean grill is done — it means grill starts from a strong draft. Grill still runs to resolve the spec's own open questions and obtain explicit human sign-off. (In the failure this rule fixes, the conductor took a pasted spec, wrote it to `specs/` stamped `approved`, and skipped grill — never do this.)
- When in doubt about whether approval happened, it didn't. Run grill.

**What counts as "needs a spec":** anything that adds or changes user-visible behavior. When unsure, grill — the cost of a short interview is far below the cost of building the wrong thing.

**Anti-triggers (skip grill):** reported bug → `harness-engineering-diagnose`; question about the codebase → explore and answer; a precise unambiguous instruction ("rename X to Y in file.ts") → just do it under the normal gates.

**This gate is mechanical, not advisory.** Invoking `harness-engineering` does not let you jump to coding — a new build request always passes through grill first.

---

## GATE 2 — LEDGER (the cure for dropped steps)

Create a **live phase ledger** for this task: a visible checklist of the gates that apply, which you tick off as you go.

- Use your task/todo list (`TaskCreate` one entry per applicable gate, `TaskUpdate` to `in_progress`/`completed` as you move). If task tools are unavailable, write the ledger as a checklist in your reply and restate it after each gate.
- Mark each gate `done`, `skipped (reason)`, or `blocked` as you pass it. **Never advance leaving a gate silently unmarked.**
- The ledger is per-task working memory; the durable record is `feature_list.json` (`tasks[]`) and `progress.md`. Keep both in sync.

**Why this gate exists:** long multi-gate tasks drift — the agent does the plan, writes code, then forgets to persist tasks or update state. A ticked ledger plus persisted `tasks[]` means a dropped step is visible immediately.

---

## GATE 3 — CLOCK IN

**Invoke `harness-engineering-session`** (clock-in): read AGENTS.md, progress.md, feature_list.json; review `git log --oneline -5`; run `./init.sh`; fix any baseline failure before new work; announce understanding. Exit: state files read, environment healthy.

## GATE 4 — SCOPE

**Invoke `harness-engineering-feature`**: read feature_list.json, enforce WIP=1, pick the highest-priority `not_started` whose `depends_on` are all `passing` (or continue the active one), mark it `in_progress`, write the definition of done. Exit: exactly one feature `in_progress`.

---

## GATE 5 — EXPLORE & PLAN (and persist the blueprint so it cannot evaporate)

Use the decision table to choose the path:

| Task Type | Path |
|-----------|------|
| New module, class, or endpoint | Full pipeline (Explorer → Planner → Generator → Executor) |
| Feature spanning 3+ files | Full pipeline **+ Code Architect** |
| Refactoring (behavior-preserving) | Explorer → Planner → Generator → Executor (skip Architect) |
| Bug fix (single file, root cause known) | Direct path |
| Typo, formatting, config value | Direct path |
| Unknown failure / regression | `healer` standalone |
| Research / exploration | Direct path (inline) |

**When in doubt, use the pipeline.** For the direct path, do the work inline, then go to GATE 10.

**Step 5a — EXPLORE (spawn `explorer`)** — for non-trivial or unfamiliar code. Read-only recon that grounds the plan in reality:

```
Spawn agent: tiger-skills:explorer
Prompt: "Recon the codebase for [feature ID]: [feature title].
Spec file: specs/<feature-id>.md. Project directory: [path].
If CODEBASE_MAP.md exists, read it FIRST — the cartographer-maintained map (architecture,
code flows, function inventory with inputs/outputs). Use it as your starting reference,
VERIFY the parts this feature touches against the code, and report any drift.
Produce a Recon Report: Type Inventory (existing types/functions/constants with file:line),
Module Map, Existing Patterns to Follow, Integration Points, Already Exists — Do NOT Duplicate, Risks.
You are read-only — never write code or state."
```

If the change is trivial, mark 5a `skipped (trivial)` on the ledger.

**Step 5b — PLAN (spawn `planner`)**, handing it the Recon Report:

```
Spawn agent: tiger-skills:planner
Prompt: "Plan the implementation for [feature ID]: [feature title].
Feature behavior: [user_visible_behavior]
Spec file: specs/<feature-id>.md (read it for decisions and acceptance criteria)
Recon Report: [paste the explorer's report]
Verification criteria: [from feature_list.json]
Project directory: [path]

Read AGENTS.md, progress.md, feature_list.json, and the spec. Use the Recon Report — do not re-explore from scratch.
For non-trivial features, consult the code-architect agent during design.
Produce a blueprint: Context → Task Breakdown → Execution Phases → Risks.
End with a 'Persisted Task Breakdown (JSON)' block: an array of tasks ready for the feature's
tasks[] — each {id,title,agent,status:'not_started',files,depends_on,verification}."
```

**The planner returns a blueprint.** Read it. It must have: a task breakdown table, execution phases, risks. If vague, send it back with specific questions — do not proceed on a weak blueprint.

**Step 5c — PERSIST (spawn `scribe`, this is the fix for lost plans):** hand the planner's `Persisted Task Breakdown (JSON)` to the scribe as a Board Update; the scribe writes it into the active feature's `tasks[]`. The plan now lives in the repo, not just in chat. Tick GATE 5 on the ledger.

**Exit:** blueprint approved AND `tasks[]` written to `feature_list.json` by the scribe.

---

## GATE 6 — ARCHITECT (required when triggers fire — not "optional")

Spawn `code-architect` **whenever any trigger is true** (this is mechanical):

- the feature creates a new module or package, OR
- the feature spans 3+ files, OR
- it introduces a new architectural pattern, OR
- the planner's risk assessment flagged a structural concern.

If none are true, mark GATE 6 `skipped (trivial change, no structural risk)` on the ledger and continue. Otherwise:

```
Spawn agent: tiger-skills:code-architect
Prompt: "Review the architecture for this blueprint:
[blueprint]
FIRST invoke code-quality-audit for the 16-principle design audit, THEN map findings to patterns.
Produce: Summary → Violations (file:line) → Pattern Recommendations → Verdict.
Begin your report with the proof line: 'code-quality-audit invoked: YES — N principles checked, M violations'."
```

If the verdict is CHANGES REQUESTED / REJECTED, send it back to the planner to adapt the blueprint (and re-persist `tasks[]`). Loop until APPROVED or APPROVED WITH CHANGES.

**Exit:** architecture approved, and the architect's report contains the `code-quality-audit invoked: YES` proof line.

---

## GATE 7 — GENERATE

```
Spawn agent: tiger-skills:generator
Prompt: "Implement this blueprint. Follow code-quality rules and TDD.
Blueprint + persisted tasks[]: [paste]
Project directory: [path]
Before writing: read AGENTS.md, feature_list.json, progress.md; invoke code-quality-language
(it infers the language's idioms from the repo); build a Type Inventory.
During: TDD (failing test → minimal code → refactor); types everywhere; DI; enums; no bare
except; flat functions; no placeholders.
Do NOT run git (no add/commit) — the conductor commits at GATE 12; never write
feature_list.json or progress.md (the scribe's alone) — emit a Board Update instead.
Produce a Generator Handoff: completed task IDs, files changed, Layer 1+2 results,
notes. Begin the handoff with the proof line:
'code-quality-language invoked: YES — language: <X>, N violations found, N fixed'."
```

**The generator returns a handoff** ending in a `Board Update` block (e.g. `task T1 → passing`). It must show: all blueprint tasks complete, Layer 1 (lint+type) passing, Layer 2 (tests) passing, no placeholders, AND the `code-quality-language invoked: YES` proof line. If the proof line is missing or self-verification fails, send it back — do not proceed.

**State write (via scribe):** hand the generator's `Board Update` to the `scribe`, which flips each completed task in `tasks[]` to `passing`. The conductor does not edit `feature_list.json` itself. Tick GATE 7. **Exit:** handoff received with proof line, scribe confirmed the task updates.

---

## GATE 7b — E2E AUTHOR (the user-flow test, written after the feature exists)

The feature code now exists, so its real entry points (URL / CLI / API) exist too — this is the moment to author the end-to-end test that drives the **real user flow**. A **dedicated agent** does it (not the generator): the generator writes the feature + unit tests; the `e2e-engineer` writes the user-flow E2E. For trivial changes (typo, doc, config value) mark GATE 7b `skipped (trivial)` and continue.

```
Spawn agent: tiger-skills:e2e-engineer
Prompt: "The feature for [feature ID] is now written. Author its end-to-end user-flow tests.
Generator handoff: [paste]   Spec: specs/<feature-id>.md (each acceptance criterion's user-visible
outcome becomes an E2E assertion)   Project directory: [path]
Invoke e2e-authoring (it applies harness-engineering-verify Layer 3). Drive the REAL entry point
(URL/CLI/API) end to end and assert the visible outcome — never a stub. If the project has no E2E
harness, scaffold Playwright (playwright.config + tests/e2e/). Cover the happy path plus the spec's
error and edge cases, one asserting flow per acceptance criterion. Modify NO feature logic.
Begin with: 'e2e-authoring invoked: YES — stack: <X>, flows covered: N, ACs asserted: X/Y'."
```

**Write E2E every time.** The `e2e-engineer` is re-spawned after every fix — each heal loop (GATE 9) and each review-fix loop (GATE 11) — to extend the flows for the changed behavior and add an E2E regression flow when the bug was user-visible, before the executor re-runs the full suite. This is what makes "the fix broke nothing" a verified fact.

**Exit:** an asserting E2E flow exists for every acceptance criterion, and the report carries the `e2e-authoring invoked: YES` proof line.

---

## GATE 8 — EXECUTE

```
Spawn agent: tiger-skills:executor
Prompt: "Verify the implementation independently.
Generator handoff: [paste]   Verification criteria: [paste]   Project directory: [path]
Invoke harness-engineering-verify and run all 3 layers: static → FULL unit suite (no early stop)
→ E2E (mandatory for user-visible behavior — run the user-flow tests the e2e-engineer authored at
GATE 7b). Reject the handoff if a user-facing feature has no E2E test of its workflow, or if any
acceptance criterion has no asserting test.
Iron Law: never claim completion without fresh evidence from THIS session.
Pass → report success with full output. Fail → Executor Escalation (exact error, commit, files).
Begin your report with the proof line: 'harness-engineering-verify invoked: YES — layers run: 1,2,3'."
```

| Executor result | Conductor action |
|-----------------|------------------|
| PASS (all layers green) | Hand the executor's `Board Update` (evidence line) to the `scribe`, go to GATE 10 |
| FAIL (any layer red) | Go to GATE 9 (Heal) |

**Exit:** executor reports all layers passing with the proof line and the scribe recorded the evidence, or escalation sent to healer.

---

## GATE 9 — HEAL (only on executor failure, max 3 loops)

```
Spawn agent: tiger-skills:healer
Prompt: "Diagnose and prescribe a fix.
Executor escalation: [paste]   Blueprint: [paste]   Project directory: [path]
Invoke harness-engineering-diagnose. Investigate → reproduce → classify to one of five layers
→ root cause (file:line) → exact fix instructions → a MANDATORY failing-first regression test
(fails on the broken code, passes after the fix; E2E if the bug was user-visible) → harness-improvement note.
Begin with the proof line: 'harness-engineering-diagnose invoked: YES — layer: <X>'."
```

After the healer responds: (1) spawn `generator` again with blueprint + healer fix + the regression test + "apply these fixes and add the regression test"; (2) spawn `executor` again — it re-runs the **full** suite (unit + E2E) so a fix that broke another part is caught. **Max 3 healing loops** — then escalate to the user with full diagnostic history. **Exit:** executor passes (new regression test green, nothing else red), or user escalation.

---

## GATE 10 — VERIFY

**Invoke `harness-engineering-verify`.** Even if the executor already produced evidence, the conductor re-runs the top-level verification command — two independent verifications. Iron Law: never claim completion without fresh evidence from THIS session. **Exit:** command ran THIS session, 0 failures, evidence recorded.

## GATE 11 — REVIEW CLUSTER (three independent checkers, one fix loop)

For non-trivial changes (new modules, functions >15 lines, API endpoints, 3+ files) spawn the review cluster. Each reviewer is independent — none wrote the code, and they check **different things**: structure, behavior, and security are separate audits and a clean structure audit does not imply correct behavior. Spawn the applicable ones (they can run in parallel):

**11a — Quality (always, non-trivial)** — does it follow the design principles?
```
Spawn agent: tiger-skills:reviewer
Prompt: "Review independently. You did NOT write this code.
Diff/commits: [list]   Spec: specs/<feature-id>.md   Acceptance criteria: [paste]   Project dir: [path]
FIRST invoke code-quality-review (27 items) and harness-engineering-review (spec/harness compliance).
Produce findings (file:line, severity), a spec-compliance table, a verdict, and a Board Update.
Begin with the proof line: 'code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR'."
```

**11b — Correctness (always, non-trivial)** — does it actually work, and is every behavior proven by a test?
```
Spawn agent: tiger-skills:correctness-reviewer
Prompt: "Adversarially review correctness. You did NOT write this code — assume it is wrong and prove it.
Diff/handoff: [list]   Spec: specs/<feature-id>.md   Acceptance criteria: [paste]
Executor evidence: [paste]   Project dir: [path]
FIRST invoke code-correctness-review. Trace control + data flow, enumerate edge cases, hunt logic bugs,
build the AC↔test map, check the E2E test exists, check regressions.
Begin with: 'correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y'."
```

**11c — Security (only if a trigger fires)** — spawn `security-reviewer` when the diff touches **auth, untrusted/external input, a built query or shell command, network/file I/O, deserialization, crypto/secrets/credentials, security-relevant config, or a new dependency.** If none apply, mark 11c `skipped (no security-sensitive surface)`.
```
Spawn agent: tiger-skills:security-reviewer
Prompt: "Security review. You did NOT write this code.
Diff/handoff: [list]   Spec: specs/<feature-id>.md   Triggers that fired: [list]   Project dir: [path]
FIRST invoke security-review; audit the 12 categories; run the project's SAST/dep-audit if present.
Begin with: 'security-review invoked: YES — N categories checked, C critical, H high'."
```

**Aggregate the verdicts.** A handoff missing its proof line is rejected and that reviewer is re-spawned (see the proof table).

| Worst finding across the cluster | Conductor action |
|----------------------------------|------------------|
| All APPROVED / APPROVED WITH CHANGES (MINOR/LOW only) | Hand each `Board Update` to the scribe, go to GATE 12 |
| Any MAJOR / CHANGES REQUESTED / HIGH | Loop back to GATE 7 (generator) with the findings, max 3 loops, then escalate |
| Any BLOCKING / REJECTED / CRITICAL | Loop back to GATE 7 immediately with the findings, max 3 loops, then escalate |

A missing E2E test for a user-facing feature, or an acceptance criterion no test proves, is a **BLOCKING** correctness finding — it loops back, it does not pass.

**Exit:** every spawned reviewer verdict is APPROVED (or review not required); all BLOCKING/MAJOR/CRITICAL/HIGH findings fixed.

## GATE 12 — TRACK (close the loop in the repo)

Update ALL durable state — this is the other half of the "don't lose things" fix. The **scribe** writes the board and log; the conductor commits:

1. **Spawn `scribe`** with the accumulated Board Updates. It flips remaining `tasks[]` to `passing`, flips `acceptance_criteria` `done: true` with evidence, sets the feature `passing` **only when every task is passing and every criterion is done**, records `evidence`, and updates `progress.md` (completed, in-progress, known issues, next steps). The scribe refuses any write that breaks an invariant.
2. **Spawn `cartographer` (GATE 12b — keep the map true):** it refreshes `CODEBASE_MAP.md` — re-traces the code flows the feature added or changed (the function chain behind each entry point, every hop's REAL input/output types with file:line), updates the Mermaid architecture + flow diagrams and their step tables together, refreshes the function/type inventory, and prunes deleted code. The cartographer is the **single writer** of `CODEBASE_MAP.md`, exactly as the scribe is of the state files. Proof line required: `codebase-map updated: YES — flows traced: N, symbols verified: S, diagrams: D, pruned: P` — reject the handoff and re-spawn without it. This is what lets the NEXT feature's explorer read a map instead of re-discovering the repo.
3. **git commit** (conductor) — descriptive message, safe restart state (map + state in the same commit).

**Exit:** scribe confirmed `feature_list.json valid after write: YES`, cartographer confirmed `codebase-map updated: YES`, all state files current, work committed.

## GATE 13 — CLOCK OUT

**Invoke `harness-engineering-session`** (clock-out): the 8-item exit checklist (init.sh passes, progress.md + feature_list.json updated by the scribe, work committed, no debug artifacts/temp files, startup works, next session ready). **Exit:** all 8 pass.

---

## Proof-of-invocation — why agents stop skipping their skills

Every spawned agent must begin its report with a **proof line** showing it invoked its required skill. The conductor rejects a handoff without one and re-spawns. This is what makes "the agent must review against design principles" actually happen.

| Agent | Required skill | Proof line it must emit |
|-------|----------------|-------------------------|
| explorer | (read-only recon) | `Type Inventory built: YES — N existing types catalogued` |
| planner | (consult code-architect for non-trivial) | `code-architect consulted: YES/NO — <reason>` |
| code-architect | `code-quality-audit` | `code-quality-audit invoked: YES — N principles checked, M violations` |
| generator | `code-quality-language` | `code-quality-language invoked: YES — language: <X>, N violations found, N fixed` |
| e2e-engineer | `e2e-authoring` | `e2e-authoring invoked: YES — stack: <X>, flows covered: N, ACs asserted: X/Y` |
| executor | `harness-engineering-verify` | `harness-engineering-verify invoked: YES — layers run: 1,2[,3]` |
| healer | `harness-engineering-diagnose` | `harness-engineering-diagnose invoked: YES — layer: <X>` |
| reviewer | `code-quality-review` + `harness-engineering-review` | `code-quality-review invoked: YES — 27 items checked, K BLOCKING, M MAJOR` |
| correctness-reviewer | `code-correctness-review` | `correctness-review invoked: YES — paths traced: P, edge cases: E, logic findings: K, ACs proven by test: X/Y` |
| security-reviewer | `security-review` (when triggered) | `security-review invoked: YES — N categories checked, C critical, H high` |
| scribe | (validates board after write) | `feature_list.json valid after write: YES — applied N deltas` |

## The Board Update contract — how agents drive the kanban

Agents do not edit `feature_list.json` directly (one writer = no drift). Instead, every agent that changes the board ends its handoff with a `Board Update` block, and the **scribe** applies it:

```
## Board Update
- task <ID> → <not_started|in_progress|blocked|passing> [reason if blocked]
- acceptance_criteria <ID> → done (evidence: <text>)
- evidence: <line appended to the feature's evidence[]>
- tasks[]: <planner's Persisted Task Breakdown JSON, on first persist>
```

The scribe is the **single writer** of `feature_list.json` and `progress.md`. It applies deltas verbatim but refuses any that break an invariant (feature `passing` only when all tasks pass and all criteria are done; WIP=1; reciprocal/acyclic links). This is how the agents genuinely *operate* the board without five of them writing it at once.

---

## Reference Files

Load only what the current gate requires — give a map, not an encyclopedia.

| Reference | When to Load |
|-----------|-------------|
| [references/five-subsystems.md](references/five-subsystems.md) | Auditing or explaining the complete harness model |
| [references/diagnostic-loop.md](references/diagnostic-loop.md) | Something failed — root-cause analysis across five layers |
| [references/minimal-pack.md](references/minimal-pack.md) | Creating harness files — templates (includes the kanban feature schema) |
| [references/session-lifecycle.md](references/session-lifecycle.md) | Clock-in/clock-out routines |
| [references/verification-pipeline.md](references/verification-pipeline.md) | Designing the layered verification pipeline |
| [references/scope-control.md](references/scope-control.md) | WIP=1, definition of done, placeholder ban |

---

## The Diagnostic Loop (when something fails)

**Invoke `harness-engineering-diagnose`.** Never respond to a failure with "the model isn't good enough."

| Layer | Question | Example | Harness Fix |
|-------|----------|---------|-------------|
| **Instructions** | Task unclear? | "Built X but spec said Y" | Clarify AGENTS.md, add explicit rules |
| **Environment** | Env issue? | "Module not found" | Fix init.sh, add dependency |
| **State** | State lost between sessions? | "Re-implemented existing feature" | Update progress.md / feature_list.json, read on clock-in |
| **Scope** | Agent overreached? | "Fixed the bug + refactored 3 files" | Tighten definition of done, WIP=1 |
| **Verification** | No verification method? | "Looks right" (but isn't) | Add explicit verification commands, run them |

Loop: Execute → Attribute → Fix the layer → Retry → never fail the same way twice.

---

## Sub-skills and agents at a glance

| Component | Role |
|-----------|------|
| `harness-engineering-grill` | GATE 1 — requirements discovery, write spec, human approval |
| `harness-engineering-bootstrap` | GATE 0 — create the four harness files |
| `harness-engineering-session` | GATE 3 / 13 — clock-in / clock-out |
| `harness-engineering-feature` | GATE 4 — WIP=1, kanban tickets, definition of done |
| `harness-engineering-verify` | GATE 8 / 10 — layered verification, evidence before claims |
| `harness-engineering-review` | GATE 11 — independent review (separate doer from checker) |
| `harness-engineering-diagnose` | GATE 9 / failures — attribute to one of five layers |
| `explorer` (sonnet) | GATE 5a — read-only recon; builds the Type Inventory for the planner |
| `planner` (opus) | GATE 5b — blueprint; emits the persisted tasks[] |
| `code-architect` (opus) | GATE 6 — design review; runs code-quality-audit |
| `generator` (sonnet) | GATE 7 — writes the feature + unit tests under code-quality + TDD |
| `e2e-engineer` (opus) | GATE 7b — authors the user-flow E2E (Playwright) via `e2e-authoring`; re-runs after every fix |
| `executor` (sonnet) | GATE 8 — runs verification (full suite + mandatory E2E), collects evidence |
| `healer` (opus) | GATE 9 — diagnoses failure, prescribes fix + failing-first regression test |
| `reviewer` (opus) | GATE 11a — independent quality review; runs code-quality-review |
| `correctness-reviewer` (opus) | GATE 11b — adversarial behavior review; runs code-correctness-review; proves each AC with a test |
| `security-reviewer` (opus) | GATE 11c — security review when triggered; runs security-review |
| `scribe` (sonnet) | GATE 5c/7/8/12 — single writer of feature_list.json + progress.md |
| `cartographer` (opus) | GATE 12b — single writer of CODEBASE_MAP.md; re-maps architecture + code flows (function chains with inputs/outputs) after every finished feature |

---

## Hard Constraints (non-negotiable)

1. **Run the Gate Sequence** — every request flows through the gates in order; no gate skipped silently.
2. **Spec before build** — a build request with no approved spec goes through grill first (GATE 1).
3. **Keep the ledger** — maintain a live phase ledger (GATE 2); persist the plan into `tasks[]` (GATE 5).
4. **Proof of invocation** — every agent emits its required-skill proof line, or its handoff is rejected.
5. **Evidence before claims** — never say "done"/"passing" without fresh verification output.
6. **WIP = 1** — exactly one feature `in_progress`. No exceptions without explicit user approval.
7. **No placeholders** — `pass`, `TODO`, `NotImplementedError` are forbidden in committed code.
8. **Separate doer from checker** — at GATE 11 an independent **review cluster** (none wrote the code) audits non-trivial work on three axes: `reviewer` (quality/structure), `correctness-reviewer` (behavior — traces the flow, proves each AC with a test), and `security-reviewer` (when triggered). A clean structure audit does not imply correct behavior; the doer is never the sole judge.
12. **Verify behavior, not just structure** — every user-facing feature ships with an **E2E test of its real workflow** (authored by the dedicated `e2e-engineer` at GATE 7b, plus the generator's unit tests), the completion run is the **full** suite (no fail-fast) so regressions surface, the E2E is **re-authored and re-run after every fix**, and every bug fix adds a **failing-first regression test**. "Tests pass" is meaningless if the tests prove nothing.
9. **Single writer of state** — only the `scribe` writes `feature_list.json` and `progress.md`; every other agent sends it a Board Update. One writer = no drift.
10. **Repo is the system of record** — if it's not in the repo (feature_list.json, progress.md, specs/), it doesn't exist.
11. **Leave a clean state** — every session ends restartable from `./init.sh`.

## Further Reading

- [Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — full 12-lecture course
- [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering)
- OpenAI: "Harness Engineering — Leveraging Codex in an Agent-First World"
- Anthropic: "Effective Harnesses for Long-Running Agents"
