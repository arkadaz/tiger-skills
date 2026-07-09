---
name: tiger-grill
description: Mandatory requirements grill for any new feature, behavior change, business process, or integration — the ONLY human gate in the Tiger pipeline. Runs INLINE in the main session, interviewing one question at a time (AskUserQuestion with a recommended answer) and digging until every requirement is spec-grade concrete, exploring the codebase before asking, then writing two artifacts into tiger/features/<id>/ — spec.md (the DETAILED agent-facing requirements: exact FRs, business rules with real values, error tables, worked examples, testable acceptance criteria) and feature.md (the short human-readable summary carrying the approval token) — creating the feature's WHY/SPECIFY entry in feature_list.json, cutting feature/<id> from dev, and flipping the `tiger-status: approved` frontmatter token only on an explicit human yes. The e2e suite is NOT written here — the lead derives it from spec.md. Use whenever the user asks to add, build, implement, create, automate, integrate, or change anything user-visible or business-logical, even if they never say "spec" or "grill". A long description is input, not approval.
---

# Tiger Grill — Stage 1, the Only Human Gate

I convert a vague feature idea into two approved, inspectable artifacts every later stage consumes: a **detailed `spec.md`** (for the agents) and a **short `feature.md`** (for the human, carrying the gate token). I am the pink "grill me" node with the one Human↔grill edge: no other stage talks to the human mid-run. I run INLINE (no `agent:`) because a subagent has no channel to ask a question and wait.

## When to use
- The user asks to add, build, implement, automate, integrate, or change any user-visible or business behavior — BEFORE any plan or code.
- Standalone (spec-only, no build) or as workflow stage 1. Same run either way.
- A long description is input, not approval — do not skip the grill.

## Contract

**Preflight (hard gate).** `ls tiger/templates/{feature.md,spec.md}` — if missing, tell the user to run `/tiger-skills:install` and STOP. Never improvise templates. Then derive `<id>`: kebab-case from the problem, unique under `tiger/features/`.

**Interview rules — ask a LOT; the spec is only as good as the interview.**
- ONE question per cycle via `AskUserQuestion` with 2–4 options + a recommended answer. Never batch.
- Explore before asking — if docs/code/state answer it, read those and report. On a large codebase, fork a read-only recon subagent before the first question.
- Classify the artifact FIRST; grill only dimensions that exist. A library/algorithm/CLI/ML-model/plugin often has no actors or external systems — mark those `closed (N/A: <reason>)` not invented actors.
- **Spec-grade bar per dimension:** a dimension closes only when its answers are concrete enough to go straight into `spec.md` — every vague word pinned to a number or named entity, every rule an exact formula/threshold/rounding, every error a stated exact behavior, ≥1 worked input→output example per FR. Ask ≥2–3 probing questions per applicable dimension; surface ≥1 unstated edge/failure; ask a boundary "what happens when…". Err toward MORE questions — a shallow interview produces a thin spec, and a thin spec is why builds come out wrong. A fast "just build it" means probe harder.
- Push back on contradictions (cite file:line vs code), scope creep (park or split), over-engineering. Sharpen vague/overloaded terms to the canonical one.
- No implementation, no plan, no tasks, no scope MODIFY/READ-ONLY, no e2e cases (the lead owns all of those).

**Security hard-blocks.** If the feature touches PII, authn/authz, secrets/credentials, data deletion, or untrusted input reaching SQL/shell/eval/file-paths — HALT, ask the dedicated question, and do not proceed until the human explicitly acknowledges handling. The answer becomes a business rule with a runnable check in `spec.md` and an adversarial acceptance criterion the lead turns into an e2e case. Silence is not acknowledgment.

**Grill Ledger.** Reprint updated before every question; `closed` = exit condition met AND the spec-grade bar satisfied (a single shallow answer stays `open`). All nine genuinely closed → draft. >~8 separate major areas → propose splitting into features.

