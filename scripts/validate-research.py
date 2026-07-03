#!/usr/bin/env python3
"""Deterministic ledger-invariant checker for research_ledger.json (schema v1) + the experimentN/ contract.

The research loop keeps ALL state in local files (git-free): the append-only
research_ledger.json index plus one immutable experiments/experimentN/ folder per
iteration (experiment0 is the baseline run). This script parses the ledger and the
folder tree and enforces the invariants tiger/research.py promises at write time but does
not re-check after the fact:

  - schema_version == 1, valid metric direction, valid ledger + experiment status vocab
  - experiment ids monotonic from 1, contiguous, unique, appended in order (baseline = 0)
  - frozen controlled_vars constant across ALL rows (the anti-tuning core; extra keys
    are the G3 carve-out, but a frozen key may never drop or change)
  - every row.family drawn from the taxonomy vocabulary (ledger taxonomy + taxonomy.md)
  - reciprocal ledger<->folder links: no orphan row, no orphan folder, each folder
    carrying its immutable artifact set (experiment.md, deliberation.md, run.sh,
    sources.md, metrics.json, evidence/)
  - prior folders immutable: the ledger row metric reconciles with the folder's
    metrics.json, and — when a row records a manifest of file hashes — the folder
    re-hashes to it (a mutated frozen folder is caught)
  - best is the metric extremum per direction and goal_met matches best-vs-target

Usage:  validate-research.py <research_ledger.json>
Exit 0 + "ledger OK"        when every invariant holds.
Exit 1 + one line per break otherwise.

It reads ledger metadata + experiment files only — no method code is executed — so it
is cheap enough to run on every stop. The ledger's dir is the goal dir: experiments
live at <goal>/experiments/experimentN/ (baseline at <goal>/experiment0/); both
locations are searched so either layout validates.
"""
import hashlib
import json
import os
import re
import sys

DIRECTION = {"max", "min"}
LEDGER_STATUS = {"running", "success", "stalled", "blocked"}
EXP_STATUS = {"improved", "neutral", "regressed", "rejected"}
REQUIRED_FILES = ("experiment.md", "deliberation.md", "run.sh", "sources.md", "metrics.json")
CORE_FILES = ("experiment.md", "metrics.json")


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def close_enough(a, b):
    return abs(a - b) <= 1e-6 * max(1.0, abs(a), abs(b))


def strictly_better(a, b, direction):
    slack = 1e-6 * max(1.0, abs(a), abs(b))
    return (a - b) > slack if direction == "max" else (b - a) > slack


def short(obj):
    s = json.dumps(obj, default=str)
    return s if len(s) <= 80 else s[:77] + "..."


def _slug(s):
    return s.strip().strip("*_`").strip().lower()


def exp_num(row):
    for k in ("index", "id", "n", "iter", "iteration"):
        v = row.get(k)
        if isinstance(v, bool):
            continue
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            m = re.fullmatch(r"(?:experiment)?(\d+)", v.strip())
            if m:
                return int(m.group(1))
    for k in ("experiment", "dir", "folder", "path", "name"):
        v = row.get(k)
        if isinstance(v, str):
            m = re.search(r"experiment(\d+)", v)
            if m:
                return int(m.group(1))
    return None


def exp_dir(goal_dir, num):
    name = f"experiment{num}"
    for cand in (os.path.join(goal_dir, "experiments", name), os.path.join(goal_dir, name)):
        if os.path.isdir(cand):
            return cand
    return None


def disk_experiments(goal_dir):
    found = {}
    for base in (os.path.join(goal_dir, "experiments"), goal_dir):
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            m = re.fullmatch(r"experiment(\d+)", name)
            full = os.path.join(base, name)
            if m and os.path.isdir(full):
                found.setdefault(int(m.group(1)), full)
    return found


def read_metric(path, metric_name):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except OSError:
        return None, "unreadable"
    except json.JSONDecodeError:
        return None, "not-json"
    if not isinstance(data, dict):
        return None, "not-object"
    for k in (metric_name, "metric", "value", "score"):
        if k and is_num(data.get(k)):
            return float(data[k]), None
    nested = data.get("metrics") or data.get("metric")
    if isinstance(nested, dict):
        for k in (metric_name, "value", "score"):
            if k and is_num(nested.get(k)):
                return float(nested[k]), None
    return None, "no-metric-field"


def folder_manifest(root):
    out = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            try:
                with open(full, "rb") as fh:
                    out[rel] = hashlib.sha256(fh.read()).hexdigest()
            except OSError:
                out[rel] = None
    return out


