---
name: tiger-review
description: Review a change by running things, not by opinion. Runs the unit, use case, adapter and end-to-end tests, the linter, type check and architecture check, rule checks as commands, security scans, and probes that a wrong implementation would fail. Every finding is a command and what it printed. Use when asked to review, audit or check a diff, branch, commit or pull request, or whether a change is safe.
---

# Review

A review is proof, not opinion. Every finding is one of two things: a command you ran and what it printed, or a written rule and the `file:line` that breaks it, with the rule quoted. No proof, no finding.

The reviewer is never the one who wrote the code. An author reads the code the way it was meant, and a long session forgives what it has seen a hundred times. Review in a fresh context, from the spec and the diff alone.

You may add a test to prove a finding. You change no product code unless the user asks for the fixes.

The rules behind these checks are in `tiger-code-quality`, `tiger-design-principles`, `tiger-refactoring`, `tiger-hexagonal`, `tiger-verification`, `tiger-decision-tree`, `tiger-performance`, `tiger-logging` and `tiger-configuration`, in `tiger-terraform` for infrastructure, and in `tiger-fullstack` for an HTTP API, a Flutter app or containers. Load them if they are not already in your context.

## What to review

The target the user named. Otherwise the current branch against the branch it was cut from: `git diff $(git merge-base HEAD <base>)..HEAD`.

A review needs a clear statement of what the change must do: the feature's acceptance criteria, or the bug and what should happen instead. For a version still being built that is `docs/agent/v<N>/spec.md`. Without one, say so first: you can check the rules, but not whether the behavior is right.

`docs/agent/behavior.md` lists what the system does today. A change that breaks one of its rules, when the spec did not ask for that, is a finding.

## 1. Run the tests

| Run | It is a finding when |
|---|---|
| unit and use case tests | anything fails |
| adapter tests | anything fails |
| the journeys this change touches, and the smoke journeys | anything fails |
| the runner's timing report | a run is over its time (see "What runs when" in `tiger-verification`) |
| coverage of the changed lines, when the project has a coverage tool | a changed line that makes a decision is never run by a test |

## 2. Run the static checks

The project's own linter, formatter check, type check, build and architecture check. Any failure is a finding.

## 3. Run the rule checks

Over the lines this change added. A hit is a finding unless a tool requires that line.

```bash
git diff <base>..HEAD | grep -nE '^\+\s*(#|//|/\*|\*)'
git diff <base>..HEAD | grep -nE '^\+.*\b(def|function|func|fn) +_[a-z]'
git diff <base>..HEAD | grep -nE '^\+.*(TODO|FIXME|XXX|NotImplemented)'
git diff <base>..HEAD | grep -nE '^\+\s*(except:|except Exception|catch *\(\w*\) *\{ *\})'
git diff <base>..HEAD | grep -nE '^\+.*(@skip|\.skip\(|\bxit\(|@Ignore|t\.Skip)'
git diff <base>..HEAD | grep -nE '^\+.*\b(def|function|func|fn)\b.*(\bdict\b|\bAny\b|\bobject\b|: *any\b|interface\{\})'
```

In order: comments, underscore helpers, left-overs, swallowed errors, skipped tests, signatures with a type that says nothing.

A search finds only some of it. Then read every added line, product code and test code alike, against the numbered rules of `tiger-code-quality` and its "Instead of this, write that" table, and against every smell in the tables of `tiger-design-principles`. Each break is a medium finding: name the rule or the principle, quote the line, and say what it should be. The ones a search misses most:

- a loop hidden in a wrapped comprehension or chain, a value nested where a name belongs, a trick where a named function exists
- a function with two jobs, more than four inputs, a flag input, hidden work, or more than two levels of indentation
- a state written as a bare string, number or pair of booleans, and a bare number or string that carries a meaning
- data changed after it was built, or input checked again deep inside instead of once at the edge
- a name that is vague, shortened or negative, or two words for one thing
- code that was written before its data was designed: the types say nothing and the functions pass loose values around
- more than was asked: a limit, a check, an option or a rule the spec never named, or input checked far harder than whoever sends it can justify
- a smell from `tiger-performance`: a query or a request in a loop, a search in a loop, everything loaded to use a little, a call with no time limit
- a smell from `tiger-logging`: an error logged and passed on, a sentence glued from values, a secret or a whole record in a log line, a log line in a business rule
- a smell from `tiger-configuration`: an address, a credential or a limit written in the code, the environment read deep inside, a setting checked late

## 4. Probe it

