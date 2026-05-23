# Session Discipline

Every session must begin with a clock-in and end with a clock-out. No "I'll clean up later."

## Clock-In (Session Start)

Execute in order:
1. Read `PROGRESS.md` — current state, in-progress, known issues, next steps
2. Read `DECISIONS.md` — past decisions with rationale
3. Run `make check` — confirm consistent state before touching anything
4. If `make check` fails, diagnose and fix BEFORE starting new work

## Clock-Out (Session End)

All items must pass. If any fail, the session is NOT complete:

```
Session Exit Checklist:
- [ ] make check passes
- [ ] PROGRESS.md updated
- [ ] DECISIONS.md updated (new architectural decisions recorded)
- [ ] All completed work committed with clean messages
- [ ] No debug code, print(), commented-out code, stale TODOs
- [ ] No temporary files, debug logs, scratch scripts
- [ ] Standard startup path works (make dev or equivalent)
- [ ] AGENTS.md updated if new conventions/commands/constraints introduced
```

## PROGRESS.md Template

```markdown
# Project Progress

## Current State
- Latest commit: <hash> (<message>)
- Test status: <N>/<M> passing
- Lint: <passing/failing>
- Type check: <passing/failing>

## Completed
- [x] <Feature — done, verified, committed>

## In Progress
- [ ] <Current task> (<X>% — <what's remaining>)

## Known Issues
- <Bug/issue and context>

## Next Steps (ordered)
1. <Next action>
2. <Following action>
```

## DECISIONS.md Template

Record every architectural decision that another session might question:

```markdown
## Decision: <title>
- Date: <YYYY-MM-DD>
- Context: <what problem>
- Decision: <what we chose>
- Alternatives rejected: <what and why>
- Commit: <hash>
```
