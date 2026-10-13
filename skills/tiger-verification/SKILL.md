---
name: tiger-verification
description: Test-first building, proof that work is done, and tests that stay few and fast. The red, green, simplify, verify, commit loop; a verification for every task; evidence from a fresh run; formatter, linter and type checks such as clippy after every task; testing only what can break; one test row for every leaf of the decision tree; inputs that can tell right from wrong; hostile input wherever data enters; screens checked with Playwright in a real browser; short independent end-to-end journeys that run in parallel; what to run when. Use when building a task, writing tests or acceptance criteria, trimming or speeding up a test suite, or before saying anything is done.
---

# Verification

A verification is a command and the result you expect from it. Nothing is done until you ran it and read what it printed.

Use the project's own test runner. If it has none, use the standard one for its language. Do not add a test framework the project does not need. The one fixed choice: anything with a screen is checked with Playwright.

## The task loop

Every task:

1. **Red** — write the test or check first, run it, and watch it fail because the behavior is missing, not because of a typo or a missing import.
2. **Green** — write the least code that makes it pass.
3. **Simplify** — go through "Before you commit" in `tiger-code-quality` over your whole diff and fix every hit. The tests stay green.
4. **Verify** — run the task's verification, the static checks, and the fast tests (unit and use case).
5. **Commit** — one commit for the task: its code and its tests.

If the same check still fails after three real attempts, stop and report what you tried and what you saw.

## Rules

- Every task and every acceptance criterion has a verification written before the work.
- It must fail first. A check that never failed proves nothing.
- Done means you ran it in this session, after your last change, and read the output. "Should pass" is not done.
- It must tell right from wrong. Ask: would the laziest wrong implementation also pass? If yes, add the input that separates them.
- Verify what the user runs, the way they run it: an API with a real request, a command line tool with a real call, a screen in a real browser.
- Fix the code, not the test. Change a test only when it contradicts the spec, and say so.
- What you could not verify, you say plainly.

## Evidence

Write what the command printed, not what you hoped. One line:

```
done: yes — failed first (3 != 4), then 14 passed — commit a1b2c3d
```

## Static checks, every time

After every task, and again at acceptance, run the formatter check, the linter and the type checker, with warnings counted as failures.

| Language | Run |
|---|---|
| Rust | `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` |
| Python | `ruff format --check .`, `ruff check .`, and the type checker the project uses |
| JavaScript, TypeScript | `eslint .` and `tsc --noEmit` |
| Go | `gofmt -l .` (must print nothing) and `go vet ./...` |
| anything else | the formatter, linter and type checker that are standard for it |

- The commands the project already defines in its scripts, Makefile or CI come first.
- A project with none gets the standard ones for its language, set up once, as its own task.
- Fix what a check reports. Do not silence it with an ignore line or a looser rule.
- Write the commands in `docs/agent/architecture.md` under Commands.
- The code map is rebuilt after every task as well, by whoever lands the task. See `tiger-code-map`.

## Test only what can break

A test earns its place when it would fail if one of our own rules were broken. Before you write one, name the rule it protects. No rule, no test.

Do not test:

- the language, the standard library, the framework, the ORM or any library — they have their own tests
- getters, setters, constructors, plain field-to-field mapping, or any code with no decision in it
- the same rule a second time at another layer
- how the code does something, instead of what it returns

One rule gets one test, with its edges as rows of that test. Rows are not separate tests.

Plain create, read, update, delete needs about a dozen tests, not thousands: one per rule of ours (what is required, what must be unique, who is allowed), one adapter test per query we wrote by hand, and one journey that creates, reads, changes and deletes a record. The framework already proves that saving and loading work.

Test code several times longer than the code it tests means too many tests. Stop and cut: keep the one test per rule.

A test, fixture, helper or journey for behavior that was removed or replaced is deleted with it, in the same task.

When a suite has grown too big, delete the tests that repeat the framework, that repeat another test, or that break on every refactor without any rule changing. Every rule must still have its test afterwards.

## Tests are code too

Test code follows every rule in `tiger-code-quality`. On top of that:

- The name states the rule it proves, in the form the test framework expects: `a_position_below_one_is_refused`.
- Three parts in this order: set up, do the one thing, check the result.
- The expected value is written out. A test never works out its expected answer with the logic it is testing, and it has no `if`.
- A table row with more than three values names them, so nobody has to count positions to read it.
- Set up only what this test needs. Shared test data has a name that says what it is.
- A port is replaced by one small in-memory version of it. Our own functions are never mocked.

## Keep tests fast

Slow tests stop being run. Put each check at the lowest layer that can prove it.

| Layer | Proves | How many | Each takes |
|---|---|---|---|
| unit, on the domain | a rule is right | most of them | milliseconds |
| use case, with in-memory adapters | a whole user action works, with no browser and no network | one per user action and each way it fails | milliseconds |
| adapter, against the real thing | the query, the request, the file format | a few per adapter | under a second |
| journey, end to end through the real entry | the parts are wired together | a handful: the paths the product lives on | seconds |

