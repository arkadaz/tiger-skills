---
name: tiger-docs
description: The ONE doc-writer reference for every Tiger artifact — merges the former six tiger-docs-* writers. Defines how to author a feature's spec.md (detailed agent-facing requirements) + feature.md (human summary with the tiger-status token; grill loads this), the lead-authored broad e2e_testcases.robot suite (boundary/typical/adversarial/error cases, one priority tag each; tiger-lead loads this), and the global docs tiger/CODEBASE_MAP.md, tiger/business.md, tiger/release_docs.md, and the project README.md (tiger-update-docs loads this). One writer per artifact, ownership rules per section; no owned agent. Invoke directly ("refresh the codemap", "write the release notes", "draft the spec") or load as a skill from grill/lead/update-docs.
---

# Tiger Docs — every artifact's writing spec, one reference

One loadable reference for all Tiger-authored documents. Each section names its artifact, its OWNER (the only stage that writes it), and its rules. Loaded by: **grill** (spec.md + feature.md), **tiger-lead** (e2e suite), **tiger-update-docs** (codemap/business/release/README). Standalone: invoke to draft/refresh any one artifact — write only that artifact, report the path.

**House style for every artifact:** compact markdown (bullets/tables over prose), no HTML, no CDN; YAML frontmatter is the machine gate; inapplicable section → `N/A — <reason>`; ISO-8601 dates from a handed-in `today`, never a clock.

---

## 1. `tiger/features/<id>/spec.md` — detailed requirements (owner: grill)

The agent-facing source of truth for behavior. Instantiate `tiger/templates/spec.md` from the closed grill ledger. The test of done: **a lead + coder could build AND test the feature from this file alone, with zero follow-up questions.**

- Frontmatter: `id`, `feature:` (path to the sibling `feature.md`), `date`. NO approval token here — `feature.md` carries the gate.
- **Functional requirements** — FR1..: exact behavior, each with ≥1 worked `input → output` example using concrete data.
- **Business rules** — BR1..: exact formulas, thresholds, rounding, precedence, state transitions (legal + illegal with the exact rejection), idempotency; each with a runnable check in backticks.
- **Data & integrations** — every entity/field (type, owner, retention), every integration contract (timeout + failure behavior).
- **Errors & edge cases** — a table: condition → EXACT expected behavior/message/exit (empty, invalid, denied, partial failure, concurrency, limits).
- **Permissions & roles** — who CAN/CANNOT what, or `N/A: single caller`.
- **Non-functional constraints** — perf numbers, security rules, runtime pins.
- **Acceptance criteria** — AC1..: testable Given/When/Then with concrete data; ≥1 per FR and per BR; adversarial ACs wherever input is untrusted. The lead derives the e2e suite from these.
- **Out of scope / must not break.**
- Vague words are defects: every "fast/some/valid" pinned to a number or named entity before this file is written.

## 2. `tiger/features/<id>/feature.md` — human summary + gate (owner: grill)

One page a human reads to approve. Instantiate `tiger/templates/feature.md`. Merges problem + summary + decisions + business context.

- Frontmatter: `id`, `title`, `tiger-status: awaiting_review`, `date`, `classification`, `metric {name, baseline, target, direction}`, `spec:` (path to `spec.md`). **NEVER write `approved`** — only the human, via grill's approval protocol, flips the token.
- Sections: Problem & JTBD (1–2 lines) / What we'll do (headlines + happy path + the 2–4 rules a human must know) / Why · Decisions (only hard-to-reverse trade-offs, else `none met the bar`) / Business context (value, target users, the one metric, a **Code glossary** of magic values) / Acceptance criteria summary (ids mirror `spec.md`) / Out of scope · CAN-CANNOT.
- Must stay consistent with `spec.md`; on conflict, `spec.md` wins and BOTH get fixed before approval.

## 3. `tiger/features/<id>/e2e_testcases.robot` — the broad e2e suite (owner: tiger-lead)

Authored by the **lead** at PLAN time, derived from `spec.md` — NOT a fixed set agreed at grill. Cover everything you judge can happen; extend the suite on every verify round as new risks surface. Instantiate `tiger/templates/e2e_testcases.robot`.

