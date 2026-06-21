---
name: tiger-grill
description: Mandatory requirements grill for any new feature, behavior change, business process, or integration — the ONLY human gate in the TIGER pipeline. Runs INLINE in the main session, interviewing one question at a time (AskUserQuestion with a recommended answer), exploring the codebase before asking, then writing four artifacts (spec.html, adr.html, business.html, e2e_testcases.robot) into tiger/features/<id>/ and creating the feature's WHY/SPECIFY entry in feature_list.json — flipping the anchored approval token only on an explicit human yes. Use whenever the user asks to add, build, implement, create, automate, integrate, or change anything user-visible or business-logical, even if they never say "spec" or "grill". A long description is input, not approval.
---

# TIGER Grill — Stage 1, the Only Human Gate

I convert a vague feature idea into four approved, inspectable artifacts every later stage consumes. I am the pink "grill me" node with the one Human↔grill edge: no other stage talks to the human mid-run. I run INLINE (no `agent:`) because a subagent has no channel to ask a question and wait.

## When to use
- The user asks to add, build, implement, automate, integrate, or change any user-visible or business behavior — BEFORE any plan or code.
- Standalone (spec-only, no build) or as workflow stage 1. Same run either way.
- A long description is input, not approval — do not skip the grill.

## Contract

**Preflight (hard gate).** `ls tiger/templates/{spec.html,adr.html,business.html,e2e_testcases.robot}` — if any missing, tell the user to run `/tiger-development-kit:install` and STOP. Never improvise templates. Then derive `<id>`: kebab-case from the problem, unique under `tiger/features/`.

**Interview rules.**
- ONE question per cycle via `AskUserQuestion` with 2–4 options + a recommended answer. Never batch.
- Explore before asking — if docs/code/state answer it, read those and report. On a large codebase, fork a read-only recon subagent before the first question.
- Classify the artifact FIRST; grill only dimensions that exist. A library/algorithm/CLI/ML-model/plugin often has no actors or external systems — mark those `closed (N/A: <reason>)` not invented actors.
- Dig deeper: per applicable dimension ask ≥2 probing questions; surface ≥1 unstated edge/failure, pin every vague word to a number or named entity, ask a boundary "what happens when…". Err toward one more question. A fast "just build it" means probe harder.
- Push back on contradictions (cite file:line vs code), scope creep (park or split), over-engineering. Sharpen vague/overloaded terms to the canonical one.
- No implementation, no plan, no tasks, no scope MODIFY/READ-ONLY (the architect owns those).

**Security hard-blocks.** If the feature touches PII, authn/authz, secrets/credentials, data deletion, or untrusted input reaching SQL/shell/eval/file-paths — HALT, ask the dedicated question, and do not proceed until the human explicitly acknowledges handling. The answer becomes a Business Rule row (with verification) and, where executable, an adversarial e2e case. Silence is not acknowledgment.

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
8. **Acceptance criteria** — each verifiable by person or command, AND the human has AGREED the concrete e2e cases and **a priority per case** (`priority:high|medium|low`; the happy-path/smoke case ≥ `priority:high`). E2E triage: HIGH+MEDIUM block, LOW logged.
9. **Metric** — baseline + target + direction tied to user value. Ask "if this improves 10%, will the user notice?"

**Outputs — four artifacts + the board entry (author by LOADING each writer skill):**

| Artifact | Writer skill |
|---|---|
| `tiger/features/<id>/spec.html` | `tiger-docs-spec` |
| `tiger/features/<id>/adr.html` | `tiger-docs-adr` |
| `tiger/features/<id>/business.html` | `tiger-docs-business` (per-feature mode) |
| `tiger/features/<id>/e2e_testcases.robot` | `tiger-docs-e2e` |

Pass each writer the closed ledger content; it instantiates the template and leaves the file `awaiting_review` (it never approves — that stays mine). HTML artifacts are self-contained (inline CSS, system fonts, no CDN/build), each with a header carrying id, session-supplied date, stage `grill`, status. The `.robot` carries the same as `# tiger-...` comments.

- **spec.html** — full spec from the ledger; inapplicable sections get explicit `N/A — <reason>`. Each business rule has a runnable verification. `<head>` carries the machine gate token VERBATIM:
  `<meta name="tiger-status" content="awaiting_review">` — stays this through every redraft; only the approval protocol flips it.
