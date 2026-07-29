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

1. GRILL FIRST. For any new feature, user-visible/business behavior change, integration, or ambiguous request, you MUST invoke the `tiger-skills:tiger-grill` skill and interview the human ONE question at a time (dig deep — ask more, not fewer; every requirement pinned to a number or named entity). Grill writes TWO markdown docs: `tiger/features/<id>/spec.md` — the DETAILED agent-facing requirements (exact FRs with worked examples, business rules with real values, an errors-and-edge-cases table, testable acceptance criteria) — and `feature.md` — the one-page human summary carrying the gate token. Grill writes NO e2e files (the lead authors the suite from spec.md). No planning and no code until the human explicitly approves. On approval grill flips the `feature.md` frontmatter line `tiger-status: awaiting_review` → `tiger-status: approved` — that exact line is the gate the lead re-checks.
2. SKILLS + WORKFLOW. The stages are skills (tiger-grill, tiger-lead, tiger-code-generator, tiger-update-docs; plus the standalone tiger-review quality+security gate). Invoke one directly, or run the installed `/tiger-workflow-dev` workflow for the full build. **The workflow is the CONDUCTOR — it spawns every agent itself** (deterministically — so every step is guaranteed and each agent's context stays bounded to one phase; nested subagents DO work in Claude Code v2.1.172+, orchestration just stays in the workflow so a large-feature lead never forgets a step). Two roles: the CODERS build, the ARCHITECT merges. It spawns: lead PLAN (discovers + gates the newest approved feature itself — no bootstrap spawn; recons ONCE, writes tasks[] whose context packets inline the exact existing code to REUSE, AUTHORS the whole e2e layer — cases AND keyword bodies — before any code exists, with an ABUSE corpus in every trust-boundary packet, and returns dependency WAVES of file-disjoint tasks) -> per wave: concurrent tiger-code-generator coders, one task each, in isolated git worktrees, code+tests only on their own branch (the lead's E2E-PROVISION spawn already made the Robot/Playwright runtime ready beside PLAN) -> lead INTEGRATE after each non-final wave (cherry-picks that wave onto feature/<id>, re-runs the project verification, audits the diff for reuse/comments/scope/dead code, repairs the packet of any failed task and re-queues it once, records tasks[].status) -> lead VERIFY (merges the final wave, then runs the Robot suites for real — the WHOLE `tiger/features/` folder, every feature, as a regression, Playwright for UI — the SINGLE in-loop quality gate, extending the suite as risks surface, triaging by priority: HIGH/MEDIUM block, a regression in a shipped feature is HIGH, LOW logged; on CHANGES it writes delta tasks with repaired packets and the workflow rebuilds them, bounded by a round cap and a no-progress detector) -> on a clean pass update-docs to ff-merge to dev. A coder NEVER writes feature_list.json/progress.md/notes — the architect records the board after the merge. tiger-review is a standalone on-demand skill, not in the loop. Never inline a stage; grill is the one deliberate inline step (a subagent cannot interview the human).
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
