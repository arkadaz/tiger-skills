---
name: tiger-grill
description: Mandatory requirements grill for any new feature, behavior change, business process, or integration — the ONLY human gate in the Tiger pipeline. Runs INLINE in the main session, interviewing one question at a time (AskUserQuestion with a recommended answer), exploring the codebase before asking, then writing two artifacts (feature.md, e2e_testcases.robot) into tiger/features/<id>/, creating the feature's WHY/SPECIFY entry in feature_list.json, cutting feature/<id> from dev — and flipping the `tiger-status: approved` frontmatter token only on an explicit human yes. Use whenever the user asks to add, build, implement, create, automate, integrate, or change anything user-visible or business-logical, even if they never say "spec" or "grill". A long description is input, not approval.
---

# Tiger Grill — Stage 1, the Only Human Gate

I convert a vague feature idea into two approved, inspectable artifacts every later stage consumes. I am the pink "grill me" node with the one Human↔grill edge: no other stage talks to the human mid-run. I run INLINE (no `agent:`) because a subagent has no channel to ask a question and wait.

## When to use
- The user asks to add, build, implement, automate, integrate, or change any user-visible or business behavior — BEFORE any plan or code.
- Standalone (spec-only, no build) or as workflow stage 1. Same run either way.
- A long description is input, not approval — do not skip the grill.

## Contract

**Preflight (hard gate).** `ls tiger/templates/{feature.md,e2e_testcases.robot,e2e_keywords.resource}` — if any missing, tell the user to run `/tiger-skills:install` and STOP. Never improvise templates. Then derive `<id>`: kebab-case from the problem, unique under `tiger/features/`.

**Interview rules.**
- ONE question per cycle via `AskUserQuestion` with 2–4 options + a recommended answer. Never batch.
- Explore before asking — if docs/code/state answer it, read those and report. On a large codebase, fork a read-only recon subagent before the first question.
- Classify the artifact FIRST; grill only dimensions that exist. A library/algorithm/CLI/ML-model/plugin often has no actors or external systems — mark those `closed (N/A: <reason>)` not invented actors.
- Dig deeper: per applicable dimension ask ≥2 probing questions; surface ≥1 unstated edge/failure, pin every vague word to a number or named entity, ask a boundary "what happens when…". Err toward one more question. A fast "just build it" means probe harder.
- Push back on contradictions (cite file:line vs code), scope creep (park or split), over-engineering. Sharpen vague/overloaded terms to the canonical one.
- No implementation, no plan, no tasks, no scope MODIFY/READ-ONLY (the architect owns those).

**Security hard-blocks.** If the feature touches PII, authn/authz, secrets/credentials, data deletion, or untrusted input reaching SQL/shell/eval/file-paths — HALT, ask the dedicated question, and do not proceed until the human explicitly acknowledges handling. The answer becomes a business rule with a runnable check in `feature.md` and, where executable, an adversarial e2e case. Silence is not acknowledgment.

**Grill Ledger.** Reprint updated before every question; `closed` = exit condition met AND the deeper-probe bar satisfied (a single shallow answer stays `open`). All nine genuinely closed → draft. >~8 separate major areas → propose splitting into features.

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
4. **Business rules** — executable, contradictions resolved: calcs, thresholds/rounding, state transitions, exceptions, conflict resolution, idempotency.
5. **Data/integrations** *(N/A no external systems/persistence)* — every input, output, owner, retention, integration contract, failure behavior known.
6. **Errors/edge cases** — each happy step has a failure response: empty, invalid, denied, partial failure, concurrency, retries, limits, stale data.
7. **Constraints/non-goals** — mutable vs read-only surface, must-not-break, off-limits files, perf/security constraints, explicit out-of-scope.
8. **Acceptance criteria** — each verifiable by person or command, AND the human has AGREED a BROAD set of concrete e2e cases (several boundary/typical/adversarial; ≥1 per AC and per business rule) with **one priority per case** (`priority:high|medium|low`; the happy-path/smoke case ≥ `priority:high`). Triage: HIGH+MEDIUM block, LOW logged.
9. **Metric** — baseline + target + direction tied to user value. Ask "if this improves 10%, will the user notice?"

**Outputs — two artifacts + the board entry (author by LOADING each writer skill):**

| Artifact | Writer skill |
|---|---|
| `tiger/features/<id>/feature.md` | `tiger-docs-feature` |
| `tiger/features/<id>/e2e_testcases.robot` | `tiger-docs-e2e` |

Pass each writer the closed ledger content; it instantiates the template and leaves the file `awaiting_review` (it never approves — that stays mine).

