# Task Management

## WIP = 1

Work on exactly one feature at a time. Never activate a new task while another is incomplete. This is non-negotiable.

**Why this matters (the math):** Little's Law — L = λ × W. More work-in-progress (L) → longer lead time per task (W) → higher failure probability. Anthropic's controlled experiments: agents using "small next step" strategy showed **37% higher completion rate** than those given broad prompts. Lines-of-code generated is weakly negatively correlated with feature completion — more code means fewer finished features.

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

## Bite-Sized Tasks

Every task must be small enough to complete, verify, and commit in one uninterrupted pass. If a task feels big, break it down until each piece is atomic.

### Rules

1. **Each task = one commit.** If a task requires multiple commits, it's multiple tasks.
2. **No placeholders. No TODOs. No stubs.** Every task produces complete, working code. `pass`, `todo!()`, `# TODO: implement`, `raise NotImplementedError` — all forbidden in committed code.
3. **Each task is independently verifiable.** After completing task N, `make check` passes. You do not need task N+1 to verify task N.
4. **Each task has a clear "done" signal.** Before starting, you know exactly what "done" looks like — a specific test passing, a specific curl returning 200, a specific lint output showing 0 errors.

### Breaking Down Tasks

When writing a plan, apply these decomposition rules:

| If the task involves... | Break it into... |
|------------------------|-----------------|
| A new module with 3+ classes | One task per class + one integration task |
| A new API endpoint | (1) model/schema, (2) service logic, (3) route handler, (4) tests |
| A database migration + code change | (1) migration, (2) model update, (3) service update, (4) API update |
| A refactoring across N files | One task per file if independent, or group by coupling |
| A bug fix | (1) reproduce with failing test, (2) fix, (3) verify no regressions |

### The Placeholder Ban

This deserves emphasis because it is the #1 cause of "almost done" features that are actually broken.

**Forbidden in committed code:**
```python
# Python
def calculate_total(items: list[Item]) -> Money:
    pass  # FORBIDDEN — placeholder

def validate(self) -> None:
    raise NotImplementedError  # FORBIDDEN — stub

# TODO: add error handling  # FORBIDDEN — deferred work
```

```rust
// Rust
fn calculate_total(items: &[Item]) -> Money {
    todo!()  // FORBIDDEN — placeholder
}

fn validate(&self) -> Result<()> {
    unimplemented!()  // FORBIDDEN — stub
}
```

**Every function you write must be complete.** If you can't complete it in this task, it belongs in a later task. Do not write the signature now and the body later.

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

### Subagent Prompt Template

Every subagent MUST receive a self-contained prompt. The subagent has zero context from the parent session. Include ALL of these:

```
You are implementing feature [ID]: [name].

## Spec
[paste the full spec — not a reference to it, the actual content]

## Files to Create/Modify
- [exact file paths]

## Verification Command
[exact command to run — the subagent will run this before reporting done]

## Constraints
- Follow code-quality skill rules (load skills/code-quality/SKILL.md)
- No placeholders, no TODOs, no stubs — complete code only
- Run verification BEFORE reporting status
- Report status using the Subagent Status Protocol below

## Context
- Project language: [Python/Rust]
- Key dependencies: [list]
- Related files (read-only, for context): [list]
```

**Never assume the subagent knows anything.** A prompt that says "implement F03 as discussed" will fail. A prompt that includes the full spec, file list, and verification command will succeed.

### Subagent Status Protocol

Every subagent MUST report its final status using exactly one of these four codes. No other status is valid.

| Status | Meaning | Parent Action |
|--------|---------|--------------|
| **DONE** | Feature complete. All verification layers pass. Evidence included. | Merge, verify merged result |
| **DONE_WITH_CONCERNS** | Feature complete and verified, but agent noticed something worth flagging (edge case, potential issue, design question). | Read concerns. Decide. Merge if acceptable. |
| **NEEDS_CONTEXT** | Agent could not complete because it needs information not in the prompt — a design decision, a missing file, an unclear requirement. | Provide the context. Re-spawn with enriched prompt. |
| **BLOCKED** | Agent hit an external blocker — broken dependency, failing infrastructure, permission issue, environment problem. | Fix the blocker. Re-spawn. |

**Status report format:**

```markdown
## Status: [DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED]

### What Was Done
- [list of completed work with file paths]

### Verification Evidence
- Layer 1: [paste ruff + mypy output]
- Layer 2: [paste pytest output]
- Layer 3: [paste E2E output if applicable]

### [If DONE_WITH_CONCERNS] Concerns
- [specific concern with file:line reference]

### [If NEEDS_CONTEXT] What's Needed
- [specific question or missing information]

### [If BLOCKED] Blocker Details
- [what failed, error output, what was tried]
```

### Model Selection for Subagents

Match model capability to task complexity:

| Task Type | Recommended Model | Why |
|-----------|------------------|-----|
| New module/class with business logic | **opus** | Needs design judgment, abstraction decisions |
| Complex refactoring across files | **opus** | Needs to hold multiple file contexts, make structural decisions |
| Straightforward CRUD endpoint | **sonnet** | Well-defined pattern, low ambiguity |
| Adding tests for existing code | **sonnet** | Pattern-following, low design decisions |
| Simple data model / schema | **sonnet** | Mechanical translation from spec |
| Config file changes, simple fixes | **haiku** | Fast, cheap, low complexity |

**Default to opus when uncertain.** A more capable model on a simple task wastes a little money. A less capable model on a complex task wastes the entire attempt.

### Two-Stage Review for Subagent Work

After a subagent reports DONE or DONE_WITH_CONCERNS, the parent session runs a TWO-STAGE review before accepting:

**Stage 1 — Spec Compliance Review:**
```
Does the implementation match the spec?
- [ ] All behaviors from the spec are implemented (happy path AND error cases)
- [ ] All specified types/fields/validation present
- [ ] No extra behaviors added beyond spec (no scope creep)
- [ ] Verification command from spec was run and passed
```

**Stage 2 — Code Quality Review:**
```
Does the code meet quality standards?
→ Spawn review agent per code-quality/references/review-agent.md
→ Review agent checks all 19 audit items independently
```

**Both stages must pass.** Spec compliance without quality = tech debt. Quality without spec compliance = wrong feature.

### Critical Rules for Parallel Work

1. **Each agent commits before merging.** No agent leaves uncommitted changes.
2. **If two agents touch the same file,** the second to merge handles the conflict.
3. **If any agent fails,** STOP the entire batch. Diagnose. Fix. Then decide whether to re-spawn or continue sequentially.
4. **After merge, full verification.** `make check` on the merged codebase — not just per-agent verification.
5. **One agent handles the merge + doc updates.** After all parallel agents finish, one agent (the main session) merges, verifies, and updates GRAPH.md, codebase-map.md, and PROGRESS.md.
6. **Two-stage review on merged result.** After merge verification passes, run both spec compliance and code quality review on the merged codebase.
