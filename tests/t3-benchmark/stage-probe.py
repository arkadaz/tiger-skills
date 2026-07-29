#!/usr/bin/env python3
"""One-line snapshot of a Tiger bench repo's DURABLE state — the v10 stage tracker.

Usage: stage-probe.py <bench_dir> <feature_id>

`claude -p` buffers its own stdout, so the console can look frozen while the pipeline is
hard at work. This probe reads what is on DISK and in GIT instead (authoritative, whatever
the CLI is buffering) and prints ONE line the benchmark's poller diffs every few seconds:

  stage=BUILD phase=build tasks=1/3 ac=0/4 coders=3(w1:3) wt=4 e2e=cases+kw ev=- note=- head=1a2b3c feat(calc): add

Every v10 stage leaves a distinct durable trace, so the stage is inferred, never guessed:
  PLAN      board tasks[] appear + e2e_testcases.robot committed
  BUILD     per-task coder branches feature/<id>-r<round>w<wave>-<task> + extra worktrees
  HARNESS   e2e_keywords.resource appears (authored in parallel with the first wave)
  INTEGRATE a `wave N — integrate` commit lands on feature/<id>
  VERIFY    tiger/evidence/output.xml appears; refs/notes/e2e gets a grade
  FINALIZE  board phase/status passing, docs close-out commit, dev advanced
"""
import json
import pathlib
import re
import subprocess
import sys


def git(bench, *args):
    try:
        r = subprocess.run(["git", "-C", str(bench)] + list(args),
                           capture_output=True, text=True, check=False, timeout=20)
        return r.stdout.strip()
    except Exception:
        return ""


def board_state(bench, fid):
    try:
        data = json.loads((pathlib.Path(bench) / "feature_list.json").read_text(encoding="utf-8"))
    except Exception:
        return "?", "?/?", "?/?"
    f = (data.get("features") or {}).get(fid) or {}
    tasks = f.get("tasks") or []
    acs = f.get("acceptance_criteria") or []
    done = sum(1 for t in tasks if isinstance(t, dict) and t.get("status") == "done")
    acdone = sum(1 for c in acs if isinstance(c, dict) and c.get("status") == "done")
    return f.get("phase", "?"), f"{done}/{len(tasks)}", f"{acdone}/{len(acs)}"


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <bench_dir> <feature_id>", file=sys.stderr)
        return 1
    bench, fid = sys.argv[1], sys.argv[2]
    root = pathlib.Path(bench)

    phase, tasks, acs = board_state(bench, fid)

    branches = [b.strip().lstrip("* ").strip()
                for b in git(bench, "branch", "--list", f"feature/{fid}-r*w*-*").splitlines() if b.strip()]
    per_wave = {}
    for b in branches:
        m = re.search(r"-(r\d+w\d+)-", b)
        per_wave.setdefault(m.group(1) if m else "?", 0)
        per_wave[m.group(1) if m else "?"] += 1
    coders = f"{len(branches)}" + (
        "(" + ",".join(f"{k}:{v}" for k, v in sorted(per_wave.items())) + ")" if per_wave else "")

    worktrees = len([l for l in git(bench, "worktree", "list").splitlines() if l.strip()])

    fdir = root / "tiger" / "features" / fid
    e2e = "+".join(filter(None, [
        "cases" if (fdir / "e2e_testcases.robot").exists() else "",
        "kw" if (fdir / "e2e_keywords.resource").exists() else "",
        "journal" if (fdir / "verify_notes.md").exists() else "",
    ])) or "-"

    evdir = root / "tiger" / "evidence"
    if not evdir.exists():
        evdir = fdir / "evidence"
    shots = len(list(evdir.rglob("*.png"))) if evdir.exists() else 0
    ev = "-" if not evdir.exists() else f"xml{'+' if (evdir / 'output.xml').exists() else '-'}png{shots}"

    head_line = git(bench, "log", "-1", "--format=%h %s") or "<no commit>"
    head_sha = head_line.split(" ", 1)[0]
    head_msg = head_line.split(" ", 1)[1] if " " in head_line else ""
    subjects = git(bench, "log", "--format=%s", f"{git(bench, 'rev-parse', '--verify', 'dev') and 'dev'}..HEAD") \
        if git(bench, "rev-parse", "--verify", "dev") else ""

    note = "-"
    for sha in [l.split()[0] for l in git(bench, "log", "-8", "--format=%H").splitlines() if l.strip()]:
        text = git(bench, "notes", "--ref=e2e", "show", sha)
        m = re.search(r"grade:\s*(\w+)", text or "")
        if m:
            note = m.group(1)
            break

    integrated = len(re.findall(r"integrate", subjects or "", re.I))
    # Order matters, and evidence alone is NOT a verify signal: the E2E-HARNESS spawn's
    # `robot --dryrun` writes tiger/evidence/output.xml during the BUILD wave. A graded
    # refs/notes/e2e is the only artifact that proves the gate actually ran.
    if phase == "passing":
        stage = "FINALIZE"
    elif phase == "build" and branches:
        # A CHANGES verdict re-opens the build: phase goes back to `build` while a graded note from
        # the PREVIOUS round still exists, so the note must not win here or every fix round reads
        # as VERIFY.
        stage = "BUILD"
    elif note != "-":
        stage = "VERIFY"
    elif re.search(r"integrate", head_msg or "", re.I):
        stage = "INTEGRATE"
    elif branches:
        stage = "BUILD"
    elif (fdir / "e2e_testcases.robot").exists() and tasks not in ("0/0", "?/?"):
        stage = "PLANNED"
    else:
        stage = "PLAN"

    print(
        f"stage={stage} phase={phase} tasks={tasks} ac={acs} coders={coders} wt={worktrees} "
        f"e2e={e2e} ev={ev} note={note} merges={integrated} head={head_sha} {head_msg[:60]}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
