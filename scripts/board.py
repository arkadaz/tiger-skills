#!/usr/bin/env python3
"""Tiger board CLI — read and surgically patch feature_list.json (schema v2).

Stages use THIS instead of dumping the whole board into context and hand-rewriting it.
Every read prints only the slice asked for; every write loads the full board, mutates one
spot, re-checks the invariants (WIP<=1, current_feature consistency, reciprocal + acyclic
links, valid status/phase), and only then writes back — preserving every other field. A
write that would break an invariant is REFUSED (exit 1, board untouched): fail closed.

install copies this next to the board as `tiger/board.py`. Call it from any stage, e.g.:

  python3 tiger/board.py summary
  python3 tiger/board.py current
  python3 tiger/board.py in-progress
  python3 tiger/board.py newest-approved              # id of the LAST (newest) approved, non-passing feature
  python3 tiger/board.py candidates                   # every buildable (approved, non-passing) feature, oldest->newest
  python3 tiger/board.py get <feature> [field]        # field may be dotted: scope_map.metric
  python3 tiger/board.py task <feature> <task_id>     # ONE task's work packet + scope_map (a coder's only read)
  python3 tiger/board.py switch <feature>              # ATOMIC clock-in: park any other in_progress, start this one
  python3 tiger/board.py park <feature>                # ATOMIC: this feature -> blocked, release current_feature
  python3 tiger/board.py close <feature>               # ATOMIC close-out: status+phase passing, current_feature null
  python3 tiger/board.py set-phase <feature> <plan|build|validate|blocked|passing>
  python3 tiger/board.py set-status <feature> <not_started|in_progress|passing|blocked>
  python3 tiger/board.py set-current <feature|null>
  python3 tiger/board.py set-task <feature> <task_id> <status> [--evidence "..."]
  python3 tiger/board.py set-ac <feature> <ac_id> <status> [--evidence "..."]
  python3 tiger/board.py add-learning <feature> <technical|product|process|harness_updates> "..."
  python3 tiger/board.py approve <feature> [--by who] [--date YYYY-MM-DD]
  python3 tiger/board.py add-task <feature> --id T2 --title "..." [--files a b] [--depends T1]
                                  [--context "..."] [--verification "cmd"]
  python3 tiger/board.py add-feature <id> --title "..." [--spec-file path] [--jtbd "..."]
                                  [--problem "..."] [--depends fid] [--start]

Use --file PATH to target a board other than ./feature_list.json.
"""
import argparse
import json
import sys

FEATURE_STATUS = {"not_started", "in_progress", "passing", "blocked"}
PHASE = {"plan", "build", "validate", "blocked", "passing"}
LEARN = {"technical", "product", "process", "harness_updates"}


def load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            board = json.load(fh)
    except FileNotFoundError:
        sys.exit(f"board not found: {path} (run /tiger-skills:install)")
    except json.JSONDecodeError as exc:
        sys.exit(f"board is not valid JSON: {exc}")
    if isinstance(board, dict) and (isinstance(board.get("features"), list) or board.get("schema_version") != 2):
        sys.exit(
            f"legacy board shape in {path} (features must be a schema-v2 dict keyed by id, not a list; "
            "schema_version must be 2) -- run /tiger-skills:install to migrate it before reading or writing."
        )
    return board


