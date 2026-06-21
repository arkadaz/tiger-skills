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

1. GRILL FIRST. For any new feature, user-visible/business behavior change, integration, or ambiguous request, you MUST invoke the `tiger-skills:tiger-grill` skill and interview the human ONE question at a time (dig deep — ask more, not fewer). No planning and no code until the human explicitly approves the grill artifact SET — spec.html, adr.html, business.html, and the Robot Framework e2e_testcases.robot suite (the build reads all four; e2e runs the robot suite). On approval the three HTML files carry <meta name="tiger-status" content="approved"> and e2e_testcases.robot carries '# tiger-status: approved'; spec.html is the canonical gate the architect re-checks.
2. SKILLS + WORKFLOW. The seven stages are skills (tiger-grill, tiger-architect, tiger-code-generator, tiger-security, tiger-reviewer, tiger-e2e, tiger-update-docs). Invoke one directly for a single stage, or run the installed `/tiger-workflow-dev` workflow for the full build — it spawns architect -> (parallel code generators in isolated worktrees -> integrate){per dependency wave} -> e2e (single quality gate, runs once after all waves) -> update-docs. tiger-security and tiger-reviewer are standalone on-demand skills, not in the automated loop. Never inline a stage in the main session; grill is the one deliberate inline step (a subagent cannot interview the human).
3. WIP=1. Only one feature may be `in_progress` in feature_list.json.
4. GIT BOUNDARY. Work on `feature/<id>` branched off main; never push directly to main; never merge MRs — the human squash-merges.
5. EVIDENCE. Never mark a task, criterion, or feature done without fresh verification output.

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
