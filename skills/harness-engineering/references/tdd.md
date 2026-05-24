# Test-Driven Development

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## When to Use

**Always:** New features, bug fixes, refactoring, behavior changes.

**Exceptions (ask user first):** Throwaway prototypes, generated code, configuration files.

Thinking "skip TDD just this once"? Stop. That's rationalization.

## Red-Green-Refactor

```
RED  ──→  Verify fails correctly  ──→  GREEN  ──→  Verify all pass  ──→  REFACTOR  ──→  Verify still green  ──→  Next RED
```

### RED — Write Failing Test

Write one minimal test showing what should happen.

**Requirements:**
- One behavior per test
- Clear name describing the behavior
- Real code (no mocks unless unavoidable)

**Python example:**
```python
def test_rejects_empty_email() -> None:
    result = submit_form(FormData(email=""))
    assert result.error == "Email required"
```

**Rust example:**
```rust
#[test]
fn rejects_empty_email() {
    let result = submit_form(FormData { email: String::new() });
    assert_eq!(result.error, "Email required");
}
```

### Verify RED — Watch It Fail

**MANDATORY. Never skip.**

Run the test. Confirm:
- Test fails (not errors — a compilation error is not a proper failure)
- Failure message matches expectation
- Fails because feature is missing (not typos)

**Test passes?** You're testing existing behavior. Fix the test.

### GREEN — Minimal Code

Write the simplest code to pass the test.

**Don't:**
- Add features beyond what the test requires
- Refactor other code
- "Improve" beyond the test
- Over-engineer with options/config nobody asked for

### Verify GREEN — Watch It Pass

**MANDATORY.**

Confirm:
- The new test passes
- All existing tests still pass
- Output is clean (no errors, no warnings)

**Test fails?** Fix the code, not the test.

### REFACTOR

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for next behavior.

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | Tests one thing. "and" in name? Split it. | `test_validates_email_and_domain_and_whitespace` |
| **Clear** | Name describes behavior | `test_1`, `test_order` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |
| **Real code** | Tests actual behavior | Tests mock behavior |

## Testing Anti-Patterns

### Anti-Pattern 1: Testing Mock Behavior

```python
# WRONG — testing that the mock exists
def test_calls_service() -> None:
    mock_service = Mock()
    handler = OrderHandler(mock_service)
    handler.create_order(request)
    mock_service.process.assert_called_once()  # Tests mock, not behavior
```

```python
# RIGHT — testing actual behavior
def test_creates_order_with_correct_total() -> None:
    service = OrderService(test_db)
    result = service.create_order(CreateOrderRequest(items=[item]))
    assert result.total == Money("30.00")
```

**Rule:** If your assertion checks a mock's call count, you're testing the mock, not the code.

### Anti-Pattern 2: Test-Only Methods in Production

```python
# WRONG — destroy() only used in tests
class Session:
    def destroy(self) -> None:  # Looks like production API!
        self.workspace_manager.destroy_workspace(self.id)
```

```python
# RIGHT — test utilities handle test cleanup
# test_utils.py
def cleanup_session(session: Session) -> None:
    workspace = session.get_workspace_info()
    if workspace:
        workspace_manager.destroy_workspace(workspace.id)
```

**Rule:** Never add methods to production classes that are only called by tests.

### Anti-Pattern 3: Incomplete Mocks

```python
# WRONG — partial mock missing fields downstream code uses
mock_response = {"status": "success", "data": {"user_id": "123"}}
# Later: crashes when code accesses response["metadata"]["request_id"]
```

```python
# RIGHT — mirror real API completely
mock_response = {
    "status": "success",
    "data": {"user_id": "123", "name": "Alice"},
    "metadata": {"request_id": "req-789", "timestamp": 1234567890},
}
```

**Rule:** Mock the COMPLETE data structure as it exists in reality.

### Anti-Pattern 4: Tests as Afterthought

```
# WRONG
✅ Implementation complete
❌ No tests written
"Ready for testing"
```

**Rule:** Testing is part of implementation, not an optional follow-up. TDD prevents this by definition.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Test hard = design unclear" | Listen to the test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for the code you touch. |

## Red Flags — STOP and Start Over

- Code written before test
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output clean (no errors, no warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## Integration with Workflow

TDD integrates at [workflow.md](workflow.md) step 6 (Implement):
1. Write failing test (RED)
2. Run test, confirm it fails (Verify RED)
3. Write minimal implementation (GREEN)
4. Run test, confirm it passes (Verify GREEN)
5. Clean up (REFACTOR)
6. Run all tests, confirm still green
7. Commit
8. Next behavior → back to step 1

Steps 7-9 of the workflow (Layer 1-3 verification) naturally follow each TDD cycle.