Do not prove a rule through the screen when a unit test can prove it. A journey proves the wiring, once.

### Journeys

- One journey is one user goal in a few steps: "sign in and see my orders", not "everything a user can do".
- Each journey creates its own data through the API or the database, never by clicking through other screens first.
- No journey depends on another, on run order, or on data another one left behind. That is what lets them run in parallel.
- Start signed in: reuse a saved session instead of typing a password in every journey.
- Never sleep. Wait for the thing you need: the element, the response, the row.
- One browser and one server per worker, not per journey.
- Swap third parties for an in-memory adapter, unless the journey is about that third party.
- Tag every journey with the feature it covers, and tag the few that prove the app starts and its main path works as `smoke`.

### What runs when

| When | Run | Should take |
|---|---|---|
| after every task | the task's check, the static checks, and all unit and use case tests | seconds |
| acceptance | that, plus the adapter tests and journeys this change touches, plus the smoke journeys | a few minutes at most |
| before a release, or in CI | everything, journeys in parallel across workers | minutes |

Run journeys in parallel with the runner's own option: workers, `-n auto`, shards.
A run that is over its time is a defect. Read the runner's timing report, take the slowest tests first, and fix them by moving the check down a layer, cutting the setup, or removing a wait. Never fix it by skipping tests.

## The cases come from the decision tree

Do not think up edge cases while writing tests. They were derived before the spec was written, with `tiger-decision-tree`, and they sit in the tree drawn in the spec's Cases section.

- Every leaf of that tree is a row of one table-driven test. No leaf is skipped, and no row is added that the tree does not have.
- A case you find while building that the tree lacks is a gap. Report it. Do not decide it yourself.

## Inputs that can tell right from wrong

| Checking | Use |
|---|---|
| sums and rounding | at least two values with fractions |
| ranges and limits | just below, exactly on, just above |
| first or last wins | duplicates with different contents |
| filters | at least one item that must be left out |
| counts | zero, one, many |
| ordering | input that is not already sorted |
| random or time | a fixed seed and a fixed clock |

Some runners exit 0 when no test matched. Assert the count: `... | grep -q "1 passed"`.

## Input from outside

Wherever data from outside first enters the program — a request handler, command line arguments, a file, an environment variable, a queue message, anything parsed — it is turned into typed values once, and what is wrong is refused there.

How hard to push depends on who can send it:

| Who can send it | Check |
|---|---|
| anyone: a public API, a form, an upload, a webhook | every row of the list below |
| a trusted caller, or the user's own file or command line | the shape and the types, and anything that would otherwise give a wrong answer without an error |

Refuse bad input with the least machinery: a schema or validation library the project already has, or the typed value's own constructor. Do not write a checking function per field. Do not invent a limit, a field or a rule the spec does not give: if you think one is needed, report it.

The list, for input that anyone can send. Write it as one table-driven test, one row per case, before the code:

1. the wrong type in each field: a list, object, null, boolean or number where text is expected, and the reverse
2. a missing field, an unknown extra field, an empty body
3. an empty string, only spaces, an empty list
4. numbers too big to hold (`1e400`, a 400-digit integer), both coming in and as the result of the calculation
5. results that are not real numbers (overflow, 0/0)
6. a huge payload, a very long string, deep nesting
7. unicode, control characters, NUL, emoji, right-to-left text
8. negative, zero, and one-off at every limit
9. duplicate keys, ids or repeated parameters
10. path traversal and injection wherever a value reaches a path, query, shell or template
11. the wrong content type, a malformed or cut-off body
12. the same request sent twice, or twice at once

Two rules cover every row. No row may crash or return a server error: each is rejected with the exact error the spec names, and a catch-everything handler does not count. Every successful output must parse with a strict parser.

When a row finds a bug, fix the whole family — every field, every operation that can fail the same way — not the single row.

Where a schema or a validation library already rejects a row, write one test proving it is switched on for that entry point. Do not test the library row by row.

## Screens

A screen is verified with Playwright, in a real browser, against the real running app. Click the real button, type in the real field, read what the page shows.

- Find things the way a user does: by role, label or visible text (`getByRole`, `getByLabel`, `getByText`), not by CSS classes or ids made for tests.
- Assert on what the user sees: the text, the row, the message. Not on internal state.
- A component test in a fake DOM, a snapshot, or a search of the HTML does not verify a screen.
- A screen change that Playwright never clicked through is not verified.

Playwright already has what keeps journeys fast, so use it and build none of it yourself:

| Need | Use |
|---|---|
| run in parallel | `fullyParallel: true` and workers |
| start signed in | a saved `storageState` |
| no sleeps | assertions that wait: `await expect(...).toBeVisible()` |
| run only what a change touches | tags and `--grep @orders` |
| split across machines | `--shard=1/4` |
| start the app for the run | `webServer` in the config |

## Services

Start it, wait until it answers, run the check, and always stop it, also when the check fails. Put a timeout on every step.

## What cannot be automated

For a visual judgment, real hardware, or a third party's live system: write the exact steps and what the person should see, and mark it `needs a human check`. Never mark it verified.
