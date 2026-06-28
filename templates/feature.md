---
id: {{FEATURE_ID}}
title: {{FEATURE_TITLE}}
tiger-status: awaiting_review
date: {{DATE}}
classification: {{generic|unique|misclassified_generic}}
metric: { name: {{name}}, baseline: {{…}}, target: {{…}}, direction: {{increase|decrease|binary}} }
---

# {{FEATURE_TITLE}}

> One merged feature doc: what we'll do, why, and the business context. Keep it short —
> bullets, not paragraphs. grill writes it with the human and, on the explicit yes, flips
> `tiger-status` above to `approved`. That line is the build's only gate. Siblings:
> `e2e_testcases.robot` (the agreed e2e cases).

## Problem & JTBD
{{One or two lines. When {{situation}}, I want to {{motivation}}, so I can {{outcome}}.}}

## What we'll do
- FR1 — {{requirement}}
- Happy path: {{user action}} → {{system response}}
- Rule BR1 — {{statement}} — `{{runnable check}}`

## Why / Decisions
- {{Only real, hard-to-reverse trade-offs. Chosen X over Y because … / "none met the bar".}}

## Business context
- Value / users: {{who has this problem, what the business gets}}
- Metric: {{name}} — baseline {{…}} → target {{…}} ({{increase|decrease|binary}})
- Code glossary: {{magic value → meaning, e.g. `order.status 001 = pending`, `002 = shipped`}}

## Acceptance criteria
- AC1 — {{criterion}} — `{{runnable verification}}` — status: pending

## Out of scope / CAN-CANNOT
- CAN modify: {{…}}
- CANNOT modify / must not break: {{…}}
- Not doing: {{explicit non-goal}}