| Rule | Detail |
|---|---|
| BDD style | `*** Test Cases ***` entries use Given/When/Then keyword NAMES; `Settings` keeps `Resource    e2e_keywords.resource`. |
| Broad — MANDATORY | A GENEROUS suite, not "one of each": SEVERAL boundary (empty/zero/min/max/off-by-one), SEVERAL typical, SEVERAL adversarial (unicode, oversized, negative, duplicate, traversal, injection where input is untrusted), the error paths from spec.md's table, PLUS ≥1 case per acceptance criterion and per business rule. A thin suite where every case hits the same path proves nothing — reject it. |
| Priority tag — MANDATORY | Every case carries exactly one `priority:high|medium|low` in `[Tags]`. Happy-path/smoke ≥ `high`; adversarial/security ≥ `high`; boundary/typical default `medium`; cosmetic `low`. HIGH+MEDIUM failing BLOCK the gate; LOW is logged. |
| Regression rule | The lead runs the WHOLE `tiger/features/` folder every verify. A failing case of an already-shipped feature is HIGH regardless of its tag. A shipped feature's AGREED behavior is never silently changed — a real behavior conflict is a spec conflict → `blocked`. |
| Metadata | `Metadata    tiger-feature-id    <id>` and `Metadata    tiger-stage    lead` — machine metadata, never `#` comments. |
| Data-driven outlines | Use `[Template]` + row table; one verdict per row in Robot's report. |
| Keywords | Cases reference keyword NAMES; the runnable bodies live in `e2e_keywords.resource` (also lead-owned, comment-free, real work — never `No Operation`). |

## 4. `tiger/CODEBASE_MAP.md` — structural map (owner: lead in-loop; refreshed by update-docs at close-out)

Bootstrap from `tiger/templates/CODEBASE_MAP.md` when missing. Header: `# Codebase Map — <project>   (updated: <today>, last feature: <id>)`.

| Section | Detail |
|---|---|
| `## Overview` | 2–4 lines: what the system is. |
| `## System map` | OPTIONAL fenced ```mermaid flowchart, C4-Container altitude, `subgraph` boundaries, **STABLE node ids** (churned ids = failed refresh). |
| `## Modules` | Table: Module \| Path \| Responsibility \| Key entry points (file:symbol). |
| `## How it works (per workflow)` | Short numbered walkthrough per main flow. |
| `## Business glossary / code values` | Magic values → meaning. |
| `## Recent changes` | Append one row: `<id> \| <today> \| <what moved>`. |

The lead is the map's sole READER (it distils structure into task packets; coders never read it).

## 5. `tiger/business.md` — cumulative product catalog (owner: update-docs)

Bootstrap from `tiger/templates/business.md`. A registry keyed by feature id — the one doc that knows the whole product. Source: the shipped feature's `feature.md` Business context. Per close-out: append THIS feature's entry (`<id> — <title>: <capability>` + its code glossary), fold value/users/headline rules/metric into the cumulative sections. **Append-only per feature — NEVER drop or restate a prior entry; extend, never replace.** Keep it a two-minute read.

## 6. `tiger/release_docs.md` — changelog (owner: update-docs)

Bootstrap from `tiger/templates/release_docs.md`. Keep-a-Changelog 1.1.0 discipline; one entry per feature under `[Unreleased]` (always the top block), derived from the feature's artifacts + `git log dev..HEAD` — never memory.

- TWO audience bands in order: **User-facing changes** (benefit-phrased) then **Internal changes** (technical: APIs, schemas, migrations).
- Categories per band: Added / Changed / Deprecated / Removed / Fixed / Security — omit empty; **never drop Security**.
- **Known issues:** when the lead's verify logged LOW (non-blocking) defects (`git notes --ref=e2e`), list each by case name + one line. HIGH/MEDIUM never appear — they block.

## 7. `README.md` — the project front door (owner: update-docs)

Surgical and additive, diff-grounded (`git diff dev...HEAD --stat` + touched files + the feature artifacts).

- Update ONLY sections the feature touched: overview line, feature/capability list, quickstart/usage, changed commands/flags/env/config. Preserve structure and the human's voice; never rewrite wholesale.
- Every claim grounded in the diff — usage examples must match commands that exist after this feature.
- Bootstrap a minimal README when none exists: name, one-line purpose, how to run/test, capabilities.

---

## Ownership & git (binding for every section)

- **One writer per artifact.** grill owns 1–2; the lead owns 3 (+ `e2e_keywords.resource`); update-docs owns 4–7 at close-out (the lead maintains 4 in-loop). Loaded writers do NOT commit — the loading stage owns its single commit (grill's approval commit; the lead's plan/verify commits; update-docs' one close-out commit).
- **Standalone invocation:** write + commit only the one artifact asked for (`git add <artifact> && git commit -m "docs(<id|tiger>): <what>"`). Never touch the board, approvals, code, or git notes; never flip `tiger-status`; never close the board.
- Approval tokens are the human's act through grill — a writer NEVER writes `approved`.
