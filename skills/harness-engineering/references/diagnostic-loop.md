# The Diagnostic Loop

From walkinglabs Lecture 01: *Why Capable Agents Still Fail*.

> When things fail, don't swap the model first — check the harness. — walkinglabs

## The Core Methodology

```
Execute → Observe Failure → Attribute to Layer → Fix That Layer → Retry
```

Never respond to a failure with "the model isn't good enough." The model didn't change — the harness has a structural defect. Find it and fix it.

## Five-Layer Attribution

Every failure maps to exactly one harness layer. If you can't attribute it, you haven't understood it.

### Layer 1: Instructions — Task Was Unclear

**Question:** Was the task unclear?

**Symptoms:**
- Agent built X but you wanted Y
- Agent followed a convention you never wrote down
- Agent used the wrong pattern because it didn't know the right one
- Agent ignored a constraint that "everyone just knows"

**Harness fix:**
- Add the missing rule to AGENTS.md
- Write a topic doc for the convention
- Add an explicit example
- Never assume the agent knows something just because "every competent developer would"

**Example:**
```
Failure: Agent used SQLAlchemy 1.x syntax in a 2.0-only project
Layer: Instructions — AGENTS.md didn't specify the ORM version
Fix: Add "All queries use SQLAlchemy 2.0 style (select() function, not Query object)" to AGENTS.md
```

### Layer 2: Environment — Runtime Was Broken

**Question:** Were there environment or config issues?

**Symptoms:**
- Module not found errors
- Wrong Python/Node version
- Missing environment variables
- Dependency conflicts
- `./init.sh` fails on fresh clone

**Harness fix:**
- Add missing dependency to pyproject.toml / package.json
- Update init.sh
- Document required env vars in .env.example
- Lock runtime version (.python-version, .nvmrc)

**Example:**
```
Failure: Agent couldn't run tests — "Module not found: pydantic"
Layer: Environment — pydantic wasn't in dependencies
Fix: Add pydantic to pyproject.toml, run pip-compile, test init.sh on fresh clone
```

### Layer 3: State — Agent Lost Context

**Question:** Was state lost between sessions?

**Symptoms:**
- Agent re-implemented a feature that already exists
- Agent didn't know about a known issue and hit it again
- Agent started from scratch discovering project structure
- Agent contradicted a decision that was made last session

**Harness fix:**
- Update progress.md more clearly
- Add the decision to DECISIONS.md
- Document known issues with root cause and fix location
- Make clock-in read ALL state files mandatory

**Example:**
```
Failure: Agent spent 10 minutes re-exploring project structure
Layer: State — progress.md was stale, codebase-map.md didn't exist
Fix: Update progress.md after every session, create docs/codebase-map.md
```

### Layer 4: Scope — Agent Overreached or Under-Finished

**Question:** Did the agent overreach or under-finish?

**Symptoms:**
- Agent fixed a bug but also refactored 3 unrelated files
- Agent implemented the happy path but left error handling as TODO
- Agent kept adding "one more thing" until context was exhausted
- Agent implemented 80% of the feature, declared done, moved on

**Harness fix:**
- Write an explicit definition of done for every feature
- Enforce WIP=1 — no "while I'm here" refactoring
- Add scope boundaries to the task description
- Ban placeholders (pass, TODO, NotImplementedError)

**Example:**
```
Failure: Agent added search feature but pagination is a stub returning pass
Layer: Scope — definition of done didn't include pagination with real data
Fix: Update completion criteria: "Pagination works with 0, 1, and 100 results"
```

### Layer 5: Verification — No Evidence

**Question:** Were there no verification methods?

**Symptoms:**
- Agent declared completion but the code doesn't work
- "Code looks right" — confidence, not correctness
- Tests were written but never ran
- Verification commands exist in AGENTS.md but agent didn't run them
- E2E test would have caught it but wasn't in scope

**Harness fix:**
- Add explicit verification commands to AGENTS.md
- Make verification part of definition of done
- Use layered pipeline: static → unit → E2E
- Record evidence — paste output, not "it passed"

**Example:**
```
Failure: Agent declared feature done but endpoint returned 500 on edge case
Layer: Verification — agent never ran the test for empty result sets
Fix: Add "pytest tests/ -x -k edge_case" to verification commands
```

## The Diagnostic Protocol

When something fails, run through these questions in order:

```
1. WHAT failed? — exact error message, expected vs actual
2. WHICH layer? — Instructions / Environment / State / Scope / Verification
3. WHAT'S the fix? — specific to the layer, applied to the harness
4. APPLY the fix — update the harness file, don't just fix the code
5. RETRY — run verification again
6. NEVER fail the same way twice — if it recurs, the layer diagnosis was wrong
```

## The Failure Log Pattern

From walkinglabs Lecture 01, Exercise 4: keep a simple failure log.

```markdown
## Failure Log

| Date | Task | Failure | Layer | Fix Applied | Recurred? |
|------|------|---------|-------|-------------|-----------|
| 2026-06-01 | Add search | Endpoint 500 on empty results | Verification | Added edge case test to `pytest tests/ -k edge_case` | No |
| 2026-06-01 | User prefs | Agent used SQLAlchemy 1.x | Instructions | Added ORM version rule to AGENTS.md | No |
```

After several rounds, you'll see which layer is the bottleneck and focus energy there.

## The Golden Rule

**If the same model succeeds on similar, well-structured tasks, assume it's a harness problem.** Nine times out of ten, the issue lives in one of the five layers — not in the model.