def validate(board):
    errs = []
    if not isinstance(board, dict):
        return ["board must be a JSON object"]
    if board.get("schema_version") != 2:
        errs.append(f"schema_version must be 2, got {board.get('schema_version')!r}")
    features = board.get("features")
    if not isinstance(features, dict):
        return errs + ["features must be an object"]
    in_progress = []
    for fid, f in features.items():
        if not isinstance(f, dict):
            errs.append(f"feature {fid!r} must be an object")
            continue
        if f.get("status") not in FEATURE_STATUS:
            errs.append(f"feature {fid!r} invalid status {f.get('status')!r}")
        if f.get("phase") not in PHASE:
            errs.append(f"feature {fid!r} invalid phase {f.get('phase')!r}")
        if f.get("status") == "in_progress":
            in_progress.append(fid)
    if len(in_progress) > 1:
        errs.append(f"WIP>1: in_progress = {in_progress} (max 1)")
    cur = board.get("current_feature")
    if in_progress and cur != in_progress[0]:
        errs.append(f"current_feature {cur!r} must equal the in_progress feature {in_progress[0]!r}")
    if not in_progress and cur is not None:
        errs.append(f"current_feature must be null when nothing is in_progress, got {cur!r}")
    for fid, f in features.items():
        if not isinstance(f, dict):
            continue
        for dep in f.get("depends_on", []) or []:
            t = features.get(dep)
            if not isinstance(t, dict):
                errs.append(f"feature {fid!r} depends_on unknown feature {dep!r}")
            elif fid not in (t.get("blocks", []) or []):
                errs.append(f"non-reciprocal: {fid!r} depends_on {dep!r} but {dep!r} does not block it")
    color = {fid: 0 for fid in features}

    def visit(node, stack):
        color[node] = 1
        obj = features.get(node)
        deps = obj.get("depends_on", []) or [] if isinstance(obj, dict) else []
        for dep in deps:
            if dep not in color:
                continue
            if color[dep] == 1:
                errs.append("dependency cycle: " + " -> ".join(stack + [node, dep]))
                return True
            if color[dep] == 0 and visit(dep, stack + [node]):
                return True
        color[node] = 2
        return False

    for fid in features:
        if color[fid] == 0:
            visit(fid, [])
    return errs


def save(path, board):
    errs = validate(board)
    if errs:
        for e in errs:
            print(f"REFUSED — board invariant would break: {e}", file=sys.stderr)
        sys.exit(1)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(board, fh, indent=2)
        fh.write("\n")
    print("OK")


def feat(board, fid):
    f = board.get("features", {}).get(fid)
    if not isinstance(f, dict):
        sys.exit(f"no such feature: {fid}")
    return f


