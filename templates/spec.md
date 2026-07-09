---
id: {{FEATURE_ID}}
feature: tiger/features/{{FEATURE_ID}}/feature.md
date: {{DATE}}
---

# Spec — {{FEATURE_TITLE}}

> The DETAILED, agent-facing requirements. grill extracts every value in the interview and
> writes it here so the lead and its coders can build AND test with ZERO follow-up questions.
> `feature.md` (the sibling) is the short human summary carrying the approval token; THIS file
> is the source of truth for behavior. No vague words — every threshold a number, every
> actor/field/message named exactly.

## Functional requirements
- FR1 — {{exact behavior: given <input>, the system does <action> producing <output>}}
  - Example: {{concrete input}} → {{concrete output}}
- FR2 — {{…}}

## Business rules
- BR1 — {{statement with exact values: formula, threshold, rounding, precedence}} — check: `{{runnable check}}`
- BR2 — {{state transition: <state> --<event>--> <state>; illegal transitions rejected with {{exact error}}}}

## Data & integrations
- {{entity/field: type, owner, source of truth, retention}}
- {{integration: contract, timeout, failure behavior (retry/skip/fail loud)}}
- N/A — {{reason}} (when the feature has no external data/systems)

## Errors & edge cases
| Condition | Expected behavior (exact) |
|---|---|
| {{empty / zero / missing input}} | {{exact response/message/exit}} |
| {{invalid / malformed / oversized}} | {{rejected how}} |
| {{denied / unauthorized}} | {{exact response}} |
| {{partial failure / retry / concurrency}} | {{behavior}} |

## Permissions & roles
- {{actor}} CAN {{action}}; {{actor}} CANNOT {{action}} — or `N/A: single caller`

## Non-functional constraints
- {{perf: number}}, {{security: rule}}, {{platform/runtime pins}} — or `none`

## Acceptance criteria (testable — the lead derives e2e cases from these)
- AC1 — Given {{concrete state}}, when {{concrete action}}, then {{observable outcome with exact data}}
- AC2 — {{≥1 per FR and per BR; adversarial ACs for any untrusted input}}

## Out of scope / must not break
- CANNOT modify: {{files/behavior}}
- Not doing: {{explicit non-goals}}
