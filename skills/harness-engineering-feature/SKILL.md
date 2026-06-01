---
name: harness-engineering:feature
description: Feature lifecycle management — pick one feature, enforce WIP=1, track state through not_started → in_progress → passing/blocked, enforce definition of done. Use when starting work, switching features, or checking feature state.
---

# Feature Lifecycle

From walkinglabs Lectures 07 and 08: *Why Agents Overreach and Under-Finish*, *Why Feature Lists Are Harness Primitives*.

> Feature lists are not project management fluff — they are harness primitives that enforce scope automatically. — walkinglabs, Lecture 08

## Feature State Machine

```
not_started → in_progress → passing
                  ↓
               blocked
```

**Four states only.** No "almost done." No "mostly working."

## Picking a Feature

### WIP=1 Check (MANDATORY)

Before starting ANY work:

1. Read `feature_list.json`
2. Check for any feature with `status: "in_progress"`
3. If one exists → **continue it.** Nothing else.
4. If none exists → pick highest-priority `not_started`, mark it `in_progress`

**If WIP=1 would be violated:** Stop. Finish or block the active feature first. Never activate two features simultaneously.

### The "Also Refactor" Trap

You're implementing feature A. You notice feature B's code could be cleaner. **Do NOT refactor it.** Note it in `progress.md` Known Issues. Refactoring is work. Work gets its own feature entry and its own WIP slot.

### Emergency Exception

If a production bug is discovered:
1. Finish current feature to a stable point (commit)
2. Create a bug-fix feature entry
3. Fix the bug (WIP=1 now points to the bug)
4. Verify, mark passing
5. Return to the original feature

## Feature Specification

Every feature MUST have three fields. Missing any one = incomplete specification.

### The Triple Structure

```json
{
  "id": "feature-001",
  "user_visible_behavior": "[Happy path + error cases — what the user sees]",
  "verification": ["[Specific step 1]", "[Specific step 2]"],
  "status": "not_started"
}
```

### 1. user_visible_behavior

What the feature does in plain language. Include happy path AND major error cases.

**Wrong:** "Add search feature"
**Right:** "User can search products by name. Returns paginated results (default 20 per page). Returns 400 if query is empty or under 3 characters. Returns 200 with empty results list if no matches found."

### 2. verification

Specific, executable steps. Each step must produce a clear pass/fail.

**Wrong:** `"Run the tests"`
**Right:**
```json
[
  "Search for 'widget' → verify response includes matching products",
  "Search with empty query → verify 400 Bad Request",
  "Search for 'xyznonexistent' → verify 200 OK with empty results array",
  "Verify pagination: search 'a', verify exactly 20 results on page 1"
]
```

### 3. status

Exactly one of four values. Agents CANNOT self-declare `passing` — verification must run and pass.

## State Transitions

| Transition | Who/What Authorizes | Condition |
|-----------|-------------------|-----------|
| `not_started` → `in_progress` | Agent | WIP=1 check passes |
| `in_progress` → `passing` | **Verification** | Verification command succeeds. Evidence recorded in `evidence` array. |
| `in_progress` → `blocked` | Agent | External blocker. Document what's blocking and why in `notes`. |
| `blocked` → `in_progress` | Agent | Blocker resolved. WIP=1 check passes. |

**CRITICAL:** The agent CANNOT mark a feature `passing`. Only the verification command can. If the verification command passes, the feature is `passing`. If it fails, the feature is not done. This is mechanical, not judgmental.

## Definition of Done

Every feature must have an explicit, verifiable definition of done. Write it before starting work.

```
Completion criteria:
- [Specific behavior implemented]
- [Error cases handled]
- Layer 1: ruff check + mypy --strict → 0 errors
- Layer 2: pytest tests/ -x -k <feature> → all pass
- Layer 3 (if cross-component): E2E test passes
- Evidence recorded in feature_list.json
```

**The definition of done prevents:**
- **Overreach:** "That refactoring isn't in the criteria, don't do it"
- **Under-finish:** "Every criterion must be met before claiming passing"

## Placeholder Ban

Forbidden in committed code:
- `pass` (in functions that should do something)
- `raise NotImplementedError`
- `# TODO: implement`
- `todo!()` (Rust)
- `unimplemented!()` (Rust)

Every function must be complete. If you can't complete it in this task, it belongs in a later task — don't write the signature now and the body later.

## Feature Completion Evidence

When a feature reaches `passing`, record:

```json
{
  "id": "feature-001",
  "status": "passing",
  "evidence": [
    "Layer 1: ruff 0 errors, mypy clean (2026-06-01 14:30 UTC)",
    "Layer 2: pytest 12/12 passing, commit abc1234",
    "Layer 3: E2E search flow passed, commit abc1234"
  ]
}
```

Evidence is NOT "tests passed." Evidence is specific output recorded at a specific time from a specific commit.
