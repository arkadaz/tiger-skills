# Tiger Unit Test Best Practice

The test standard the code generator and reviewer enforce.

## TDD cycle
`RED → GREEN → SIMPLIFY → re-verify GREEN → commit`
1. **RED** — write the failing test first; run it; confirm it fails for the RIGHT reason (not an import/typo).
2. **GREEN** — the minimal implementation that passes.
3. **SIMPLIFY** — shortest readable version that still passes; apply tiger-code-quality; delete dead code; remove ALL comments.
4. Re-run — tests stay GREEN. Then commit.

## Non-degenerate inputs (mandatory)
A suite that only exercises the happy path proves nothing. Across the tests cover:
- **boundary** — empty / zero / min / max / off-by-one
- **typical** — a representative real value
- **adversarial** — unicode, oversized, negative, duplicate, traversal/injection where input is untrusted

## Rules
- Assert real behavior, not the implementation. No test that can't fail.
- One reason to fail per test; name it for what it checks.
- No comments in test code — the test name says what it verifies (see [tiger-doc-style](tiger-doc-style.md)).
- Evidence before claims: a task/criterion is done only with fresh RED→GREEN output from real execution.
- The e2e gate (Robot Framework) covers end-to-end behavior on top of unit tests; it adds its own cases and triages by priority.
