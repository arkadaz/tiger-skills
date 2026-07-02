---
name: tiger-docs-feature
description: Focused writer that authors ONE feature's tiger/features/<id>/feature.md — the compact markdown doc that MERGES the old spec + adr + per-feature business one-pager into a single file with YAML frontmatter (the tiger-status approval token + the single metric) and short bullet sections (Problem & JTBD / What we'll do / Why · Decisions / Business context with a Code glossary of magic values / Acceptance criteria / Out of scope · CAN-CANNOT). Owns the frontmatter tiger-status token but NEVER flips it to approved — only the human, via grill, may approve. A self-contained reference skill; invoke it directly or load it as one of grill's skills to write the per-feature doc.
---

# Tiger Docs — Feature Doc Writer

Writes exactly one artifact: `tiger/features/<id>/feature.md` — the merged, compact per-feature markdown doc (spec + ADR + business in one file). Sits inside the grill phase: grill loads this skill to author it from the closed ledger. It is the merge of the retired `tiger-docs-spec` + `tiger-docs-adr` + the per-feature `tiger-docs-business` writers.

## When to use
- Grill loads it automatically to produce `feature.md` from the closed ledger.
- Standalone: draft or refresh a feature doc from notes/requirements.

## Contract

**Owns ONE artifact:** `tiger/features/<id>/feature.md` (and its frontmatter `tiger-status` token).
**Never owns:** approval (only the human via grill flips the token), `e2e_testcases.robot`, the board, code, git notes, the cumulative `tiger/business.md` (that is `tiger-docs-business`).

**Inputs:** project dir, feature id, closed ledger content (problem, JTBD, classification, users, FRs/happy path, business rules, decisions, value/users, metric, acceptance criteria, constraints), today `YYYY-MM-DD`.

**Shape** — instantiate `tiger/templates/feature.md`. Compact bullets, never walls of text. Every section present; inapplicable → `N/A — <reason>`.

Frontmatter (machine gate + metadata):
```
---
id: <id>
title: <title>
tiger-status: awaiting_review
date: <YYYY-MM-DD>
classification: generic|unique|misclassified_generic
metric: { name: <…>, baseline: <…>, target: <…>, direction: increase|decrease|binary }
---
```

| Section | Notes |
|---|---|
| Problem & JTBD | 1–2 lines: real user, pain, outcome |
| What we'll do | FRs + happy path + business rules; each rule carries a runnable check in backticks |
| Why / Decisions | only real hard-to-reverse trade-offs (the ADR bar: hard to reverse AND surprising AND a real trade-off); `none met the bar — <reason>` if none |
| Business context | value / target users / the one metric, plus a **Code glossary** mapping magic values to meaning (e.g. `order.status 001 = pending`, `002 = shipped`) |
| Acceptance criteria | one bullet per AC: `AC<n> — <criterion> — <runnable verification> — status: pending` (verification in backticks); ids align to e2e case ids |
| Out of scope / CAN-CANNOT | CAN: … / CANNOT: … / must-not-break: … |

**Gate token** — frontmatter MUST carry exactly `tiger-status: awaiting_review`. NEVER write `approved` — that is the human's act through grill.

**Style:** plain compact markdown, no HTML, no CDN. Metric = the single success metric (same value as the board and e2e).

## Works with
grill (loads this skill) → **feature.md produced here** → human approval via grill → lead (reads it as the PLAN input).

## Git interactions
- **Under grill:** write the file only; grill owns the single atomic commit on `feature/<id>`. Do not commit.
- **Standalone:** `git add tiger/features/<id>/feature.md && git commit -m "docs(<id>): feature doc"` — nothing else. Never touch the board, e2e files, code, or notes.

## Standalone use
Invoke: "write the feature doc for `<id>` from these requirements". Provide project dir, feature id, requirement content, today's date. Writes `feature.md` with the `awaiting_review` token and stops — reports the path written. Does not interview, approve, plan, or code.
