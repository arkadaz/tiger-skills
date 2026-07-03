#!/usr/bin/env bash
# SessionStart hook for the Tiger Development Kit plugin.
#
# Injects the grill-first operating contract into context at the start of every
# session — but ONLY when the current working directory is a Tiger-managed
# project (detected by the presence of feature_list.json). In any other project
# the hook stays silent, so a user who enables the plugin globally does not get
# Tiger instructions bleeding into unrelated repos.
#
# This is the channel that makes the protocol deterministically PRESENT each
# session. A project CLAUDE.md is easy to forget or omit; this ships with the
# plugin, so every colleague gets identical behavior without copying anyone's
# personal global config.

set -euo pipefail

# Only speak inside a Tiger project. feature_list.json is the canonical marker
# written at adoption time.
[ -f "feature_list.json" ] || exit 0

# python3 backs the rm guard and the validator too; if it is somehow missing,
# fail open (silent) rather than breaking the session.
command -v python3 >/dev/null 2>&1 || exit 0

CONTRACT="$(cat <<'EOF'
<EXTREMELY_IMPORTANT>
This is a Tiger Development Kit project. The grill-first protocol is mandatory and overrides any default "just start coding" behavior:

1. GRILL FIRST. For any new feature, user-visible/business behavior change, integration, or ambiguous request, you MUST invoke the `tiger-skills:tiger-grill` skill and interview the human ONE question at a time (dig deep — ask more, not fewer). Grill writes ONE merged markdown doc `tiger/features/<id>/feature.md` (problem + spec + decisions + business context) plus a BROAD Robot Framework `e2e_testcases.robot` suite (many cases per dimension, each tagged one priority). No planning and no code until the human explicitly approves. On approval grill flips the `feature.md` frontmatter line `tiger-status: awaiting_review` → `tiger-status: approved` — that exact line is the gate the lead re-checks.
2. SKILLS + WORKFLOW. The stages are skills (tiger-grill, tiger-lead, tiger-code-generator, tiger-update-docs; plus standalone tiger-security, tiger-reviewer). Invoke one directly, or run the installed `/tiger-workflow-dev` workflow for the full build. **The workflow is the CONDUCTOR — it spawns every agent itself**, because a subagent cannot spawn its own subagents (nesting is capped at one level). It spawns: bootstrap -> lead PLAN (recon + board tasks[], returns dependency WAVES of file-disjoint tasks) -> builds each wave with tiger-code-generator coders (file-disjoint tasks concurrent in isolated worktrees + an integrator; a 1-task wave builds solo, committing on feature/<id>) -> lead VERIFY (authors the e2e keyword layer and runs the Robot suites for real — the WHOLE `tiger/features/` folder, every feature, as a regression, Playwright for UI — the SINGLE in-loop quality gate, appending `source:e2e` cases, triaging by priority: HIGH/MEDIUM block, a regression in a shipped feature is HIGH, LOW logged; on CHANGES it writes the delta tasks and the workflow rebuilds them, bounded) -> on a clean pass update-docs to ff-merge to dev. tiger-security and tiger-reviewer are standalone on-demand skills, not in the loop. Never inline a stage; grill is the one deliberate inline step (a subagent cannot interview the human).
3. WIP=1. Only one feature may be `in_progress` in feature_list.json.
4. GIT BOUNDARY. Work on `feature/<id>` branched off `dev` (the integration trunk). The workflow fast-forward merges the finished feature to `dev`. NEVER touch `main` — it is the protected release branch; `dev` -> `main` is a manual human step the kit never performs.
5. SIMPLE, COMMENT-FREE CODE. Generators build with TDD (RED -> GREEN -> SIMPLIFY -> re-verify -> commit) and write NO comments — names and small functions carry meaning; the simplify pass strips dead code and all comments while tests stay GREEN.
6. EVIDENCE. Never mark a task, criterion, or feature done without fresh verification output.

Before acting, read CLAUDE.md and feature_list.json. The full protocol lives in CLAUDE.md and the stage skills.
</EXTREMELY_IMPORTANT>
EOF
)"

# Build the response with json.dumps so escaping is always correct. Claude Code
# reads hookSpecificOutput.additionalContext; other SDK platforms read a
# top-level additionalContext.
CONTRACT="$CONTRACT" python3 - <<'PY'
import json
import os

ctx = os.environ.get("CONTRACT", "")
if os.environ.get("CLAUDE_PLUGIN_ROOT") and not os.environ.get("COPILOT_CLI"):
    out = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": ctx}}
else:
    out = {"additionalContext": ctx}
print(json.dumps(out))
PY

exit 0
