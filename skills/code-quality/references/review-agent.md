# Independent Code Review

After implementing any non-trivial change, a SEPARATE review agent MUST audit the code. The agent that wrote the code cannot be the sole judge of its quality.

## When Required

- A new class or module is created
- A function longer than 15 lines is added or modified
- A new API endpoint or public interface is introduced
- Code touches shared infrastructure (database, auth, config)
- The change spans 3+ files

Skip only for: single-line fixes, typos, or config value changes.

## How the Review Works

1. Implementation agent finishes: code written, lint clean, type check clean, tests pass.
2. Spawn a review agent using the Agent tool. The review agent reads the code-quality SKILL.md and audits the diff against all 19 audit checklist items.
3. Review agent saves findings to `docs/reviews/YYYY-MM-DD-<topic>-review.md`.
4. Implementation agent addresses every finding before marking the feature `passing`.
5. If the review finds architectural issues (SRP/OCP violations, missing interfaces), the implementation agent MUST fix them — not just note them.

## Review Report Template

```markdown
# Code Review: <feature/task>

## Summary
- Reviewed by: <agent>
- Files reviewed: <list>
- Pass rate: <N>/<19 audit items>

## Violations Found
### <Violation>
- File: `src/module/file.py:123`
- Rule: <which audit item>
- Problem: <specific issue>
- Fix: <what to do>

## Approved With Changes
- <item> — addressed in commit <hash>
```

## Review Agent Prompt

When spawning the review agent, use this structure:

```
You are a code review agent. Read the code-quality skill at <path>.
Audit the files at <list of changed files> against all 19 audit checklist items.
For each violation, cite the file, line, and which rule it breaks.
Save the review to docs/reviews/<date>-<topic>-review.md.
The implementation agent will address your findings — do NOT modify the code yourself.
```

Do NOT skip review because "the code looks fine." The review agent provides an independent check — it often catches issues the implementation agent missed.
