# Task Management

## WIP = 1

Work on exactly one feature at a time. Never activate a new task while another is incomplete. This is non-negotiable.

**Why:** More WIP → longer lead time → higher failure probability (Little's Law). WIP=1 strategy shows 37% higher completion rate (Anthropic data).

**Enforcement:**
- Before starting any new feature, check: is there an active feature in PROGRESS.md that isn't yet passing?
- If yes, finish it first. If no, mark the new feature as active and begin.
- Never "also refactor" or "also fix" unrelated code while implementing a feature.

## Feature Lists

Every feature MUST have the triple structure. Missing any field = incomplete:

```json
{
  "id": "F03",
  "behavior": "POST /cart/items with {product_id, quantity} returns 201",
  "verification": "curl -X POST http://localhost:3000/api/cart/items -H 'Content-Type: application/json' -d '{\"product_id\":1,\"quantity\":2}' | jq .status == 201",
  "state": "passing",
  "evidence": "commit abc123, test output verified"
}
```

**Three required fields:** behavior (what it does), verification (executable command that proves it works), state (one of four).

**State machine:** `not_started` → `active` → `passing` (or `blocked`). Agent CANNOT self-declare `passing` — verification command MUST succeed with evidence. Only one feature `active` at a time. `blocked` means waiting on external dependency/decision.

## Completion Evidence

"Code looks right" is not completion. Requires: verification command executed AND passed, evidence saved, PROGRESS.md updated.

## Parallel Agents for Independent Tasks

The only exception to sequential WIP=1 — spawn parallel agents when tasks have NO shared state and NO sequential dependencies.

**When to parallelize:** Tasks touch completely separate files. Task A's output is not input to Task B. Tasks can be verified independently.

**When NOT to parallelize:** Tasks share files. Task B depends on Task A. Codebase is unfamiliar. One task's design decisions affect another.

**How to spawn:**
1. Check PROGRESS.md for independent `not_started` tasks
2. Mark all selected as `active` simultaneously
3. Spawn one agent per task with `run_in_background: true`
4. Each agent follows standard flow: clock-in → spec → implement → verify → docs → clock-out
5. When all complete, run `make check` on merged result
6. Update PROGRESS.md with all results

**Critical rules:**
- Each agent MUST commit before others merge — no uncommitted changes
- If two agents touch the same file, second handles the merge conflict
- If any agent fails, stop the batch and diagnose before spawning more
- After all finish, run full verification on merged codebase
- Update `docs/codebase-map.md` after merge

**Valid parallel group:**
```
F04: Add user preferences endpoint   (src/api/preferences.py)
F05: Add email verification worker   (src/workers/email.py)
F06: Add health check endpoint       (src/api/health.py)
```

**Must be sequential:**
```
F04: Add order database model       (src/models/order.py)
F05: Add order creation endpoint     (src/api/orders.py) — depends on F04
```
