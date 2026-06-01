# Scope Control

From walkinglabs Lectures 07 and 08: *Why Agents Overreach and Under-Finish*, *Why Feature Lists Are Harness Primitives*.

> One feature at a time; explicit definition of done. — walkinglabs

## The Two Failure Modes

### Overreach
Agent starts feature A → notices code in feature B that could be cleaner → refactors B → notices pattern C could be abstracted → writes a framework for C → context fills up → feature A is 40% done and feature B is broken.

### Under-Finish
Agent implements the happy path → "that's basically done" → leaves error handling as TODO → skips edge cases → declares completion → the feature works for the demo case and fails for everything else.

**Both are scope failures.** Both are prevented by the same mechanism: explicit boundaries + definition of done + WIP=1.

## WIP = 1 — The Non-Negotiable Rule

Work on exactly one feature at a time. Never activate a new task while another is incomplete.

**Why (the math):** Little's Law — L = λ × W. More work-in-progress (L) → longer lead time per task (W) → higher failure probability. Anthropic found agents using "small next step" strategy show **37% higher completion rate** than those given broad prompts.

**Enforcement:**
1. Open `feature_list.json`
2. Check for any feature with status `in_progress`
3. If one exists → continue it. Nothing else.
4. If none exists → pick highest-priority `not_started`, mark it `in_progress`

**The "also refactor" trap:** You're implementing feature A and notice feature B's code could be cleaner. Do NOT refactor it. Note it in progress.md Known Issues. Refactoring is work. Work gets its own WIP slot.

**Exception — emergency bug fix:** Finish current feature to a stable point (commit). Fix bug. Verify. Return to feature.

## Feature Structure

Every feature in `feature_list.json` must have three elements. Missing any one = incomplete specification.

### The Triple Structure

```json
{
  "id": "feature-001",
  "user_visible_behavior": "A user can search products by name. Returns paginated results with highlighting. Returns 400 if query is empty. Returns empty list (not error) if no matches.",
  "verification": [
    "Search for 'widget' — verify results include products with 'widget' in name",
    "Search with empty query — verify 400 response",
    "Search for 'xyznonexistent' — verify 200 with empty results list"
  ],
  "status": "not_started"
}
```

### The Three Fields Explained

1. **user_visible_behavior** — What the feature does in plain language. Include happy path AND error cases. "Returns 201 when valid, 400 when out of stock, 404 when product missing" — not "Adds item to cart."

2. **verification** — Specific, executable steps to prove the feature works. Not "run the tests" — specific actions with expected outcomes. Each step must produce a clear pass/fail.

3. **status** — Exactly one of: `not_started`, `in_progress`, `blocked`, `passing`. Agents CANNOT self-declare `passing` — verification must run and pass.

## The Placeholder Ban

**Forbidden in committed code:**

```python
def calculate_total(items: list[Item]) -> Money:
    pass  # FORBIDDEN

def validate(self) -> None:
    raise NotImplementedError  # FORBIDDEN

# TODO: add error handling  # FORBIDDEN
```

Every function must be complete. If you can't complete it in this task, it belongs in a later task — don't write the signature now and the body later.

## Definition of Done

From walkinglabs Lecture 07. Every feature must have an explicit, verifiable definition of done.

**Insufficient:** "Add search feature"
**Sufficient:**
```
Completion criteria for search feature:
- GET /api/search?q=<query> returns paginated results
- Results include highlighted snippets
- Empty query returns 400 with error message
- No matches returns 200 with empty list (not error)
- All new code passes pytest tests/ -x
- Type checking passes (mypy src/ --strict)
- E2E test: search, verify results, verify pagination
```

The definition of done is what prevents both overreach ("that's not in the criteria, don't do it") and under-finish ("every criterion must be met before claiming passing").

## The Feature State Machine

```
not_started → in_progress → passing
                  ↓
               blocked
```

**Only four states.** No "almost done." No "mostly working."

| Transition | Who Can Do It | Condition |
|-----------|--------------|-----------|
| `not_started` → `in_progress` | Agent | WIP=1 check passes |
| `in_progress` → `passing` | Verification | Verification command succeeds. Evidence recorded. |
| `in_progress` → `blocked` | Agent | External blocker documented |
| `blocked` → `in_progress` | Agent | Blocker resolved. WIP=1 check passes. |

**Agents CANNOT mark `in_progress` → `passing` without verification.** "Code looks right" is not evidence.

## Feature Lists as Harness Primitives

From walkinglabs Lecture 08. Feature lists are not project management fluff — they are harness primitives. They enforce scope automatically:
- The agent can see what's in scope (feature list) and what's not (everything else)
- WIP=1 is mechanically enforced by checking `in_progress` count
- Completion is mechanically enforced by verification passing
- State is machine-readable and doesn't depend on human judgment

Without a feature list, scope is whatever the agent thinks it is — which is exactly how overreach and under-finish happen.
