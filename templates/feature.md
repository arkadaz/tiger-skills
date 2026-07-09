---
id: {{FEATURE_ID}}
title: {{FEATURE_TITLE}}
tiger-status: awaiting_review
date: {{DATE}}
classification: {{generic|unique|misclassified_generic}}
metric: { name: {{name}}, baseline: {{…}}, target: {{…}}, direction: {{increase|decrease|binary}} }
spec: tiger/features/{{FEATURE_ID}}/spec.md
---

# {{FEATURE_TITLE}}

> The HUMAN-readable summary of the feature — one page, bullets, no walls of text. The full
> detailed requirements live in the sibling `spec.md` (agent-facing); approving THIS doc
> approves both. grill writes both with the human and, on the explicit yes, flips
> `tiger-status` above to `approved`. That line is the build's only gate. The e2e suite is
> authored later by the lead, derived from `spec.md`.

## Problem & JTBD
{{One or two lines. When {{situation}}, I want to {{motivation}}, so I can {{outcome}}.}}

## What we'll do
- {{headline capability 1 — plain language}}
- Happy path: {{user action}} → {{system response}}
- Key rules: {{the 2–4 rules a human must know; the full list with exact values is in spec.md}}

## Why / Decisions
- {{Only real, hard-to-reverse trade-offs. Chosen X over Y because … / "none met the bar".}}

## Business context
- Value / users: {{who has this problem, what the business gets}}
- Metric: {{name}} — baseline {{…}} → target {{…}} ({{increase|decrease|binary}})
- Code glossary: {{magic value → meaning, e.g. `order.status 001 = pending`, `002 = shipped`}}

## Acceptance criteria (summary — full testable detail in spec.md)
- AC1 — {{one-line criterion}}
- AC2 — {{…}}

## Out of scope / CAN-CANNOT
- CAN modify: {{…}}
- CANNOT modify / must not break: {{…}}
- Not doing: {{explicit non-goal}}
