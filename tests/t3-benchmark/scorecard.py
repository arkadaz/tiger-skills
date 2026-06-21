#!/usr/bin/env python3
"""Post-hoc scorecard collector for Tiger T3 benchmark runs.

Usage: scorecard.py <project_dir> <version>
Prints a JSON scorecard to stdout.
"""
import json
import pathlib
import re
import subprocess
import sys
from datetime import datetime, timezone


def run_git(project_dir, *args):
    result = subprocess.run(
        ["git", "-C", project_dir] + list(args),
        capture_output=True, text=True, check=False
    )
    return result.stdout.strip()


def collect_scorecard(project_dir, version, feature_id=None):
    project = pathlib.Path(project_dir)

    # Read final board state
    board = json.loads((project / "feature_list.json").read_text())
    features = board.get("features", {})
    # Feature id: explicit arg wins, else discover from the board (current_feature, then the
    # single in_progress feature). Keeps the scorecard golden-project-agnostic.
    if not feature_id:
        feature_id = board.get("current_feature")
    if not feature_id:
        in_progress = [k for k, v in features.items() if v.get("status") == "in_progress"]
        feature_id = in_progress[0] if len(in_progress) == 1 else None
    if not feature_id and len(features) == 1:
        feature_id = next(iter(features))  # closed board (passing): fall back to the sole feature
    if not feature_id or feature_id not in features:
        raise SystemExit(f"cannot resolve feature id in {project_dir}/feature_list.json (got {feature_id!r})")
    feature = features[feature_id]

    final_phase = feature.get("phase", "unknown")
    completed = final_phase == "passing"

    # Commits on the feature branch since it diverged from the main trunk. v2 is
    # trunk-based on `main`; the old `develop..HEAD` range silently resolved to nothing
    # (no develop branch) and zeroed commit_count / elapsed / gate_first_pass_rate.
    log_out = run_git(project_dir, "log", "main..HEAD", "--format=%H %aI")
    commit_lines = [line for line in log_out.splitlines() if line.strip()]
    commit_count = len(commit_lines)

    # Elapsed seconds: first to last commit timestamp
    elapsed_seconds = 0
    if len(commit_lines) >= 2:  # 0 if only one commit — no interval to measure
        newest_ts = commit_lines[0].split(" ", 1)[1]
        oldest_ts = commit_lines[-1].split(" ", 1)[1]
        fmt = "%Y-%m-%dT%H:%M:%S%z"
        try:
            newest = datetime.strptime(newest_ts[:19] + newest_ts[19:].replace(":", ""), fmt)
            oldest = datetime.strptime(oldest_ts[:19] + oldest_ts[19:].replace(":", ""), fmt)
            elapsed_seconds = int((newest - oldest).total_seconds())
        except ValueError:
            elapsed_seconds = 0

    # Read git notes for all commits
    commit_hashes = [l.split()[0] for l in commit_lines]
    gate_notes = []  # list of {"ref": ..., "grade": ..., "commit": ...}
    for commit in commit_hashes:
        for ref in ("security", "review", "e2e"):
            note_text = run_git(project_dir, "notes", f"--ref={ref}", "show", commit)
            if not note_text:
                continue
            grade = None
            for line in note_text.splitlines():
                line = line.strip()
                if line.startswith("grade:"):
                    grade = line.split(":", 1)[1].strip()
                    break
            if grade in ("pass", "changes", "blocked"):
                gate_notes.append({"ref": ref, "grade": grade, "commit": commit})

    gate_total = len(gate_notes)
    gate_pass = sum(1 for n in gate_notes if n["grade"] == "pass")
    gate_changes = sum(1 for n in gate_notes if n["grade"] == "changes")
    blocked_count = sum(1 for n in gate_notes if n["grade"] == "blocked")
    gate_first_pass_rate = round(gate_pass / gate_total, 2) if gate_total else 0.0

    # rounds_to_pass: distinct commits where any in-loop gate returned changes. v2's only
    # in-loop gate is e2e (security/review are standalone now), so e2e MUST be counted or a
    # feature that legitimately needed e2e fix-up rounds always reports 0.
    fixup_commits = {
        n["commit"] for n in gate_notes
        if n["grade"] == "changes" and n["ref"] in ("e2e", "security", "review")
    }
    rounds_to_pass = len(fixup_commits)

    # Artifacts complete
    feature_dir = project / "tiger" / "features" / feature_id
    artifacts_complete = all([
        (feature_dir / "spec.html").exists(),
        (feature_dir / "adr.html").exists(),
        (feature_dir / "business.html").exists(),
        (feature_dir / "e2e_testcases.robot").exists(),
    ])

    # Stages passed (inferred from board tasks + gate notes + phase)
    tasks = feature.get("tasks", [])
    stages_passed = []
    if tasks:
        stages_passed.append("architect")
    if any(t.get("status") == "done" for t in tasks):
        stages_passed.append("code-generator")
    if any(n["ref"] == "security" and n["grade"] == "pass" for n in gate_notes):
        stages_passed.append("security")
    if any(n["ref"] == "review" and n["grade"] == "pass" for n in gate_notes):
        stages_passed.append("reviewer")
    if any(n["ref"] == "e2e" and n["grade"] == "pass" for n in gate_notes):
        stages_passed.append("e2e")
    if final_phase == "passing":
        stages_passed.append("update-docs")

    # e2e bug-priority breakdown + Playwright screenshot count — the real "clickable
    # verified" signal a bare pass/fail score hides. Blockers come from the e2e note's
    # "blockers: high=.. medium=.. low=.." line; screenshots are the PNGs the Browser-library
    # keywords captured while driving the live UI (proof the buttons were actually clicked).
    e2e_blockers = {"high": 0, "medium": 0, "low": 0}
    for commit in commit_hashes:
        note_text = run_git(project_dir, "notes", "--ref=e2e", "show", commit)
        m = re.search(r"blockers:\s*high=(\d+)\s+medium=(\d+)\s+low=(\d+)", note_text)
        if m:
            e2e_blockers = {"high": int(m.group(1)), "medium": int(m.group(2)), "low": int(m.group(3))}
            break

    evidence_dir = project / "tiger" / "features" / feature_id / "evidence"
    e2e_screenshots = len(list(evidence_dir.glob("*.png"))) if evidence_dir.exists() else 0

    return {
        "version": version,
        "run_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "feature_id": feature_id,
        "completed": completed,
        "final_phase": final_phase,
        "rounds_to_pass": rounds_to_pass,
        "blocked_count": blocked_count,
        "stages_passed": stages_passed,
        "gate_first_pass_rate": gate_first_pass_rate,
        "commit_count": commit_count,
        "elapsed_seconds": elapsed_seconds,
        "artifacts_complete": artifacts_complete,
        "e2e_blockers": e2e_blockers,
        "e2e_screenshots": e2e_screenshots,
        "notes": {}
    }


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print(f"Usage: {sys.argv[0]} <project_dir> <version> [feature_id]", file=sys.stderr)
        sys.exit(1)
    feature_id = sys.argv[3] if len(sys.argv) == 4 else None
    scorecard = collect_scorecard(sys.argv[1], sys.argv[2], feature_id)
    print(json.dumps(scorecard, indent=2))
