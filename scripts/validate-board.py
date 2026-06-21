#!/usr/bin/env python3
"""Deterministic board-invariant checker for feature_list.json (schema v2).

The kit documents board invariants (WIP=1, current_feature consistency,
reciprocal + acyclic depends_on/blocks) but, before this script, only WIP was
checked — and that check was a substring grep that also counted task-level
`"status": "in_progress"`, so a feature with in-progress tasks could false-block
clock-in. This script parses the board and enforces the invariants properly.

Usage:  validate-board.py <feature_list.json>
Exit 0 + "board OK"        when every invariant holds.
Exit 1 + one line per break otherwise.

It reads board *metadata* only — no source, no code execution — so it is cheap
enough for the conductor to run at clock-in.
"""
import json
import sys

FEATURE_STATUS = {"not_started", "in_progress", "passing", "blocked"}
PHASE = {"plan", "build", "validate", "blocked", "passing"}


def check(board):
    errs = []

    if not isinstance(board, dict):
        return ["board must be a JSON object (got a %s)" % type(board).__name__]

    if board.get("schema_version") != 2:
        errs.append(f"schema_version must be 2, got {board.get('schema_version')!r}")

    features = board.get("features")
    if not isinstance(features, dict):
        errs.append("features must be an object")
        return errs  # nothing else is checkable

    in_progress = []
    for fid, f in features.items():
        if not isinstance(f, dict):
            errs.append(f"feature {fid!r} must be an object")
            continue
        st = f.get("status")
        if st not in FEATURE_STATUS:
            errs.append(f"feature {fid!r} has invalid status {st!r}")
        if f.get("phase") not in PHASE:
            errs.append(f"feature {fid!r} has invalid phase {f.get('phase')!r}")
        if st == "in_progress":
            in_progress.append(fid)
        for key in ("depends_on", "blocks"):
            if not isinstance(f.get(key, []), list):
                errs.append(f"feature {fid!r} {key} must be a list")
        # acceptance criteria each need a runnable (non-empty) verification command
        acs = f.get("acceptance_criteria", [])
        if not isinstance(acs, list):
            errs.append(f"feature {fid!r} acceptance_criteria must be a list")
            acs = []
        for ac in acs:
            if not isinstance(ac, dict):
                errs.append(f"feature {fid!r} has a non-object acceptance criterion")
                continue
            ver = ac.get("verification")
            if not isinstance(ver, str) or not ver.strip():
                errs.append(
                    f"feature {fid!r} AC {ac.get('id')!r} verification must be a "
                    f"non-empty runnable command, got {ver!r}"
                )
        # tasks must be a list of objects with unique ids
        tasks = f.get("tasks", [])
        if not isinstance(tasks, list):
            errs.append(f"feature {fid!r} tasks must be a list")
        else:
            seen = set()
            for t in tasks:
                if not isinstance(t, dict):
                    errs.append(f"feature {fid!r} has a non-object task")
                    continue
                tid = t.get("id")
                if tid in seen:
                    errs.append(f"feature {fid!r} has duplicate task id {tid!r}")
                seen.add(tid)

    # WIP <= 1 at the FEATURE level (not tasks)
    if len(in_progress) > 1:
        errs.append(f"WIP>1: features in_progress = {in_progress} (max 1)")

    # current_feature must match the single in_progress feature, or be null
    cur = board.get("current_feature")
    if in_progress:
        if cur != in_progress[0]:
            errs.append(
                f"current_feature {cur!r} must equal the in_progress feature {in_progress[0]!r}"
            )
    else:
        if cur is not None:
            errs.append(f"current_feature must be null when no feature is in_progress, got {cur!r}")

    # reciprocal links: A depends_on B  <=>  B blocks A
    for fid, f in features.items():
        if not isinstance(f, dict):
            continue
        for dep in f.get("depends_on", []) or []:
            if dep not in features:
                errs.append(f"feature {fid!r} depends_on unknown feature {dep!r}")
                continue
            target = features[dep]
            if not isinstance(target, dict):
                continue  # already flagged as a non-object feature; cannot link
            if fid not in (target.get("blocks", []) or []):
                errs.append(f"non-reciprocal link: {fid!r} depends_on {dep!r} but {dep!r} does not block {fid!r}")
        for blk in f.get("blocks", []) or []:
            if blk not in features:
                errs.append(f"feature {fid!r} blocks unknown feature {blk!r}")
                continue
            target = features[blk]
            if not isinstance(target, dict):
                continue  # already flagged as a non-object feature; cannot link
            if fid not in (target.get("depends_on", []) or []):
                errs.append(f"non-reciprocal link: {fid!r} blocks {blk!r} but {blk!r} does not depend_on {fid!r}")

    # acyclic over depends_on (DFS cycle detection)
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {fid: WHITE for fid in features}

    def visit(node, stack):
        color[node] = GRAY
        node_obj = features.get(node)
        node_deps = node_obj.get("depends_on", []) or [] if isinstance(node_obj, dict) else []
        for dep in node_deps:
            if not isinstance(dep, str):
                continue
            if dep not in color:
                continue
            if color[dep] == GRAY:
                cycle = " -> ".join(stack + [node, dep])
                errs.append(f"dependency cycle: {cycle}")
                return True
            if color[dep] == WHITE and visit(dep, stack + [node]):
                return True
        color[node] = BLACK
        return False

    for fid in features:
        if color[fid] == WHITE:
            visit(fid, [])

    return errs


def main():
    if len(sys.argv) != 2:
        print("usage: validate-board.py <feature_list.json>", file=sys.stderr)
        return 2
    try:
        with open(sys.argv[1], encoding="utf-8") as fh:
            board = json.load(fh)
    except FileNotFoundError:
        print(f"board not found: {sys.argv[1]}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"board is not valid JSON: {exc}", file=sys.stderr)
        return 1

    errs = check(board)
    if errs:
        for e in errs:
            print(f"BOARD INVARIANT VIOLATION: {e}", file=sys.stderr)
        return 1
    print("board OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
