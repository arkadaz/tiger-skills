# Verification Pipeline

## Three-Layer Termination Check

All three layers must pass. Skipping any required layer = not complete.

| Layer | What | Requirement |
|-------|------|-------------|
| **1 — Static** | Lint + type check | Zero errors. Always required. |
| **2 — Runtime** | Unit tests + integration tests | All pass. Always required. |
| **3 — System** | E2E tests, manual smoke test | Required when changes cross component boundaries |

**Sequence:** Do NOT proceed to layer 2 if layer 1 fails. Do NOT proceed to layer 3 if layer 2 fails.

## Definition of Done

Place this in every project's AGENTS.md:
```
## Definition of Done
A feature is complete ONLY when:
1. All three verification layers pass
2. Verification evidence is recorded
3. Code is committed with a clean message
4. PROGRESS.md reflects the new state
5. Session exit checklist passes
```

## Worker ≠ Checker

The agent that writes code CANNOT be the sole judge of whether it works. Agents systematically over-rate their own output.

- Verification commands are the checker — mechanical, objective, reproducible
- If a verification command passes, the feature passes
- If no verification command exists, the feature is not verifiable and therefore not done

## Error Messages That Help

Verification failures must tell the agent HOW to fix, not just WHAT failed:

Bad: `Test failed: test_create_order`

Good: `Test failed: test_create_order — POST /api/orders returned 500. Check OrderRepository.save() handles duplicate ISBNs. Error in src/orders/repository.py:45.`

Every error message: **what failed** + **why it likely failed** + **where to look**.
