---
name: harness-engineering-session
description: Session clock-in and clock-out discipline — read all state files at start, update all state files at end, leave a clean restart path. Use when starting or ending any coding session.
---

# Session Discipline

From walkinglabs Lectures 05, 06, and 12. Every session must begin with a clock-in and end with a clock-out. There is no "I'll clean up later."

> The next session's success depends on this session's cleanup. — walkinglabs, Lecture 12

## Clock-In Protocol

Execute in strict order. **READ means open and read the full content** — not "check if it exists."

### 1. Read AGENTS.md / CLAUDE.md

HOW to work in this codebase. Conventions, hard constraints, architecture rules, topic doc links.

### 2. Read progress.md

WHERE the project is. Completed items, in-progress items, known issues, next steps.

### 3. Read feature_list.json

WHAT to work on. Check for `in_progress` features (WIP=1 check). Pick highest-priority `not_started` if none active.

### 4. Review git log

`git log --oneline -5` — what changed recently, by whom, in what order.

### 5. Run ./init.sh

Confirm environment is healthy. If it fails:
- Pre-existing failure → document in progress.md Known Issues
- Regression → fix before proceeding. Never build on broken foundation.
- Can't fix in 10 minutes → mark feature `blocked`

### 6. Announce Understanding (MANDATORY)

```
Clock-in complete.
Project state: [summary]
Current task: [feature ID and title]
Known issues: [list from progress.md]
```

**This announcement proves the agent actually read the files.**

## The "Create and Forget" Anti-Pattern

Bootstrap creates files → agent immediately starts coding without reading ANY of them. This agent:
- Re-implements existing features (didn't read progress.md)
- Contradicts locked decisions (didn't read git log)
- Builds the wrong thing (didn't read feature_list.json)
- Breaks conventions (didn't read AGENTS.md)

**Clock-in is not optional. Reading is not optional. Announcing is not optional.**

## Mid-Session State Updates

After every commit or significant progress:

1. Update `progress.md` — progress %, what was done
2. Update `feature_list.json` evidence — record verification output
3. Commit with descriptive message — what AND why

Don't batch all state updates to the end. Update after each logical unit of work.

## Clock-Out Protocol

All 8 items must pass:

```
Session Exit Checklist:
- [ ] ./init.sh passes — install + verify from clean state
- [ ] progress.md updated — completed marked, in-progress accurate, next steps clear
- [ ] feature_list.json updated — feature states accurate, evidence recorded
- [ ] All work committed — clean, descriptive messages, no "WIP" commits
- [ ] No debug artifacts — no print(), console.log, # TODO, # FIXME
- [ ] No temporary files — delete debug.log, temp_*.csv, scratch.py
- [ ] Standard startup works — ./init.sh from fresh clone
- [ ] Next session ready — a fresh agent reading state files knows exactly what to do
```

### Exit Checklist Detail

**./init.sh passes:** Run it fresh. If any test fails, you're not done.

**progress.md updated:** The next session must see exactly where you left off. Update: completed items, in-progress (% + what remains), known issues (add new, remove fixed), next steps (reorder by priority).

**feature_list.json updated:** Features marked `passing` with evidence. `in_progress` features have accurate status.

**Clean commits:** Each commit = one logical change. Message = `type: what changed, why`. No "WIP" or "fixes" commits. Squash messy intermediate commits.

**No debug artifacts:** Remove `print()`, `console.log`, `debugger` statements, `# TODO`, `# FIXME`. Convert to proper logging or tickets.

**No temporary files:** Delete `test_output.json`, `debug.log`, `scratch.py`. If useful, make it a proper test fixture or doc.

**Startup works:** `./init.sh` from clean state must pass. If you added a dependency, verify it's in the lock file. If you added an env var, update `.env.example`.

**Next session ready:** Someone (or some agent) starting fresh reads progress.md, knows exactly what's done, what's next, and what to avoid. No guessing.