Work on a scratch copy or a throwaway branch, so the change under review stays as it is. The copy builds into its own folder. Never point it at the project's `target/` with `CARGO_TARGET_DIR`: Cargo then keeps running the copy's build, mutants included, in the project without rebuilding it, and the project's tests pass or fail on code it does not have.

| Question | The run that answers it |
|---|---|
| Is the behavior right? | For each acceptance criterion, write the input a plausible wrong implementation would get wrong, as a test, and run it. A failing probe is a finding and the test is its proof. |
| Is every path covered? | Build the tree with `tiger-decision-tree` for each rule the change touches, from the request alone, before you read the tree in the spec's Cases section. A path with no row in the spec, or no row in a test, is a finding. Run that path to show what happens. |
| Can the tests fail? | Break one line the change added, run its tests, restore the line. If nothing failed, those tests prove nothing. |
| Is a journey flaky? | Run the browser journeys this change touches, and the smoke journeys, 10 times in a row against one running stack. A journey that fails in any run is a high finding, with that run's output. One green run proves nothing about a journey that fails one time in five. |
| Is every test needed? | Remove a test, break the rule it claims to protect, run the rest. If another test still fails, it was a duplicate. If no rule of ours could break it at all, it tests the framework. |
| Was a caller missed? | Rebuild the code map. For every function the change touched, print its direct callers, as "Read it" in `tiger-code-map` says, and search the code for its name. A caller that needed the change and is not in the diff is a finding. So is a map that changed when you rebuilt it: it was stale. |
| Was anything left behind? | In the rebuilt code map, look up everything the change added or stopped using: a new function that starts its own block and is not a real entry point is called by nothing, unless a search for its name shows it is passed as a value. Run the project's unused-code and duplicate checks too. Code, a test, a fixture or a journey with no caller and no rule to protect is a finding. So is an old version kept beside the new one. |
| Does a doc still claim something that is gone? | For everything the change removed or replaced, search `docs/agent/behavior.md`, `docs/agent/memory.md` and the "today" list in `docs/human/README.md` for its name. A line that still presents it as current is a low finding while its version is still open, because the docs are folded when it closes, and a medium finding after. When no version is open, run the docs check from `tiger-planning` too. New code that calls something marked deprecated is a finding. |
| Was something rebuilt? | Name the existing function, library or database feature, swap it in, run the tests. If they pass, the new code was not needed. |
| Is it more than was asked? | Delete the option, layer or helper, run the tests. If they pass, it was dead weight. |
| Does it hold up at real size? | Run the changed path with a realistic amount of data, and count its queries and requests. A count that grows with the data is a finding. |
| Does it fail well? | Start it with a required setting missing: it must stop at once and name the setting. Make one request fail: the log must say what failed, for which thing and why, in one error line, with no secret in it. |
| Does outside input break it? | Run the rows from "Input from outside" in `tiger-verification` against every place this change takes input. |
| Does the stack hold to the standard? | When the change touches an HTTP API, a Flutter app or containers, run every row of "Prove it" in `tiger-fullstack`. Each row that does not show what it must is a finding. So is a path, status code, error body or image rule from that skill that the diff breaks. |

## 5. Security runs

Only what this change added.

- Run the scanners the project has: gitleaks, semgrep, bandit, `npm audit`, `pip-audit`, `cargo audit`.
- Search the added lines for secrets:

```bash
git diff <base>..HEAD | grep -nEi '^\+.*(api[_-]?key|secret|passw|token|credential|private[_-]?key|connection[_-]?string)'
git diff <base>..HEAD | grep -nE '^\+.*(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
```

- Try each of these where it applies, with a real request or test, and count it only when the run shows the hole: injection into a query, shell, template or path; reaching another user's data; a secret or personal data in a response or a log; a check-then-act race; unsafe deserialization or `eval`; script injected into a page.

A real secret in the code: revoke it, rotate it, remove it from history, check the logs for use, tell the owner — in that order. If it was already pushed, the result is `blocked`.

## Result

List findings worst first, one per line, each with its proof:

```
high — src/orders/total.py:41 — rounds each line instead of the sum — python3 -m unittest tests.test_total.TotalTest.test_three_thirds → 0.99 != 1.00
```

- **high** — a wrong result, a security hole, lost data, a failing test
- **medium** — a broken rule, a test that cannot fail, a run over its time
- **low** — cosmetic

End with one line: `Review: pass`, `Review: changes` or `Review: blocked`. Pass needs every run green and no high or medium findings.