def taxonomy_families(ledger, goal_dir):
    fams = set()
    tax = ledger.get("taxonomy")
    if isinstance(tax, list):
        fams |= {_slug(x) for x in tax if isinstance(x, str) and x.strip()}
    elif isinstance(tax, dict):
        pool = tax["families"] if isinstance(tax.get("families"), list) else list(tax.keys())
        fams |= {_slug(x) for x in pool if isinstance(x, str) and x.strip()}
    path = os.path.join(goal_dir, "taxonomy.md")
    if os.path.isfile(path):
        try:
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    s = line.strip()
                    m = re.match(r"#{1,6}\s+(.+)", s)
                    if m:
                        fams.add(_slug(m.group(1)))
                        continue
                    m = re.match(r"[-*+]\s+\**([^*:|]+)", s)
                    if m:
                        fams.add(_slug(m.group(1)))
                        continue
                    if "---" not in s:
                        m = re.match(r"\|\s*\**([^*:|]+?)\**\s*\|", s)
                        if m:
                            fams.add(_slug(m.group(1)))
        except OSError:
            pass
    fams.discard("")
    return fams


def check(ledger, goal_dir):
    errs = []

    if not isinstance(ledger, dict):
        return ["ledger must be a JSON object (got a %s)" % type(ledger).__name__]

    if ledger.get("schema_version") != 1:
        errs.append(f"schema_version must be 1, got {ledger.get('schema_version')!r}")

    status = ledger.get("status")
    if status is not None and status not in LEDGER_STATUS:
        errs.append(f"status must be one of {sorted(LEDGER_STATUS)}, got {status!r}")

    metric = ledger.get("metric") if isinstance(ledger.get("metric"), dict) else {}
    metric_name = metric.get("name") if isinstance(metric.get("name"), str) else ""
    direction = metric.get("direction")
    if direction not in DIRECTION:
        errs.append(f"metric.direction must be 'max' or 'min', got {direction!r}")
    target = metric.get("target") if is_num(metric.get("target")) else None

    frozen = None
    for k in ("controlled_vars", "frozen", "frozen_vars"):
        if isinstance(ledger.get(k), dict):
            frozen = ledger[k]
            break
    if frozen is None:
        errs.append("controlled_vars (the frozen set) must be an object")
        frozen = {}

    families = taxonomy_families(ledger, goal_dir)

    if not os.path.isfile(os.path.join(goal_dir, "goal.md")):
        errs.append("goal.md is missing beside the ledger (the ledger is seeded from it)")

    bl = ledger.get("baseline")
    has_baseline_ref = isinstance(bl, dict) or is_num(bl) or is_num(metric.get("baseline"))
    baseline_val = None
    if isinstance(bl, dict) and is_num(bl.get("value")):
        baseline_val = bl["value"]
    elif is_num(bl):
        baseline_val = bl
    elif is_num(metric.get("baseline")):
        baseline_val = metric.get("baseline")

    rows = ledger.get("experiments")
    if not isinstance(rows, list):
        for alt in ("iterations", "rows", "log"):
            if isinstance(ledger.get(alt), list):
                rows = ledger[alt]
                break
    if not isinstance(rows, list):
        errs.append("experiments must be a list")
        return errs

    seen = set()
    iter_nums = []
    baseline_row = None
    row_by_num = {}
    for row in rows:
        if not isinstance(row, dict):
            errs.append("experiments contains a non-object row")
            continue
        num = exp_num(row)
        if num is None:
            errs.append(f"experiment row has no resolvable id/index: {short(row)}")
            continue
        if num in seen:
            errs.append(f"duplicate experiment id {num}")
            continue
        seen.add(num)
        row_by_num[num] = row
        if num == 0:
            baseline_row = row
        else:
            iter_nums.append(num)

    if baseline_row is not None and is_num(baseline_row.get("metric")):
        baseline_val = baseline_row["metric"]

    ordered = sorted(iter_nums)
    if ordered != list(range(1, len(ordered) + 1)):
        errs.append(f"experiment ids must be monotonic from 1 with no gaps; got {sorted(iter_nums)}")
    if iter_nums != ordered:
        errs.append(f"experiment rows must be appended in ascending id order; got {iter_nums}")

    for num in sorted(n for n in row_by_num if n >= 1):
        row = row_by_num[num]
        d = exp_dir(goal_dir, num)
        if d is None:
            errs.append(f"experiment {num} has a ledger row but no folder on disk (orphan row)")
            continue

        for fname in REQUIRED_FILES:
            if not os.path.isfile(os.path.join(d, fname)):
                errs.append(f"experiment {num} folder is missing required {fname}")
        if not os.path.isdir(os.path.join(d, "evidence")):
            errs.append(f"experiment {num} folder is missing the evidence/ proof dir")

        av = row.get("approach_vector")
        if not isinstance(av, dict):
            errs.append(f"experiment {num} is missing an approach_vector object")
        else:
            cv = av.get("controlled_vars")
            if not isinstance(cv, dict):
                errs.append(f"experiment {num} approach_vector.controlled_vars must be an object")
            else:
                for fk, fv in frozen.items():
                    if fk not in cv:
                        errs.append(
                            f"experiment {num} drops frozen controlled var {fk!r} "
                            "(the frozen core must stay constant across all rows)"
                        )
                    elif cv[fk] != fv:
                        errs.append(
                            f"experiment {num} changed frozen controlled var {fk!r}: "
                            f"{cv[fk]!r} != frozen {fv!r} = tuning, not a new way"
                        )
            fam = av.get("family")
            if not isinstance(fam, str) or not fam.strip():
                errs.append(f"experiment {num} approach_vector.family must be a non-empty string")
            elif families and fam.strip().lower() not in families:
                errs.append(f"experiment {num} family {fam!r} is not in the taxonomy vocabulary {sorted(families)}")
            comps = av.get("components")
            if comps is not None and not isinstance(comps, list):
                errs.append(f"experiment {num} approach_vector.components must be a list")

        recorded = row.get("metric")
        mfile = os.path.join(d, "metrics.json")
        if os.path.isfile(mfile):
            val, why = read_metric(mfile, metric_name)
            if why in ("unreadable", "not-json", "not-object"):
                errs.append(f"experiment {num} metrics.json is {why} — the run evidence is broken")
            elif val is not None and is_num(recorded) and not close_enough(val, recorded):
                errs.append(
                    f"experiment {num} ledger metric {recorded} != metrics.json metric {val} "
                    "— a frozen prior folder was mutated"
                )

        man = row.get("manifest")
        if isinstance(man, dict) and man:
            cur = folder_manifest(d)
            for rel, h in man.items():
                if cur.get(rel) != h:
                    errs.append(
                        f"experiment {num} file {rel!r} no longer matches its recorded hash "
                        "— a frozen prior folder was mutated"
                    )

        st = row.get("status")
        if st is not None and st not in EXP_STATUS:
            errs.append(f"experiment {num} has invalid status {st!r} (want {sorted(EXP_STATUS)})")

    baseline_declared = baseline_row is not None or baseline_val is not None or has_baseline_ref
    bdir = exp_dir(goal_dir, 0)
    if baseline_declared:
        if bdir is None:
            errs.append("baseline is recorded but the experiment0 folder is missing (no baseline run)")
        else:
            for fname in CORE_FILES:
                if not os.path.isfile(os.path.join(bdir, fname)):
                    errs.append(f"experiment0 (baseline) is missing required {fname}")
            if not os.path.isdir(os.path.join(bdir, "evidence")):
                errs.append("experiment0 (baseline) is missing the evidence/ proof dir")
            if baseline_val is not None:
                val, why = read_metric(os.path.join(bdir, "metrics.json"), metric_name)
                if why in ("unreadable", "not-json", "not-object"):
                    errs.append(f"experiment0 (baseline) metrics.json is {why} — the run evidence is broken")
                elif val is not None and not close_enough(val, baseline_val):
                    errs.append(
                        f"baseline metric {baseline_val} != experiment0 metrics.json metric {val} "
                        "— a frozen prior folder was mutated"
                    )

    for num, _p in sorted(disk_experiments(goal_dir).items()):
        if num == 0:
            if not baseline_declared:
                errs.append("folder experiment0 exists on disk but the ledger records no baseline")
            continue
        if num not in row_by_num:
            errs.append(f"folder experiment{num} exists on disk but has no ledger row (orphan folder)")

    best = ledger.get("best") if isinstance(ledger.get("best"), dict) else {}
    best_val = best.get("value")
    if is_num(best_val) and direction in DIRECTION:
        candidates = []
        if is_num(baseline_val):
            candidates.append((0, baseline_val))
        for num in sorted(n for n in row_by_num if n >= 1):
            row = row_by_num[num]
            if row.get("status") == "rejected":
                continue
            if is_num(row.get("metric")):
                candidates.append((num, row["metric"]))
        for num, mv in candidates:
            if strictly_better(mv, best_val, direction):
                errs.append(
                    f"best.value {best_val} is not the {direction} of recorded metrics: "
                    f"experiment {num} scored {mv}"
                )

    gm = ledger.get("goal_met")
    if isinstance(gm, bool) and is_num(best_val) and target is not None and direction in DIRECTION:
        derived = (best_val >= target - 1e-9) if direction == "max" else (best_val <= target + 1e-9)
        if gm != derived:
            errs.append(
                f"goal_met={gm} but best {best_val} vs target {target} ({direction}) derives {derived}"
            )

    return errs


def main():
    if len(sys.argv) != 2:
        print("usage: validate-research.py <research_ledger.json>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    try:
        with open(path, encoding="utf-8") as fh:
            ledger = json.load(fh)
    except FileNotFoundError:
        print(f"ledger not found: {path}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"ledger is not valid JSON: {exc}", file=sys.stderr)
        return 1

    errs = check(ledger, os.path.dirname(os.path.abspath(path)))
    if errs:
        for e in errs:
            print(f"LEDGER INVARIANT VIOLATION: {e}", file=sys.stderr)
        return 1
    print("ledger OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
