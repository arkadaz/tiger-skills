# The Minimal Harness Pack

From walkinglabs Resource Library. Four files that form the minimum viable harness. A project without these has no harness.

> Information not in the repo, for all practical purposes, does not exist for the agent. — walkinglabs, Lecture 03

## The Four Files

| File | Subsystem | Purpose |
|------|-----------|---------|
| `AGENTS.md` | Instructions | Startup path, working rules, definition of done |
| `feature_list.json` | State, Scope | Machine-readable feature tracking with state machine |
| `progress.md` | State | Session log — what happened, what's next, known issues |
| `init.sh` | Environment, Verification | Install + verify + start — the standard startup path |

---

## 1. AGENTS.md Template

The agent's operating manual. Keep under 150 lines — it's a router, not an encyclopedia.

```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what this project is, primary technology stack, architectural style]

## Quick Start
- `./init.sh` — install dependencies, run baseline verification
- [Any other first-run commands]

## Working Rules
1. Work on only one feature at a time.
2. Don't mark a feature complete just because code was written — verification must run.
3. Keep changes within the selected feature scope unless a blocker forces a narrow supporting fix.
4. Do not silently change verification rules during implementation.
5. Prefer durable repo artifacts over chat summaries.

## Definition of Done
A feature is complete only when:
1. The target behavior is implemented.
2. The required verification actually ran (fresh output from THIS session).
3. Evidence is recorded in `feature_list.json` or `progress.md`.
4. The repository remains restartable from `./init.sh`.

## Required Artifacts
- `feature_list.json` — source of truth for feature state
- `progress.md` — session log and current verified status
- `init.sh` — standard startup and verification path

## Verification Commands
- Install: [command]
- Tests: [command]
- Type check: [command]
- Lint: [command]
- Full check: [command that runs all of the above]

## Directory Map
```
src/          — [purpose]
tests/        — [purpose]
docs/         — [purpose]
```

## Hard Constraints
- [Non-negotiable rule 1]
- [Non-negotiable rule 2]
- [Non-negotiable rule 3]
```

---

## 2. feature_list.json Template

Machine-readable feature state. The source of truth for what's done and what's next.

```json
{
  "project": "replace-with-project-name",
  "last_updated": "YYYY-MM-DD",
  "rules": {
    "single_active_feature": true,
    "passing_requires_evidence": true,
    "do_not_skip_verification": true
  },
  "status_legend": {
    "not_started": "Work has not begun.",
    "in_progress": "The feature is the current active task.",
    "blocked": "Work cannot continue until a documented blocker is resolved.",
    "passing": "Required verification has passed and evidence is recorded."
  },
  "features": [
    {
      "id": "feature-001",
      "priority": 1,
      "area": "[domain-area]",
      "title": "[Feature title]",
      "user_visible_behavior": "[What the user sees — include happy path AND error cases]",
      "status": "not_started",
      "verification": [
        "[Step 1 — specific action to verify]",
        "[Step 2]"
      ],
      "evidence": [],
      "notes": ""
    }
  ]
}
```

### Feature State Machine

```
not_started → in_progress → passing
                  ↓
               blocked
```

**Only four states.** Agents cannot self-declare `passing` — verification must run and pass.

**State transitions:**
- `not_started` → `in_progress`: Agent claims the task. WIP=1 check must pass.
- `in_progress` → `passing`: Verification command MUST succeed. Evidence required.
- `in_progress` → `blocked`: External blocker. Document what's blocking and why.
- `blocked` → `in_progress`: Blocker resolved. Re-check WIP=1.

### The Three Required Fields Per Feature

1. **behavior** (`user_visible_behavior`) — What the feature does, in plain language. Include happy path AND error cases.
2. **verification** — Specific steps to prove the feature works. Not "run the tests" — specific actions with expected outcomes.
3. **state** — Exactly one of: `not_started`, `in_progress`, `blocked`, `passing`.

Missing any one = incomplete specification.

---

## 3. progress.md Template

Session log. Updated every session. The next session reads this first.

```markdown
# Claude Progress

## Current State
- **Latest commit:** [hash] ([message])
- **Branch:** [name]
- **Verification:** [passing/failing] (`./init.sh`)
- **Last updated:** YYYY-MM-DD HH:MM UTC

## Completed
- [x] [Feature title] — commit [hash], YYYY-MM-DD
- [x] [Feature title] — commit [hash], YYYY-MM-DD

## In Progress
- [ ] [Feature title] ([N]% — [what remains])
  - **Active since:** YYYY-MM-DD
  - **Blocked by:** [nothing / specific blocker]

## Known Issues
- [Issue description]
  - **Discovered:** YYYY-MM-DD
  - **Root cause:** [analysis]
  - **Fix location:** `file:line`

## Next Steps (ordered by priority)
1. [Next thing to work on]
2. [After that]
3. [After that]
```

### Key Principles

1. **Current State is verifiable** — verification status isn't an opinion, it's the output of `./init.sh`
2. **In Progress has a percentage** — not "working on it," but "85%, edge case failing"
3. **Known Issues have root cause** — not "it's broken," but "offset overflow when total=0, fix at api.py:45"
4. **Next Steps are ordered** — the top item is what the next session starts with

---

## 4. init.sh Template

Standard startup path. Install + verify + (optionally) start.

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Define commands — customize these for your project
INSTALL_CMD=(npm install)          # or: pip install -e ".[dev]"
VERIFY_CMD=(npm test)              # or: pytest tests/ -x
START_CMD=(npm run dev)            # or: python -m uvicorn src.main:app

echo "==> Working directory: $PWD"

echo "==> Syncing dependencies"
"${INSTALL_CMD[@]}"

echo "==> Running baseline verification"
"${VERIFY_CMD[@]}"

echo "==> Startup command"
printf '    %q' "${START_CMD[@]}"
printf '\n'

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
    echo "==> Starting the app"
    exec "${START_CMD[@]}"
fi

echo "Set RUN_START_COMMAND=1 if you want init.sh to launch the app directly."
```

### Requirements for init.sh

1. **Must work from a fresh clone** — no assumptions about installed tools beyond the language runtime
2. **Must verify baseline** — if `./init.sh` fails, the repo is broken. Fix before building.
3. **Must be executable** — `chmod +x init.sh`
4. **Must be configuration-free** — no env vars needed just to run verification

---

## The Cold-Start Test

From walkinglabs Lecture 03. A fresh agent session with ONLY the repo must be able to answer:

1. **What is this system?** — 2-3 sentences, primary technology
2. **How is it organized?** — directory map, module boundaries
3. **How do I run it?** — `./init.sh` works from scratch
4. **How do I verify it?** — verification commands are explicit and runnable
5. **What are the hard constraints?** — rules that must never be broken

If a fresh session cannot answer all five from the repo alone within 2 minutes, the harness is incomplete.
