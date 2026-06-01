# Session Lifecycle

From walkinglabs Lectures 05, 06, and 12: *Why Long-Running Tasks Lose Continuity*, *Why Initialization Needs Its Own Phase*, *Why Every Session Must Leave a Clean State*.

> The next session's success depends on this session's cleanup. — walkinglabs, Lecture 12

## The 16-Step Agent Lifecycle

From walkinglabs. Every coding agent session should follow this sequence:

```
 1. Agent reads AGENTS.md / CLAUDE.md
 2. Agent runs ./init.sh (install, verify, health check)
 3. Agent reads progress.md (previous session state)
 4. Agent reads feature_list.json (done vs. next)
 5. Agent checks git log (recent changes)
 6. Agent picks exactly ONE unfinished feature
 7. Agent works only on that feature
 8. Agent implements the feature
 9. Agent runs verification (tests, lint, type-check)
10. If verification fails: fix and re-run
11. If verification passes: record evidence
12. Agent updates progress.md
13. Agent updates feature_list.json
14. Agent records what's still broken or unverified
15. Agent commits (only when safe to resume)
16. Agent leaves clean restart path for next session
```

## Clock-In (Session Start)

Execute in strict order. **READ means open and read the full content.**

### Step 1: Read State Files

1. **`AGENTS.md` or `CLAUDE.md`** — HOW to work in this codebase: conventions, constraints, verification commands
2. **`progress.md`** — WHERE the project is: completed, in-progress, known issues, next steps
3. **`feature_list.json`** — WHAT to work on: highest-priority `not_started` feature
4. **`git log --oneline -5`** — what changed recently

### Step 2: Run ./init.sh

Confirm the environment is healthy. If baseline verification fails:
- Diagnose BEFORE starting new work
- If pre-existing: document in progress.md Known Issues
- If regression: fix before proceeding — never build on a broken foundation
- If can't fix within 10 minutes: mark feature `blocked`

### Step 3: Announce Understanding

```
Clock-in complete.
Project state: [summary from progress.md]
Current task: [feature ID from feature_list.json]
Known issues: [from progress.md]
```

**This announcement is mandatory.** It proves the agent read the files, not just checked they exist.

## The Anti-Pattern: "Create and Forget"

The most common agent failure: bootstrap creates missing files → agent immediately starts coding without reading ANY state. This agent:
- Re-implements features already done (didn't read progress.md)
- Contradicts decisions made last session (didn't read git log)
- Breaks existing flows (didn't understand project state)
- Builds the wrong thing (didn't read feature_list.json)

**The fix:** Clock-in is not optional. Reading is not optional. The announcement is not optional.

## Clock-Out (Session End)

All 8 items must pass. If any fails, the session is NOT complete.

```
Session Exit Checklist:
- [ ] ./init.sh passes (install + verify) — fresh clone must be runnable
- [ ] progress.md updated — completed marked, in-progress accurate, next steps clear
- [ ] feature_list.json updated — feature states accurate, evidence recorded
- [ ] All work committed with clean, descriptive messages
- [ ] No debug code, print(), commented-out code, or stale TODOs in the diff
- [ ] No temporary files, debug logs, scratch scripts in working tree
- [ ] Standard startup path works (./init.sh from clean state)
- [ ] Next session can start without guessing — all state files are current
```

### What Each Item Means

1. **./init.sh passes:** Run the full verification suite. If any test fails, you're not done.
2. **progress.md updated:** The next session must see exactly where you left off.
3. **feature_list.json updated:** Features marked `passing` with evidence.
4. **Clean commits:** Each commit = one logical change. Message = what AND why. No "WIP" commits.
5. **No debug artifacts:** `print()`, `console.log`, `# TODO`, `# FIXME` — all removed or converted.
6. **No temporary files:** `test_output.json`, `debug.log`, `scratch.py` — delete them.
7. **Startup works:** `./init.sh` from a clean state must pass.
8. **Next session ready:** A fresh agent reading state files knows exactly what to do next.

## Why Initialization Needs Its Own Phase

From walkinglabs Lecture 06. Separating setup from execution prevents the agent from burning context on environment issues.

**Without a separate init phase:** Agent starts task → hits missing dependency → spends 10% of context on `pip install` errors → rushes to finish → skips verification.

**With a separate init phase:** Agent runs `./init.sh` first → environment is validated independently → context window is fully available for the actual work.

## Cross-Session Continuity

From walkinglabs Lecture 05. "Agents without persistent state see failure rates spike sharply on tasks exceeding 30 minutes."

**The state files bridge the gap:**
- `progress.md` → what happened, what's next
- `feature_list.json` → what's done, what's active
- git log → what changed, when, by whom
- `session-handoff.md` (optional) → compact handoff for multi-session features

**Without state files:** Every session is a cold start. The agent re-discovers project structure, re-understands code organization, potentially re-implements features. 30-50% of context is wasted on re-discovery.

**With state files:** A new session is productive within 3 minutes.