```markdown
## Grill Ledger — <id>
- Problem/JTBD: open|closed
- Users and roles: open|closed
- Happy path: open|closed
- Business rules: open|closed
- Data and integrations: open|closed
- Errors and edge cases: open|closed
- Constraints and non-goals: open|closed
- Acceptance criteria: open|closed
- Metric and evidence: open|closed
```

**9 discovery dimensions (exit conditions).**
1. **Problem/JTBD** — can state `<role> needs <capability> so that <outcome>`; real user, pain, trigger, why now.
2. **Users/roles/permissions** *(N/A single-actor)* — every actor + permission boundary explicit, or `N/A: single caller`. Systems and cron jobs are actors.
3. **Happy path** — concrete sequence of user action ↔ system response; "fast"=a number, "dashboard"=fields, "notify"=channel/recipient/timing.
4. **Business rules** — executable, contradictions resolved: calcs, thresholds/rounding, state transitions, exceptions, conflict resolution, idempotency — each with the EXACT values.
5. **Data/integrations** *(N/A no external systems/persistence)* — every input, output, owner, retention, integration contract, failure behavior known.
6. **Errors/edge cases** — each happy step has a stated failure response: empty, invalid, denied, partial failure, concurrency, retries, limits, stale data — exact message/exit per condition.
7. **Constraints/non-goals** — mutable vs read-only surface, must-not-break, off-limits files, perf/security constraints, explicit out-of-scope.
8. **Acceptance criteria** — each a TESTABLE Given/When/Then with concrete data, verifiable by person or command; ≥1 per FR and per business rule; adversarial ACs for any untrusted input. (These are what the lead derives the broad e2e suite from — no separate case sign-off happens here.)
9. **Metric** — baseline + target + direction tied to user value. Ask "if this improves 10%, will the user notice?"

**Outputs — two artifacts + the board entry (author by LOADING the `tiger-docs` writer skill):**

| Artifact | Audience | What it holds |
|---|---|---|
| `tiger/features/<id>/spec.md` | agents (lead + coders) | the FULL detail: FRs with worked examples, business rules with exact values, data/integration contracts, an errors-and-edge-cases table, permissions, constraints, testable ACs, out-of-scope |
| `tiger/features/<id>/feature.md` | human | one-page summary: problem/JTBD, what we'll do, decisions, business context + metric + code glossary, AC summary — plus the frontmatter `tiger-status` gate token and `spec:` pointer |

The writer instantiates `tiger/templates/spec.md` + `tiger/templates/feature.md` from the closed ledger and leaves `feature.md` at `tiger-status: awaiting_review` (it never approves — that stays mine). Everything in `feature.md` must be consistent with `spec.md`; `spec.md` is the source of truth for behavior, `feature.md` for approval. **No e2e files** — the lead authors `e2e_testcases.robot` from `spec.md` at plan time, covering all the cases it judges can happen.

**feature_list.json — WHY/SPECIFY fields only** (schema v2; `templates/feature_list.json` is the worked reference). I create the entry; the lead adds PLAN; update-docs closes it.

**Board access via `tiger/board.py` — never dump or hand-rewrite the JSON.** Always read the current board first (`python3 tiger/board.py summary`; `in-progress` for the WIP=1 guard), then create my entry with `add-feature <id> --title … --start` and flip the gate with `approve <id>`. Touch ONLY my WHY/SPECIFY fields through these patch commands; each one preserves every other field and fails closed on a broken invariant.

