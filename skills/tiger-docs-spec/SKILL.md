---
name: tiger-docs-spec
description: Focused writer that authors ONE feature's spec.html from a closed grill ledger — problem statement, objective/JTBD, user context, functional requirements, happy path, business rules (each with a runnable verification), errors/edge cases, CAN/CANNOT constraints, acceptance criteria, metric, out-of-scope — instantiating tiger/templates/spec.html into tiger/features/<id>/spec.html with the anchored <meta name="tiger-status" content="awaiting_review"> token. NEVER flips the approval token — only the human, via grill, may approve. A self-contained reference skill; invoke it directly or load it as one of grill's skills to write the spec.
---

# TIGER Docs — Spec Writer

Writes exactly one artifact: `tiger/features/<id>/spec.html`. Sits inside the grill phase — grill loads this skill to author the spec from its closed ledger, keeping requirement capture and document authoring separate.

## When to use

- Grill loads it automatically to produce `spec.html` from the closed ledger.
- Standalone: draft or refresh a spec from notes/requirements without a full grill session.

## Contract

**Inputs:** project dir, feature id, closed ledger content (problem, JTBD, users, happy path, business rules, data, errors, constraints, acceptance criteria, metric), today `YYYY-MM-DD`.

**Sections** (instantiate `tiger/templates/spec.html`; every section required, `N/A — <reason>` if inapplicable):

| Section | Notes |
|---|---|
| Problem statement | verbatim from ledger |
| Objective / JTBD | |
| User context | |
| Functional requirements | |
| Happy path | |
| Business rules | each with a runnable verification command |
| Errors & edge cases | |
| CAN / CANNOT constraints | |
| Acceptance criteria | ids aligned with e2e case ids where they overlap |
| Success metric | one per feature; same value as `business.html` and the board |
| Out of scope | |

**Gate token** — `<head>` MUST contain exactly:
```
<meta name="tiger-status" content="awaiting_review">
```
Never write `approved` — that is the human's act through grill.

**Style:** self-contained single HTML file, inline CSS, system fonts, zero external requests (`docs/tiger-doc-style.md`).

**Never:** flip the approval token, touch `feature_list.json`, write code, or write git notes.

## Works with

grill (loads this skill) → **spec.html produced here** → human approval via grill → architect

## Git interactions

- **Under grill:** write the file only; grill owns the single atomic commit on approval — a rejected draft never enters history.
- **Standalone:** `git add tiger/features/<id>/spec.html && git commit -m "docs(<id>): spec draft"` — nothing else.

## Standalone use

Invoke directly: "write the spec for `<id>` from these requirements". Provide project dir, feature id, requirement content, and today's date. Writes `spec.html` with `awaiting_review` token and stops — reports the path written.