def main():
    p = argparse.ArgumentParser(prog="board.py", description="Read/patch feature_list.json (schema v2).")
    p.add_argument("--file", default="feature_list.json")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("summary")
    sub.add_parser("current")
    sub.add_parser("in-progress")
    sub.add_parser("newest-approved")
    sub.add_parser("candidates")
    g = sub.add_parser("get"); g.add_argument("feature", nargs="?"); g.add_argument("field", nargs="?")
    tk = sub.add_parser("task"); tk.add_argument("feature"); tk.add_argument("task")
    sw = sub.add_parser("switch"); sw.add_argument("feature")
    pk = sub.add_parser("park"); pk.add_argument("feature")
    cl = sub.add_parser("close"); cl.add_argument("feature")
    sp = sub.add_parser("set-phase"); sp.add_argument("feature"); sp.add_argument("phase")
    ss = sub.add_parser("set-status"); ss.add_argument("feature"); ss.add_argument("status")
    sc = sub.add_parser("set-current"); sc.add_argument("feature")
    st = sub.add_parser("set-task"); st.add_argument("feature"); st.add_argument("task"); st.add_argument("status"); st.add_argument("--evidence")
    sa = sub.add_parser("set-ac"); sa.add_argument("feature"); sa.add_argument("ac"); sa.add_argument("status"); sa.add_argument("--evidence")
    al = sub.add_parser("add-learning"); al.add_argument("feature"); al.add_argument("bucket"); al.add_argument("text")
    ap = sub.add_parser("approve"); ap.add_argument("feature"); ap.add_argument("--by", default="human"); ap.add_argument("--date", default="")
    at = sub.add_parser("add-task"); at.add_argument("feature"); at.add_argument("--id", required=True); at.add_argument("--title", required=True)
    at.add_argument("--files", nargs="*", default=[]); at.add_argument("--depends", nargs="*", default=[]); at.add_argument("--context", default=""); at.add_argument("--verification", default="")
    af = sub.add_parser("add-feature"); af.add_argument("id"); af.add_argument("--title", required=True); af.add_argument("--spec-file", default="")
    af.add_argument("--jtbd", default=""); af.add_argument("--problem", default=""); af.add_argument("--depends", nargs="*", default=[]); af.add_argument("--start", action="store_true")

    a = p.parse_args()
    board = load(a.file)

    if a.cmd == "summary":
        print(f"current_feature: {board.get('current_feature')}")
        for fid, f in board.get("features", {}).items():
            if not isinstance(f, dict):
                print(f"  {fid}: <malformed>"); continue
            tasks = f.get("tasks", []) or []
            acs = f.get("acceptance_criteria", []) or []
            td = sum(1 for t in tasks if isinstance(t, dict) and t.get("status") == "done")
            ad = sum(1 for c in acs if isinstance(c, dict) and c.get("status") == "done")
            mark = "  <-- current" if fid == board.get("current_feature") else ""
            print(f"  {fid:24} {f.get('status',''):12} phase={f.get('phase',''):9} tasks={td}/{len(tasks)} ac={ad}/{len(acs)}{mark}")
        return 0

    if a.cmd == "current":
        print(board.get("current_feature")); return 0

    if a.cmd == "in-progress":
        ip = [fid for fid, f in board.get("features", {}).items() if isinstance(f, dict) and f.get("status") == "in_progress"]
        print(ip[0] if len(ip) == 1 else ""); return 0

    if a.cmd in ("newest-approved", "candidates"):
        # Board dict order IS creation order (grill appends; every load/save preserves it), so the
        # LAST approved, non-passing feature is the most recently created one — "by the time the
        # folder was created". `newest-approved` prints that single id (empty if none); `candidates`
        # lists every buildable feature oldest→newest so the caller can see the queue. This is what
        # stops bootstrap re-pinning to an old stuck feature when a newer approved one is waiting.
        elig = [
            fid for fid, f in board.get("features", {}).items()
            if isinstance(f, dict) and f.get("spec_status") == "approved" and f.get("status") != "passing"
        ]
        if a.cmd == "candidates":
            for fid in elig:
                f = board["features"][fid]
                print(f"{fid:24} {f.get('status',''):12} phase={f.get('phase','')}")
        else:
            print(elig[-1] if elig else "")
        return 0

    if a.cmd == "get":
        if not a.feature:
            print(json.dumps(board, indent=2)); return 0
        f = feat(board, a.feature)
        if not a.field:
            print(json.dumps(f, indent=2)); return 0
        cur = f
        for part in a.field.split("."):
            if not isinstance(cur, dict) or part not in cur:
                sys.exit(f"no such field: {a.field}")
            cur = cur[part]
        print(json.dumps(cur, indent=2) if isinstance(cur, (dict, list)) else cur); return 0

    if a.cmd == "task":
        # A worktree coder's ONLY board read: its own packet, not the whole feature. Keeping the
        # builder's context to one task is what keeps parallel coders cheap and accurate.
        f = feat(board, a.feature)
        for t in f.get("tasks", []) or []:
            if isinstance(t, dict) and t.get("id") == a.task:
                print(json.dumps({
                    "feature": a.feature,
                    "spec_file": f.get("spec_file", ""),
                    "scope_map": f.get("scope_map", {}),
                    "task": t,
                }, indent=2))
                return 0
        sys.exit(f"no such task {a.task} in {a.feature}")

    # WIP=1 + "current_feature == the in_progress feature" are checked together on every save, so any
    # clock-in, park, or close-out is a MULTI-FIELD move: doing it as two set-* calls is refused in both
    # orders (each intermediate state breaks an invariant). These three subcommands make each transition
    # one validated write.
    if a.cmd == "switch":
        f = feat(board, a.feature)
        for fid, other in board.get("features", {}).items():
            if fid != a.feature and isinstance(other, dict) and other.get("status") == "in_progress":
                other["status"] = "blocked"
        f["status"] = "in_progress"
        board["current_feature"] = a.feature
        return save(a.file, board)

    if a.cmd == "park":
        f = feat(board, a.feature)
        f["status"] = "blocked"
        if board.get("current_feature") == a.feature:
            board["current_feature"] = None
        return save(a.file, board)

    if a.cmd == "close":
        f = feat(board, a.feature)
        f["status"] = "passing"
        f["phase"] = "passing"
        if board.get("current_feature") == a.feature:
            board["current_feature"] = None
        return save(a.file, board)

    if a.cmd == "set-phase":
        feat(board, a.feature)["phase"] = a.phase; return save(a.file, board)

    if a.cmd == "set-status":
        feat(board, a.feature)["status"] = a.status; return save(a.file, board)

    if a.cmd == "set-current":
        board["current_feature"] = None if a.feature in ("null", "none", "None", "") else a.feature
        return save(a.file, board)

    if a.cmd == "set-task":
        f = feat(board, a.feature)
        for t in f.get("tasks", []) or []:
            if isinstance(t, dict) and t.get("id") == a.task:
                t["status"] = a.status
                if a.evidence:
                    t.setdefault("evidence", []).append(a.evidence)
                return save(a.file, board)
        sys.exit(f"no such task {a.task} in {a.feature}")

    if a.cmd == "set-ac":
        f = feat(board, a.feature)
        for c in f.get("acceptance_criteria", []) or []:
            if isinstance(c, dict) and c.get("id") == a.ac:
                c["status"] = a.status
                if a.evidence:
                    c.setdefault("evidence", []).append(a.evidence)
                return save(a.file, board)
        sys.exit(f"no such acceptance criterion {a.ac} in {a.feature}")

    if a.cmd == "add-learning":
        if a.bucket not in LEARN:
            sys.exit(f"bucket must be one of {sorted(LEARN)}")
        feat(board, a.feature).setdefault("learning", {}).setdefault(a.bucket, []).append(a.text)
        return save(a.file, board)

    if a.cmd == "approve":
        f = feat(board, a.feature)
        f["spec_status"] = "approved"
        f["approval"] = {"approved_by": a.by, "date": a.date}
        return save(a.file, board)

    if a.cmd == "add-task":
        f = feat(board, a.feature)
        tasks = f.setdefault("tasks", [])
        if any(isinstance(t, dict) and t.get("id") == a.id for t in tasks):
            sys.exit(f"task {a.id} already exists in {a.feature}")
        tasks.append({
            "id": a.id, "title": a.title, "status": "not_started",
            "files": a.files, "depends_on": a.depends,
            "context": a.context, "verification": a.verification, "evidence": [],
        })
        return save(a.file, board)

    if a.cmd == "add-feature":
        feats = board.setdefault("features", {})
        if a.id in feats:
            sys.exit(f"feature {a.id} already exists")
        entry = {
            "title": a.title, "status": "in_progress" if a.start else "not_started",
            "phase": "plan", "problem_statement": a.problem, "jtbd": a.jtbd,
            "spec_file": a.spec_file or f"tiger/features/{a.id}/feature.md",
            "spec_status": "awaiting_review", "depends_on": list(a.depends), "blocks": [],
            "acceptance_criteria": [], "tasks": [],
            "learning": {"technical": [], "product": [], "process": [], "harness_updates": []},
        }
        feats[a.id] = entry
        for dep in a.depends:
            if isinstance(feats.get(dep), dict):
                feats[dep].setdefault("blocks", []).append(a.id)
        if a.start:
            board["current_feature"] = a.id
        return save(a.file, board)

    return 2


if __name__ == "__main__":
    sys.exit(main())