```json
{
  "<id>": {
    "title": "<from feature.md>",
    "status": "in_progress",
    "phase": "plan",
    "problem_statement": "<from ledger>",
    "jtbd": "When <situation>, I want <motivation>, so I can <outcome>.",
    "problem_classification": "generic|unique|misclassified_generic",
    "user_context": "<from ledger>",
    "spec_file": "tiger/features/<id>/feature.md",
    "spec_status": "approved",
    "approval": { "approved_by": "<user>", "date": "<YYYY-MM-DD>" },
    "depends_on": [], "blocks": [],
    "scope_map": { "modify": [], "read_only": [], "metric": { "name": "<metric>", "baseline": "<v>", "target": "<v>", "direction": "increase|decrease|binary" } },
    "acceptance_criteria": [
      { "id": "AC1", "criterion": "<from spec.md>", "verification": "<empty — the lead wires a RED-proven check>", "status": "not_started", "evidence": [] }
    ],
    "tasks": [],
    "validation": { "user_acceptance": "pending", "business_metric": "pending" },
    "learning": { "technical": [], "product": [], "process": [], "harness_updates": [] }
  }
}
```

- **WIP=1 guard.** If a *different* feature is `in_progress`, STOP — human finishes/parks it first.
- Merge into `features` without disturbing others; set `current_feature: <id>`.
- `spec_file` stays `feature.md` (the gate doc); `spec.md` is its frontmatter-linked sibling. `scope_map.modify`/`read_only` and `tasks[]` stay EMPTY (lead fills). Metric = same as `feature.md`. `acceptance_criteria` ids align with `spec.md` AC ids. `depends_on`/`blocks` reciprocal + acyclic.

**Approval Protocol (hard gate). The model can NEVER approve on the human's behalf.**
1. Summarize BOTH artifacts the human is approving (`feature.md` for the shape, the load-bearing details of `spec.md` — rules, error behaviors, ACs), linked to open ledger items; call out anything pushed back on.
2. Ask ONE explicit question via `AskUserQuestion` and wait: **"Approve this feature.md + spec.md as-is, or revise?"** Never infer from enthusiasm/"looks good"/a thumbs-up.
3. On revise: reopen the relevant ledger dimension, update BOTH artifacts consistently, re-ask. Everything stays `awaiting_review`; nothing committed.
4. On explicit yes, flip in `feature.md` frontmatter: `tiger-status: awaiting_review` → `tiger-status: approved` — this line is the ONLY build gate the workflow reads. Update the visible approved-by line/date to `<user> on <YYYY-MM-DD>`.
5. Write the board entry (schema above): `status: in_progress`, `phase: plan`, `spec_status: approved`, `current_feature: <id>`, PLAN fields empty. Honor WIP=1.
6. Cut (or check out) the feature branch FROM `dev` and commit THERE — grill's one and only git write (never on `main`, never on `dev`):

   ```bash
   git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>
   git add tiger/features/<id> feature_list.json
   git commit -m "chore(grill): <id> spec.md + feature.md approved + board entry (phase: plan)"
   ```

7. STOP. Tell the user what next: run `/tiger-workflow-dev` for the full build (no args — it auto-discovers the approved in-progress feature), or invoke `tiger-lead` to plan + build.

## Works with
Upstream: human (the only gate). Me → **tiger-lead** (plans from `spec.md`, authors the e2e suite, verifies) → update-docs → **merge to dev**. dev → main is a manual human step the kit never performs. `tiger-review` (the standalone quality+security gate) is never in the loop.

## Git interactions
- **Writes (once, at approval, on `feature/<id>` cut from `dev`):** the two `tiger/features/<id>/` artifacts + the WHY/SPECIFY `feature_list.json` entry, in one commit.
- **Before the explicit yes:** no branch, no `git add`, no commit — drafts stay uncommitted so a rejected one never enters history.
- **Never:** a commit on `main` or `dev`, a second commit, `progress.md`, git notes, code, e2e files, the phase past `plan`, scope_map.modify/read_only, or tasks. Post-approval edits void the approval — reopen, get a fresh yes.

## Standalone use
Spec-only with no build to follow runs identically: inline, one question at a time, templates preflight, two artifacts + the WHY/SPECIFY board entry, approval protocol, one commit on the explicit yes on `feature/<id>` cut from `dev` — then stop (whether the workflow runs later is the human's call). Grill must never get `context: fork`/`agent:` — that would sever the human channel. If the user wants discovery without artifacts ("just help me think"), keep the ledger conversational and write nothing.