- **feature.md** — the MERGED markdown doc (spec + adr + business in one file). Frontmatter (`id`, `title`, `tiger-status: awaiting_review`, `date`, `classification`, `metric`) + compact sections: Problem & JTBD / What we'll do (FRs + happy path + business rules, each rule with a runnable check in backticks) / Why · Decisions (only real hard-to-reverse trade-offs, else `none met the bar`) / Business context (value + target users + the one metric + a **Code glossary** of magic values) / Acceptance criteria (ids align to e2e case ids) / Out of scope · CAN-CANNOT. The frontmatter `tiger-status` line is the machine gate; it stays `awaiting_review` through every redraft — only the approval protocol flips it.
- **e2e_testcases.robot** — the agreed CASES only, a BROAD suite (see `tiger-docs-e2e`): several boundary, several typical, several adversarial cases; ≥1 case per acceptance criterion and per business rule. BDD Given/When/Then keyword names; `[Tags]` MUST carry exactly one `priority:high|medium|low`; `Resource e2e_keywords.resource` kept. `*** Settings ***` carries `Metadata    tiger-status    awaiting_review` and `Metadata    tiger-feature-id    <id>` — NOT `#` comments. Cases the human did not see are not agreed. The e2e gate runs them verbatim and owns `e2e_keywords.resource`; it MAY append its own cases tagged `source:e2e` but NEVER edits yours.

**feature_list.json — WHY/SPECIFY fields only** (schema v2; `templates/feature_list.json` is the worked reference). I create the entry; the architect adds PLAN; update-docs closes it.

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
      { "id": "AC1", "criterion": "<from ledger>", "verification": "<agreed e2e Run Command, or empty for the architect to wire + prove RED>", "status": "not_started", "evidence": [] }
    ],
    "tasks": [],
    "validation": { "user_acceptance": "pending", "business_metric": "pending" },
    "learning": { "technical": [], "product": [], "process": [], "harness_updates": [] }
  }
}
```

- **WIP=1 guard.** If a *different* feature is `in_progress`, STOP — human finishes/parks it first.
- Merge into `features` without disturbing others; set `current_feature: <id>`.
- `scope_map.modify`/`read_only` and `tasks[]` stay EMPTY (architect fills). Metric = same as `feature.md`. `acceptance_criteria` ids align with e2e case ids. `depends_on`/`blocks` reciprocal + acyclic.

**Approval Protocol (hard gate). The model can NEVER approve on the human's behalf.**
1. Summarize BOTH artifacts the human is approving (feature.md, e2e cases), linked to open ledger items; call out anything pushed back on.
2. Ask ONE explicit question via `AskUserQuestion` and wait: **"Approve this feature.md + e2e test cases as-is, or revise?"** Never infer from enthusiasm/"looks good"/a thumbs-up.
3. On revise: reopen the relevant ledger dimension, update artifacts, re-ask. Everything stays `awaiting_review`; nothing committed.
4. On explicit yes, flip approval in both atomically:
   - in `feature.md` frontmatter: `tiger-status: awaiting_review` → `tiger-status: approved` — this line is the ONLY build gate the workflow reads.
   - in `e2e_testcases.robot`: `Metadata    tiger-status    awaiting_review` → `Metadata    tiger-status    approved`.
   - update each visible approved-by line/date to `<user> on <YYYY-MM-DD>`.
5. Write the board entry (schema above): `status: in_progress`, `phase: plan`, `spec_status: approved`, `current_feature: <id>`, PLAN fields empty. Honor WIP=1.
6. Cut (or check out) the feature branch FROM `dev` and commit THERE — grill's one and only git write (never on `main`, never on `dev`):

   ```bash
   git checkout -b feature/<id> dev 2>/dev/null || git checkout feature/<id>
   git add tiger/features/<id> feature_list.json
   git commit -m "chore(grill): <id> feature.md approved + board entry (phase: plan)"
   ```

7. STOP. Tell the user what next: run `/tiger-workflow-dev` for the full build (no args — it auto-discovers the approved in-progress feature), or invoke `tiger-architect` to plan only.

## Works with
Upstream: human (the only gate). Me → **tiger-architect** (reads my board entry + feature.md + e2e cases on `feature/<id>`, base `dev`, adds PLAN) → code-gens → e2e → update-docs → **merge to dev**. dev → main is a manual human step the kit never performs. No security/reviewer in the loop — those are standalone-only skills.

## Git interactions
- **Writes (once, at approval, on `feature/<id>` cut from `dev`):** the two `tiger/features/<id>/` artifacts + the WHY/SPECIFY `feature_list.json` entry, in one commit.
- **Before the explicit yes:** no branch, no `git add`, no commit — drafts stay uncommitted so a rejected one never enters history.
- **Never:** a commit on `main` or `dev`, a second commit, `progress.md`, git notes, code, the phase past `plan`, scope_map.modify/read_only, or tasks. Post-approval edits void the approval — reopen, get a fresh yes.

## Standalone use
Spec-only with no build to follow runs identically: inline, one question at a time, templates preflight, two artifacts + the WHY/SPECIFY board entry, approval protocol, one commit on the explicit yes on `feature/<id>` cut from `dev` — then stop (whether the workflow runs later is the human's call). Grill must never get `context: fork`/`agent:` — that would sever the human channel. If the user wants discovery without artifacts ("just help me think"), keep the ledger conversational and write nothing.
