# Documentation-First Development

The agent MUST NOT jump straight to implementation. Every task flows: **understand → document → get approval → implement → update docs.**

## Ask Before You Act

If ANY of these are unclear, ask the user BEFORE writing code: exact scope, I/O types/format, which files will be touched, what "done" looks like (verification criteria), priority relative to other work. Do not assume. Do not guess.

## Spec Before Code

Before writing implementation, write a spec to `docs/specs/YYYY-MM-DD-<topic>.md`. Present to user for approval if non-trivial.

```markdown
# <Feature/Task Name>

## What
[2-3 sentences from user perspective]

## Scope
- In: [what's included]
- Out: [what's excluded]

## Input/Output
- Input: [types, fields, validation]
- Output: [types, fields, meaning]

## Design
[Classes/functions to create/modify, data flow, dependencies]

## Files to Touch
- [path/file.py] — [what changes, why]

## Verification
- [specific command that proves this works]

## Dependencies
- [other features, services, decisions]
```

## Business Logic Documentation

Business rules MUST live in version-controlled .md files, not just in code or conversation memory.

**Where:** `docs/business/<domain>.md` or `src/<module>/README.md`

**What to record:** What the rule is (plain language), why it exists, where implemented (file:line), when added/changed (date + commit).

```markdown
# Pricing Rules

## Free shipping over $50
- Rule: Orders ≥ $50 get free standard shipping
- Reason: Marketing promotion, effective 2024-01-01
- Implemented: src/orders/pricing.py:45 (calculate_shipping)
- Last updated: 2024-03-15 (abc1234)
```

## After Implementation

When a feature is complete and verified:
1. Update the spec with what ACTUALLY happened
2. Update business logic docs if rules changed
3. Update `docs/codebase-map.md` with new/changed files
4. Update `PROGRESS.md`
5. Update `AGENTS.md` if new conventions emerged