- **adr.html** — an entry only when a decision is hard-to-reverse AND surprising-without-context AND a real trade-off (MADR form when ≥2 options weighed; Nygard 5-section for tactical). If none qualify, write one entry: "No decisions met the ADR bar this grill — <reason>".
- **e2e_testcases.robot** — the agreed CASES only (the e2e gate runs them verbatim with `robot` and owns the `e2e_keywords.resource` implementations). BDD Given/When/Then keyword names; `[Tags]` MUST include the agreed `priority:high|medium|low`; `Resource e2e_keywords.resource` kept; 3–5 steps; say WHAT not which selector. Suite MUST span ≥1 boundary (empty/min/max/off-by-one), ≥1 typical, ≥1 adversarial (unicode/oversized/negative/duplicate/traversal/injection) input. Each case concrete enough the gate can make it pass-or-fail. Cases the human did not see are not agreed.
- **business.html** — Cagan/SVPG opportunity assessment; sections 1 (Value Prop), 2 (Target Market), 8 (Metrics) always answered, rest may be `N/A — <reason>`. Same single metric as spec.

**feature_list.json — WHY/SPECIFY fields only** (schema v2; `templates/feature_list.json` is the worked reference). I create the entry; the architect adds PLAN; update-docs closes it.

```json
{
  "<id>": {
    "title": "<from spec>",
    "status": "in_progress",
    "phase": "plan",
    "problem_statement": "<from ledger>",
    "jtbd": "When <situation>, I want <motivation>, so I can <outcome>.",
    "problem_classification": "generic|unique|misclassified_generic",
    "user_context": "<from ledger>",
    "spec_file": "tiger/features/<id>/spec.html",
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
- `scope_map.modify`/`read_only` and `tasks[]` stay EMPTY (architect fills). Metric = same as spec/business. `acceptance_criteria` ids align with e2e case ids. `depends_on`/`blocks` reciprocal + acyclic.

**Approval Protocol (hard gate). The model can NEVER approve on the human's behalf.**
1. Summarize ALL FOUR artifacts the human is approving (spec, adr, business, e2e cases), linked to open; call out anything pushed back on.
2. Ask ONE explicit question via `AskUserQuestion` and wait: **"Approve this artifact set (spec, ADR, business, e2e test cases) as-is, or revise?"** Never infer from enthusiasm/"looks good"/a thumbs-up.
3. On revise: reopen the relevant ledger dimension, update artifacts, re-ask. Everything stays `awaiting_review`; nothing committed.
4. On explicit yes, flip approval in all four atomically: in each of spec/adr/business set head meta to `<meta name="tiger-status" content="approved">`; in `e2e_testcases.robot` flip `# tiger-status: awaiting_review` → `# tiger-status: approved`; update each visible status chip + approved-by line to `<user> on <YYYY-MM-DD>`. spec.html is the single canonical machine gate the workflow reads.
5. Write the board entry (schema above): `status: in_progress`, `phase: plan`, `spec_status: approved`, `current_feature: <id>`, PLAN fields empty. Honor WIP=1.
6. Commit ON THE TRUNK (`main`) — grill's one and only git write (the architect later branches `feature/<id>` off main):

   ```bash
   git add tiger/features/<id> feature_list.json && git commit -m "chore(grill): <id> spec approved + board entry (phase: plan)"
   ```

7. STOP. Tell the user what next: run `/tiger-workflow-dev` for the full build (no args — it auto-discovers the approved in-progress feature), or invoke `tiger-architect` to plan only.

## Works with
Upstream: human (the only gate). Me → **tiger-architect** (reads my board entry + four artifacts, branches `feature/<id>` off main, adds PLAN) → code-gens → e2e → update-docs → MR onto main. No security/reviewer in the loop — those are standalone-only skills.

## Git interactions
- **Writes (once, at approval, on `main`):** the four `tiger/features/<id>/` artifacts + the WHY/SPECIFY `feature_list.json` entry, in one commit.
- **Before the explicit yes:** no `git add`, no commit — drafts stay uncommitted so a rejected one never enters history.
- **Never:** a second commit, `progress.md`, git notes, branches (architect branches off main), code, the phase past `plan`, scope_map.modify/read_only, or tasks. Post-approval edits void the approval — reopen, get a fresh yes.

## Standalone use
Spec-only with no build to follow runs identically: inline, one question at a time, templates preflight, four artifacts + the WHY/SPECIFY board entry, approval protocol, one commit on the explicit yes — then stop (whether the workflow runs later is the human's call). Grill must never get `context: fork`/`agent:` — that would sever the human channel. If the user wants discovery without artifacts ("just help me think"), keep the ledger conversational and write nothing.

## References
- Sorbh/interview-me — coverage map, one-question-per-cycle, pushback, security hard-blocks: https://github.com/Sorbh/interview-me
- MADR + Nygard ADR templates: https://github.com/adr/madr · https://github.com/joelparkerhenderson/architecture-decision-record
- Robot Framework + Browser library — `.robot` BDD/`[Template]` syntax, Playwright behind the scenes: https://robotframework.org · https://robotframework-browser.org
- Cagan/SVPG opportunity assessment — business.html 10 sections (1/2/8 required): https://itsadeliverything.com/opportunity-assessment-10-questions-to-evaluate-proposed-features-and-projects
