# Task Management

## WIP = 1

Work on exactly one feature at a time. Never activate a new task while another is incomplete. This is non-negotiable.

**Why this matters (the math):** Little's Law — L = λ × W. More work-in-progress (L) → longer lead time per task (W) → higher failure probability. Anthropic's controlled experiments: agents using "small next step" strategy showed **37% higher completion rate** than those given broad prompts. Lines-of-code generated is weakly negatively correlated with feature completion — more code means fewer finished features.

**How WIP=1 works in practice:**
```
Session start:
  PROGRESS.md → In Progress: [ ] Pagination feature (85%, edge case failing)
  → Continue pagination. Do NOT start "user avatar upload" yet.

Session middle:
  Pagination fixed, verified, committed.
  PROGRESS.md → In Progress: (none active)
  → Now pick the next not_started feature from Next Steps.
  → Mark it active. Begin.

Session end:
  Pagination is done. But also "just quickly refactored the query builder."
  → VIOLATION. The refactoring should have been its own feature.
```

**Enforcement check before starting any work:**
1. Open PROGRESS.md
2. Look at "In Progress" section
3. If there's an active item → continue it. Nothing else.
4. If no active item → pick the top item from Next Steps, mark it active, begin.

**The "also refactor" trap:** You're implementing feature A, and you notice feature B's code could be cleaner. Do NOT refactor it. Note it in PROGRESS.md Known Issues or add it to the feature list. Refactoring is work. Work gets its own WIP slot.

**Exception — emergency bug fixes:** If a production bug is discovered, finish the current feature to a stable point (commit or stash), fix the bug, verify, then return to the feature.

## Feature Lists

Every feature MUST have three fields. Missing any one = incomplete specification.

### The Triple Structure

```json
{
  "id": "F03",
  "behavior": "POST /cart/items with {product_id, quantity} returns 201 and adds item to cart. Fails with 400 if product is out of stock. Fails with 404 if product doesn't exist.",
  "verification": "curl -X POST http://localhost:3000/api/cart/items -H 'Content-Type: application/json' -d '{\"product_id\":1,\"quantity\":2}' | jq .status == 201",
  "state": "passing",
  "evidence": "commit abc1234, test output: tests/test_cart.py::test_add_item PASSED, E2E: tests/e2e/test_cart_flow.py PASSED"
}
```

### The Three Fields Explained

**1. behavior** — What the feature does, in plain language. Include both the happy path AND the major error cases. "Returns 201 when..." is not enough. "Returns 201 when valid, 400 when out of stock, 404 when product missing" is specific.

**2. verification** — An executable command that proves the feature works. This is NOT "run the tests." It's a specific command that exercises the feature end to end. `curl`, `pytest tests/test_x.py::test_y`, a script. The command must return a clear pass/fail.

**3. state** — One of exactly four values. See state machine below.

### State Machine

```
not_started  →  active  →  passing
                  ↓
               blocked
```

**Four states only:**
- **not_started** — Ready to be worked on. All dependencies are satisfied.
- **active** — Currently being worked on. Only ONE feature in this state at any time.
- **passing** — Done. Verification succeeded. Evidence recorded. Committed.
- **blocked** — Cannot proceed. Waiting on external dependency, decision, or another feature.

**State transitions:**
- `not_started` → `active`: Agent marks it active. WIP=1 check must pass first.
- `active` → `passing`: Verification command MUST succeed. Agent CANNOT self-declare. Evidence required.
- `active` → `blocked`: External blocker. Must document what's blocking and why.
- `blocked` → `active`: Blocker resolved. Re-check WIP=1 before resuming.
- `passing` → (no transition): Done. Never goes back.

### Who Updates the State

**The agent CAN:**
- Mark `not_started` → `active` (claiming the task)
- Mark `active` → `blocked` (reporting a blocker)

**The agent CANNOT:**
- Mark `active` → `passing` without the verification command succeeding
- Mark `active` → `passing` because "the code looks right"

**The verification command updates the state.** If the command passes, the feature passes. If it fails, the feature is not done. This is mechanical, not judgmental.

## Completion Evidence

"Code looks right" is not completion. "Tests pass" is evidence, but not the only kind.

**Required for every feature reaching `passing`:**
1. Layer 1 clean (lint + type check)
2. Layer 2 passing (tests)
3. Layer 3 passing (E2E if cross-component)
4. Review agent approved (if non-trivial change)
5. Evidence recorded (test output, curl result, screenshot)

## Parallel Agents for Independent Tasks

The only valid exception to WIP=1. Spawn parallel agents when multiple tasks share NO state and have NO sequential dependencies.

### Decision Checklist

Ask these questions before parallelizing:

```
- [ ] Do the tasks touch completely separate files? (Yes = OK, No = sequential)
- [ ] Does Task A's output serve as Task B's input? (No = OK, Yes = sequential)
- [ ] Can each task be verified independently? (Yes = OK, No = sequential)
- [ ] Is the codebase familiar enough that agents won't need to re-explore? (Yes = OK, No = sequential)
- [ ] Do the tasks have well-written specs? (Yes = OK, No = write specs first, then parallelize)
```

All five must be YES to parallelize. Any NO = run sequentially.

### How to Spawn

```
1. Read PROGRESS.md. Identify ≥2 not_started features that pass the parallel checklist.
2. Write specs for each feature (if not already done).
3. Mark all selected features as active simultaneously.
4. Spawn one background agent per feature:
   Agent tool → run_in_background: true
   Each agent gets: feature spec, file paths, verification command.
5. Each agent follows the standard 14-step flow independently.
6. When all agents complete:
   a. git pull/fetch each branch (if using worktrees) or check each agent's commits
   b. Merge all completed work
   c. Run make check on merged result
   d. If make check fails, diagnose and fix (do NOT spawn more agents)
   e. Update PROGRESS.md with all results
   f. Update docs/GRAPH.md to incorporate all new flows
   g. Update docs/codebase-map.md with all new files
```

### Critical Rules for Parallel Work

1. **Each agent commits before merging.** No agent leaves uncommitted changes.
2. **If two agents touch the same file,** the second to merge handles the conflict.
3. **If any agent fails,** STOP the entire batch. Diagnose. Fix. Then decide whether to re-spawn or continue sequentially.
4. **After merge, full verification.** `make check` on the merged codebase — not just per-agent verification.
5. **One agent handles the merge + doc updates.** After all parallel agents finish, one agent (the main session) merges, verifies, and updates GRAPH.md, codebase-map.md, and PROGRESS.md.

### Valid Parallel Group (DO THIS)

```
F04: Add user preferences endpoint   → src/api/preferences.py     (new file)
F05: Add email verification worker   → src/workers/verify_email.py (new file)
F06: Add health check endpoint       → src/api/health.py           (new file)
```
Three new files, zero shared dependencies, independently verifiable. Perfect for parallel.

### Must Be Sequential (DON'T parallelize)

```
F04: Add Order ORM model            → src/models/order.py          (new file)
F05: Add order creation endpoint    → src/api/orders.py            (depends on F04's model)
F06: Add order notification worker  → src/workers/notify_order.py  (depends on F05's endpoint)
```
Each depends on the previous. Must run sequentially.
