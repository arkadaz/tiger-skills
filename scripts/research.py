#!/usr/bin/env python3
"""Tiger research CLI — the novelty engine + append-only ledger (schema v1), GIT-FREE.

SEPARATE from board.py: this drives research/<goalId>/research_ledger.json, the state index
for the standalone research loop. No git anywhere — the folder tree IS the memory; resume =
read the ledger + experiments/ folders. Discipline mirrors board.py: every read prints only the
slice asked for; every write loads the full ledger, mutates ONE spot, re-checks the invariants
(schema v1, monotonic experiment index, best points at an existing experiment, ascending
append-only rows), and only then writes back — preserving every other field. A write that would
break an invariant is REFUSED (exit 1, ledger UNTOUCHED): fail closed.

install copies this to `tiger/research.py` (alongside `tiger/board.py`); run it from the project
root, where it resolves the ledger relative to the cwd. Resolve the ledger with `--goal <id>`
(→ research/<id>/research_ledger.json) or `--file PATH`; with neither it auto-discovers the one
research/*/research_ledger.json. Subcommands:

  tiger/research.py init --goal <goalId>                 seed the ledger from research/<goalId>/goal.md
  tiger/research.py summary                              goal, metric+target+direction, frozen vars,
                                                   baseline, best, budget remaining, stall, table
  tiger/research.py vectors                              every prior approach_vector (anti-repeat memory)
  tiger/research.py frontier                             tried vs untried families + pairs + idea seeds
  tiger/research.py next-n                               the next experiment id
  tiger/research.py novelty-check <vector.json> [--built <dir>]   the G0-G4 gate (PRE, or --built POST)
  tiger/research.py register <experimentN>               re-run the gate, then append the experiment row
  tiger/research.py record-result <experimentN> --metric <v> --status <improved|neutral|regressed>
  tiger/research.py alias <tagA> <tagB>                  fold synonym component tags (anti synonym-gaming)
  tiger/research.py stall-check                          noImprove + rolling novelty mean vs budget
  tiger/research.py set-status <running|success|stalled|blocked>
  tiger/research.py close

THE NOVELTY GATE (the anti-tuning crux). approach_vector = { family, components[], controlled_vars{},
sources[], hypothesis, nearest_prior }. STRUCTURAL SET S = {family} UNION components, POINTEDLY
EXCLUDING controlled_vars — that exclusion is the anti-tuning lever. Guards, PRE (declared vector)
and POST (--built, re-derived from the actual method files, no git):
  G0 frozen-vars : controlled_vars must keep the goal frozen set untouched (carve-out: a genuinely
                   new component MAY add its OWN intrinsic var, allowed only alongside a new component).
  G1 near-dup    : max Jaccard(S, any prior S) >= 0.80 -> REFUSE.
  G2 pure-tuning : S identical to a prior -> REFUSE (only controlled_vars moved = parameter tuning).
  G3 new-comp    : components introduce no never-before-seen slug -> REFUSE (every experiment adds >=1).
  G4 new-source  : sources subset of a single prior, or no freshly-fetched source absent from all
                   priors, or a fresh source missing from sources.md -> REFUSE.
"""
import argparse
import itertools
import json
import os
import re
import sys

RUN_STATUS = {"running", "success", "stalled", "blocked"}
ROW_STATUS = {"baseline", "pending", "improved", "neutral", "regressed"}
RESULT_STATUS = {"improved", "neutral", "regressed"}
DUP_JACCARD = 0.80
METHOD_SKIP = {"experiment.md", "deliberation.md", "sources.md", "metrics.json", "vector.json"}


# ── tiny value helpers ────────────────────────────────────────────────────────
def norm(t):
    return str(t).strip().lower()


def eqv(a, b):
    return a == b or str(a).strip() == str(b).strip()


def num(x):
    if isinstance(x, (int, float)):
        return x
    s = str(x).strip()
    try:
        return int(s)
    except ValueError:
        return float(s)


def canon(aliases, t):
    t = norm(t)
    seen = set()
    while t in aliases and t not in seen:
        seen.add(t)
        t = norm(aliases[t])
    return t


def eidx(name):
    m = re.search(r"(\d+)\s*$", str(name))
    if not m:
        raise ValueError(name)
    return int(m.group(1))


def jaccard(a, b):
    if not a and not b:
        return 1.0
    uni = len(a | b)
    return (len(a & b) / uni) if uni else 1.0


def refuse(msg):
    print(f"REFUSED — {msg}", file=sys.stderr)
    sys.exit(1)


# ── minimal YAML-frontmatter reader (flow maps/lists + block maps we author) ───
def _split_top(s, opener, closer):
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def _scalar(s):
    s = s.strip()
    if s == "":
        return None
    if s[0] == "{" and s[-1] == "}":
        d = {}
        for part in _split_top(s[1:-1], "{", "}"):
            k, _, v = part.partition(":")
            if k.strip():
                d[k.strip()] = _scalar(v)
        return d
    if s[0] == "[" and s[-1] == "]":
        return [_scalar(x) for x in _split_top(s[1:-1], "[", "]") if x.strip()]
    if (s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'"):
        return s[1:-1]
    low = s.lower()
    if low in ("true", "yes"):
        return True
    if low in ("false", "no"):
        return False
    if low in ("null", "none", "~"):
        return None
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        return s


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def _parse_map(lines, idx, level):
    out = {}
    while idx < len(lines):
        line = lines[idx]
        ind = _indent(line)
        if ind < level or line.strip().startswith("- "):
            break
        body = line.strip()
        if ":" not in body:
            idx += 1
            continue
        key, _, rest = body.partition(":")
        key, rest = key.strip(), rest.strip()
        if rest == "":
            child, idx = _parse_block(lines, idx + 1, level)
            out[key] = child if child is not None else {}
        else:
            out[key] = _scalar(rest)
            idx += 1
    return out, idx


def _parse_list(lines, idx, level):
    out = []
    while idx < len(lines):
        line = lines[idx]
        if _indent(line) < level or not line.strip().startswith("- "):
            break
        out.append(_scalar(line.strip()[2:]))
        idx += 1
    return out, idx


def _parse_block(lines, idx, parent):
    if idx >= len(lines):
        return None, idx
    ind = _indent(lines[idx])
    if ind <= parent:
        return None, idx
    if lines[idx].strip().startswith("- "):
        return _parse_list(lines, idx, ind)
    return _parse_map(lines, idx, ind)


def _mini_yaml(block):
    lines = [ln.rstrip() for ln in block.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    return _parse_map(lines, 0, 0)[0]


def read_frontmatter(path):
    try:
        text = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        sys.exit(f"goal spec not found: {path} (run /research-goal to grill + approve a goal first)")
    if not text.lstrip().startswith("---"):
        sys.exit(f"{path}: no YAML frontmatter (--- ... ---) — cannot read the goal")
    parts = text.split("---", 2)
    block = parts[1] if len(parts) >= 3 else ""
    try:
        import yaml
        data = yaml.safe_load(block)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return _mini_yaml(block)


# ── ledger load / validate / save (board.py discipline) ───────────────────────
def load(path):
    try:
        led = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"ledger not found: {path} (run: tiger/research.py init --goal <goalId>)")
    except json.JSONDecodeError as exc:
        sys.exit(f"ledger is not valid JSON: {exc}")
    if not isinstance(led, dict) or isinstance(led.get("experiments"), list) or led.get("schema_version") != 1:
        sys.exit(
            f"legacy/foreign ledger shape in {path} (experiments must be a schema-v1 dict keyed by id; "
            "schema_version must be 1) — re-run tiger/research.py init to seed it."
        )
    return led


def validate(led):
    errs = []
    if not isinstance(led, dict):
        return ["ledger must be a JSON object"]
    if led.get("schema_version") != 1:
        errs.append(f"schema_version must be 1, got {led.get('schema_version')!r}")
    if led.get("status") not in RUN_STATUS:
        errs.append(f"invalid status {led.get('status')!r}")
    m = (led.get("goal") or {}).get("metric") or {}
    if m.get("direction") not in ("max", "min"):
        errs.append(f"goal.metric.direction must be max|min, got {m.get('direction')!r}")
    if not isinstance(led.get("goal_met"), bool):
        errs.append("goal_met must be boolean")
    if not isinstance(led.get("approach_registry"), list):
        errs.append("approach_registry must be a list")
    if not isinstance(led.get("aliases", {}), dict):
        errs.append("aliases must be an object")
    exps = led.get("experiments")
    if not isinstance(exps, dict):
        return errs + ["experiments must be an object (dict keyed by experimentN)"]
    order, seen = [], set()
    for name, e in exps.items():
        if not isinstance(e, dict):
            errs.append(f"experiment {name!r} must be an object")
            continue
        try:
            i = eidx(name)
        except ValueError:
            errs.append(f"bad experiment id {name!r}")
            continue
        if i in seen:
            errs.append(f"duplicate experiment index {name!r}")
        seen.add(i)
        order.append(i)
        if e.get("status") not in ROW_STATUS:
            errs.append(f"{name}: invalid row status {e.get('status')!r}")
    if order != sorted(order):
        errs.append("experiments not in ascending index order (append-only)")
    best = led.get("best")
    if best is not None and (not isinstance(best, dict) or best.get("experiment") not in exps):
        errs.append(f"best must be null or point at an existing experiment, got {best!r}")
    return errs


def save(path, led):
    errs = validate(led)
    if errs:
        for e in errs:
            print(f"REFUSED — ledger invariant would break: {e}", file=sys.stderr)
        sys.exit(1)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(led, fh, indent=2)
        fh.write("\n")
    print("OK")


# ── metric direction helpers ──────────────────────────────────────────────────
def direction(led):
    return ((led.get("goal") or {}).get("metric") or {}).get("direction")


def target(led):
    return ((led.get("goal") or {}).get("metric") or {}).get("target")


def budget(led):
    return led.get("budget", {}) or {}


def is_better(v, ref, dirn):
    return v > ref if dirn == "max" else v < ref


def is_met(v, tgt, dirn):
    return v >= tgt if dirn == "max" else v <= tgt


def dir_delta(v, ref, dirn):
    return (v - ref) if dirn == "max" else (ref - v)


# ── paths + method-file reading (git-free) ────────────────────────────────────
def goal_dir_of(path):
    return os.path.dirname(os.path.abspath(path))


def exp_dir_of(path, name):
    gd = goal_dir_of(path)
    return os.path.join(gd, "experiment0") if eidx(name) == 0 else os.path.join(gd, "experiments", name)


def load_json(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"not found: {path}")
    except json.JSONDecodeError as exc:
        sys.exit(f"{path}: not valid JSON: {exc}")


def _nosep(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def method_files(exp_dir):
    if not os.path.isdir(exp_dir):
        return []
    out = []
    for name in sorted(os.listdir(exp_dir)):
        full = os.path.join(exp_dir, name)
        if os.path.isfile(full) and name not in METHOD_SKIP:
            out.append(full)
    return out


def method_text(exp_dir):
    parts = []
    for full in method_files(exp_dir):
        try:
            parts.append(open(full, encoding="utf-8", errors="ignore").read())
        except OSError:
            continue
    return "\n".join(parts)


def derive_built_components(exp_dir, declared):
    text = _nosep(method_text(exp_dir))
    return [c for c in declared if _nosep(c) and _nosep(c) in text]


def read_families(goal_dir, led):
    fams = set()
    for a in (led.get("goal") or {}).get("taxonomy_axes") or []:
        if a:
            fams.add(norm(a))
    p = os.path.join(goal_dir, "taxonomy.md")
    if os.path.isfile(p):
        for ln in open(p, encoding="utf-8", errors="ignore"):
            s = ln.strip()
            if s.startswith("|") and s.count("|") >= 2:
                m = re.search(r"`([^`]+)`", s)
                if m:
                    fams.add(norm(m.group(1)))
    aliases = led.get("aliases", {})
    return set(canon(aliases, f) for f in fams)


def collect_seeds(goal_dir):
    dirs = []
    e0 = os.path.join(goal_dir, "experiment0")
    if os.path.isdir(e0):
        dirs.append(e0)
    exps = os.path.join(goal_dir, "experiments")
    if os.path.isdir(exps):
        dirs += [os.path.join(exps, d) for d in sorted(os.listdir(exps))]
    seeds = []
    for d in dirs:
        p = os.path.join(d, "experiment.md")
        if not os.path.isfile(p):
            continue
        grab = False
        for ln in open(p, encoding="utf-8", errors="ignore"):
            s = ln.strip()
            if s.startswith("#"):
                grab = bool(re.search(r"next[- ]?idea|seed|frontier|untried|future", s, re.I))
                continue
            if grab and (s.startswith("- ") or s.startswith("* ")):
                item = s[2:].strip()
                if item and "{{" not in item:
                    seeds.append((os.path.basename(d), item))
    return seeds


def ordered_exps(led):
    return sorted(led.get("experiments", {}).items(), key=lambda kv: eidx(kv[0]))


def next_index(led):
    idxs = [eidx(k) for k in led.get("experiments", {})]
    return max(idxs) + 1 if idxs else 0


# ── the G0-G4 novelty gate ────────────────────────────────────────────────────
def run_gate(led, vec, goal_dir, exp_dir, built, require_sources_file):
    for k in ("family", "components", "controlled_vars", "sources"):
        if k not in vec:
            return False, f"vector missing '{k}'", {}
    if not isinstance(vec["components"], list) or not isinstance(vec["sources"], list) or not isinstance(vec["controlled_vars"], dict):
        return False, "vector components/sources must be lists and controlled_vars a map", {}
    aliases = led.get("aliases", {})
    family = canon(aliases, vec["family"])
    declared = [c for c in vec["components"] if str(c).strip()]
    if built:
        if not method_files(exp_dir):
            return False, f"POST: no built method files in {exp_dir} (run.sh + method code required)", {}
        used = derive_built_components(exp_dir, declared)
    else:
        used = declared
    comps = [canon(aliases, c) for c in used]
    S = {family} | set(comps)

    reg = led.get("approach_registry", []) or []
    prior_S = [set(e.get("S", [])) for e in reg]
    prior_comp_union = set()
    for e in reg:
        prior_comp_union |= set(e.get("components", []))
    new_components = set(comps) - prior_comp_union

    fams = read_families(goal_dir, led)
    if fams and family not in fams:
        return False, f"family '{family}' not in taxonomy.md closed enum {sorted(fams)} — broaden it with a human edit first", {}

    # G0 frozen-vars — the frozen set must stay untouched; extra vars only alongside a new component.
    frozen = led.get("frozen", {}) or {}
    cv = vec["controlled_vars"]
    for key, val in frozen.items():
        if key not in cv or not eqv(cv[key], val):
            return False, f"G0 frozen-vars: controlled var '{key}' changed/missing (expected {val!r}) — controlled variables changed = tuning, not a new way", {}
    extra = [k for k in cv if k not in frozen]
    if extra and not new_components:
        return False, f"G0 frozen-vars: added controlled var(s) {extra} without a never-seen component — tuning, not a new way", {}

    # G2 pure-tuning — an exact structural duplicate of a prior is never a new way.
    for e in reg:
        if set(e.get("S", [])) == S:
            if e.get("controlled_vars", {}) != cv:
                return False, f"G2 pure-tuning: structural set identical to {e.get('experiment')}, only controlled_vars moved — parameter tuning, not a new way", {}
            return False, f"G2: structural set identical to {e.get('experiment')} — not a new way", {}

    # G1 near-duplicate.
    best_j, nearest = 0.0, None
    for e, Sp in zip(reg, prior_S):
        j = jaccard(S, Sp)
        if j > best_j:
            best_j, nearest = j, e.get("experiment")
    if best_j >= DUP_JACCARD:
        return False, f"G1 near-duplicate: Jaccard {best_j:.2f} vs {nearest} (>= {DUP_JACCARD:.2f}) — too close to a prior approach", {}

    # G3 new-component (positive requirement).
    if not new_components:
        return False, "G3 new-component: introduces no never-before-seen component — every accepted experiment must add >=1 new method element", {}

    # G4 new-source.
    new_sources = [str(s).strip() for s in vec["sources"] if str(s).strip()]
    if not new_sources:
        return False, "G4 new-source: no source cited — must cite >=1 freshly-fetched source", {}
    new_set = set(new_sources)
    for e in reg:
        ps = set(e.get("sources", []))
        if new_set <= ps:
            return False, f"G4 new-source: sources are a subset of {e.get('experiment')} — recycled, not freshly fetched", {}
    all_prior = set()
    for e in reg:
        all_prior |= set(e.get("sources", []))
    fresh = new_set - all_prior
    if not fresh:
        return False, "G4 new-source: no freshly-fetched source absent from all prior experiments", {}
    smd = os.path.join(exp_dir, "sources.md") if exp_dir else None
    if smd and os.path.isfile(smd):
        txt = open(smd, encoding="utf-8", errors="ignore").read()
        missing = [s for s in fresh if s not in txt]
        if missing:
            return False, f"G4 new-source: fresh source(s) {missing} not found in sources.md — uncited/hallucinated", {}
    elif require_sources_file:
        return False, f"G4 new-source: sources.md missing in {exp_dir} — cannot verify fresh citations", {}

    info = {
        "novelty_distance": round(1.0 - best_j, 4),
        "S": sorted(S),
        "family": family,
        "components": comps,
        "new_components": sorted(new_components),
        "fresh_sources": sorted(fresh),
        "nearest": nearest,
        "sources": new_sources,
        "controlled_vars": cv,
    }
    return True, "", info


def stall_stats(led):
    dirn = direction(led)
    eps = float(budget(led).get("epsilon", 0) or 0)
    best_val = led.get("baseline")
    no_improve = 0
    for name, e in ordered_exps(led):
        v = e.get("metric")
        if eidx(name) == 0:
            if best_val is None:
                best_val = v
            continue
        if v is None:
            continue
        if best_val is None:
            best_val = v
            continue
        if is_better(v, best_val, dirn) and abs(v - best_val) >= eps:
            best_val, no_improve = v, 0
        else:
            if is_better(v, best_val, dirn):
                best_val = v
            no_improve += 1
    k = int(budget(led).get("patience_K", 5) or 5)
    nds = [e.get("novelty_distance") for name, e in ordered_exps(led) if eidx(name) > 0 and e.get("novelty_distance") is not None]
    recent = nds[-k:] if k > 0 else nds
    nmean = round(sum(recent) / len(recent), 4) if recent else None
    return no_improve, nmean, best_val


def recompute_best(led):
    dirn = direction(led)
    best = None
    for name, e in ordered_exps(led):
        mv = e.get("metric")
        if mv is None:
            continue
        if best is None or is_better(mv, best["value"], dirn):
            best = {"experiment": name, "value": mv}
    led["best"] = best
    tgt = target(led)
    led["goal_met"] = bool(best and tgt is not None and is_met(best["value"], tgt, dirn))


# ── ledger-path resolution (‑‑goal / ‑‑file / auto-discover) ──────────────────
def resolve_path(a):
    if getattr(a, "file", None):
        return a.file
    if getattr(a, "goal", None):
        return os.path.join("research", a.goal, "research_ledger.json")
    hits = []
    root = "research"
    if os.path.isdir(root):
        for d in sorted(os.listdir(root)):
            p = os.path.join(root, d, "research_ledger.json")
            if os.path.isfile(p):
                hits.append(p)
    if len(hits) == 1:
        return hits[0]
    if not hits:
        sys.exit("no research ledger found (run: tiger/research.py init --goal <goalId>)")
    sys.exit("multiple ledgers found; pass --goal <goalId>: " + ", ".join(hits))


def cmd_init(a):
    goal_id = a.goal
    if not goal_id:
        sys.exit("init requires --goal <goalId>")
    gd = os.path.join("research", goal_id)
    fm = read_frontmatter(os.path.join(gd, "goal.md"))
    metric = fm.get("metric") or {}
    frozen = fm.get("frozen") or {}
    axes = fm.get("taxonomy_axes") or fm.get("taxonomy") or []
    baseline = metric.get("baseline")
    out = a.file or os.path.join(gd, "research_ledger.json")

    led = load(out) if os.path.isfile(out) else {"schema_version": 1}
    led["schema_version"] = 1
    led["status"] = led.get("status") or "running"
    led["goal"] = {
        "id": fm.get("id", goal_id),
        "title": fm.get("title", ""),
        "metric": {"name": metric.get("name"), "target": metric.get("target"), "direction": metric.get("direction")},
        "harness": fm.get("harness", ""),
        "harness_timeout_s": fm.get("harness_timeout_s"),
        "taxonomy_axes": list(axes),
    }
    led["frozen"] = dict(frozen)
    led["baseline"] = baseline
    led["budget"] = dict(fm.get("budget") or {})
    led.setdefault("aliases", {})
    led.setdefault("approach_registry", [])
    led.setdefault("experiments", {})
    led.setdefault("goal_met", False)
    led.setdefault("best", None)

    if not led["experiments"]:
        led["experiments"]["experiment0"] = {
            "family": "baseline", "components": [], "controlled_vars": dict(frozen), "sources": [],
            "hypothesis": "baseline run under the frozen controlled vars", "nearest_prior": None,
            "novelty_distance": None, "metric": baseline, "status": "baseline", "delta_vs_best": 0,
        }
        led["approach_registry"] = [{
            "experiment": "experiment0", "family": "baseline", "components": [],
            "S": ["baseline"], "sources": [], "controlled_vars": dict(frozen),
        }]
        if baseline is not None:
            led["best"] = {"experiment": "experiment0", "value": baseline}
    recompute_best(led)
    print(f"init {goal_id}: baseline={baseline} metric={metric.get('name')} direction={metric.get('direction')} target={metric.get('target')}")
    save(out, led)


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(prog="tiger/research.py", description="Novelty engine + append-only research ledger (schema v1), git-free.")
    p.add_argument("--file", default="")
    p.add_argument("--goal", default="")
    # Accept --file/--goal on either side of the subcommand; SUPPRESS keeps a value given BEFORE it
    # from being clobbered by the subparser default when it is omitted AFTER it.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--file", default=argparse.SUPPRESS)
    common.add_argument("--goal", default=argparse.SUPPRESS)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", parents=[common])
    sub.add_parser("summary", parents=[common])
    sub.add_parser("vectors", parents=[common])
    sub.add_parser("frontier", parents=[common])
    sub.add_parser("next-n", parents=[common])
    sub.add_parser("stall-check", parents=[common])
    nc = sub.add_parser("novelty-check", parents=[common]); nc.add_argument("vector"); nc.add_argument("--built", default="")
    rg = sub.add_parser("register", parents=[common]); rg.add_argument("experiment")
    rr = sub.add_parser("record-result", parents=[common]); rr.add_argument("experiment"); rr.add_argument("--metric", required=True); rr.add_argument("--status", required=True)
    al = sub.add_parser("alias", parents=[common]); al.add_argument("tagA"); al.add_argument("tagB")
    st = sub.add_parser("set-status", parents=[common]); st.add_argument("status")
    sub.add_parser("close", parents=[common])

    a = p.parse_args()

    if a.cmd == "init":
        return cmd_init(a)

    path = resolve_path(a)
    led = load(path)

    if a.cmd == "summary":
        g = led.get("goal", {}) or {}
        m = g.get("metric", {}) or {}
        print(f"goal: {g.get('id', '?')} — {g.get('title', '')}")
        print(f"status: {led.get('status')}   goal_met: {led.get('goal_met')}")
        print(f"metric: {m.get('name', '?')}  target={m.get('target')}  direction={m.get('direction')}")
        print(f"harness: {g.get('harness', '')}")
        frozen = led.get("frozen", {}) or {}
        print("frozen controlled vars: " + (", ".join(f"{k}={v}" for k, v in frozen.items()) or "(none)"))
        print(f"baseline: {led.get('baseline')}")
        best = led.get("best")
        print(f"best: {best['experiment']} = {best['value']}" if best else "best: (none)")
        b = budget(led)
        used = len([1 for name in led.get("experiments", {}) if eidx(name) > 0])
        mi = b.get("max_iters")
        rem = (mi - used) if isinstance(mi, int) else "?"
        print(f"budget: iters {used}/{mi} (remaining {rem})  wall_hours={b.get('wall_hours')}  patience_K={b.get('patience_K')}  epsilon={b.get('epsilon')}  novelty_floor={b.get('novelty_floor')}")
        ni, nm, _ = stall_stats(led)
        print(f"stall: noImprove={ni}  rolling_novelty_mean={nm}")
        print("experiments:")
        print(f"  {'iter':<12}{'family':<22}{'metric':<12}{'delta':<10}{'status':<11}novelty")
        for name, e in ordered_exps(led):
            print(f"  {name:<12}{str(e.get('family', '')):<22}{str(e.get('metric')):<12}{str(e.get('delta_vs_best')):<10}{str(e.get('status', '')):<11}{e.get('novelty_distance')}")
        return 0

    if a.cmd == "vectors":
        for name, e in ordered_exps(led):
            print(f"{name}: family={e.get('family')}  components={e.get('components')}")
            print(f"    hypothesis: {e.get('hypothesis', '')}")
            print(f"    nearest_prior={e.get('nearest_prior')}  novelty_distance={e.get('novelty_distance')}")
        return 0

    if a.cmd == "frontier":
        gd = goal_dir_of(path)
        aliases = led.get("aliases", {})
        fams = sorted(read_families(gd, led))
        tried = set(canon(aliases, e.get("family", "")) for _, e in ordered_exps(led))
        untried = [f for f in fams if f not in tried]
        print("families: " + (", ".join(fams) or "(none)"))
        print("tried:    " + (", ".join(sorted(tried)) or "(none)"))
        print("untried:  " + (", ".join(untried) or "(none)"))
        print("untried family-pairs (composition candidates):")
        pairs = [(x, y) for x, y in itertools.combinations(fams, 2) if not (x in tried and y in tried)]
        for x, y in pairs[:12]:
            print(f"  {x} + {y}")
        print("next-idea seeds (from prior notes):")
        for src, item in collect_seeds(gd)[:20]:
            print(f"  [{src}] {item}")
        return 0

    if a.cmd == "next-n":
        print(f"experiment{next_index(led)}")
        return 0

    if a.cmd == "stall-check":
        ni, nm, _ = stall_stats(led)
        b = budget(led)
        k = b.get("patience_K")
        floor = b.get("novelty_floor")
        print(f"noImprove: {ni} / patience_K {k}")
        print(f"rolling_novelty_mean: {nm if nm is not None else 'n/a'} / novelty_floor {floor}")
        stalled = (isinstance(k, int) and ni >= k) or (nm is not None and floor is not None and nm < floor)
        print(f"stalled: {'YES' if stalled else 'no'}")
        return 0

    if a.cmd == "novelty-check":
        vec = load_json(a.vector)
        gd = goal_dir_of(path)
        exp_dir = a.built if a.built else os.path.dirname(os.path.abspath(a.vector))
        built = bool(a.built)
        ok, why, info = run_gate(led, vec, gd, exp_dir, built=built, require_sources_file=built)
        if not ok:
            refuse(("POST(from built files) " if built else "") + why)
        print(f"ACCEPT{' (POST, from built files)' if built else ''} — novelty_distance={info['novelty_distance']} "
              f"new_components={info['new_components']} fresh_sources={info['fresh_sources']} nearest={info['nearest']}")
        return 0

    if a.cmd == "register":
        expN = a.experiment
        if eidx(expN) != next_index(led):
            refuse(f"register expected experiment{next_index(led)}, got {expN} (append-only, monotonic index)")
        if expN in led["experiments"]:
            sys.exit(f"{expN} already registered")
        ed = exp_dir_of(path, expN)
        gd = goal_dir_of(path)
        vec = load_json(os.path.join(ed, "vector.json"))
        ok, why, _ = run_gate(led, vec, gd, ed, built=False, require_sources_file=True)
        if not ok:
            refuse("PRE " + why)
        ok, why, info = run_gate(led, vec, gd, ed, built=True, require_sources_file=True)
        if not ok:
            refuse("POST(from built files) " + why)
        led["experiments"][expN] = {
            "family": vec["family"], "components": vec["components"], "controlled_vars": vec["controlled_vars"],
            "sources": vec["sources"], "hypothesis": vec.get("hypothesis", ""), "nearest_prior": vec.get("nearest_prior"),
            "novelty_distance": info["novelty_distance"], "metric": None, "status": "pending", "delta_vs_best": None,
        }
        led["approach_registry"].append({
            "experiment": expN, "family": info["family"], "components": info["components"],
            "S": info["S"], "sources": info["sources"], "controlled_vars": vec["controlled_vars"],
        })
        print(f"registered {expN}: novelty_distance={info['novelty_distance']} new_components={info['new_components']}")
        return save(path, led)

    if a.cmd == "record-result":
        expN = a.experiment
        if a.status not in RESULT_STATUS:
            sys.exit(f"--status must be one of {sorted(RESULT_STATUS)}")
        e = led.get("experiments", {}).get(expN)
        if not isinstance(e, dict):
            sys.exit(f"{expN} not registered")
        v = num(a.metric)
        dirn = direction(led)
        prev = (led.get("best") or {}).get("value")
        e["metric"] = v
        e["status"] = a.status
        e["delta_vs_best"] = round(dir_delta(v, prev, dirn), 6) if prev is not None else None
        recompute_best(led)
        print(f"record-result {expN}: metric={v} status={a.status} best={led.get('best')} goal_met={led.get('goal_met')}")
        return save(path, led)

    if a.cmd == "alias":
        led.setdefault("aliases", {})[norm(a.tagA)] = norm(a.tagB)
        return save(path, led)

    if a.cmd == "set-status":
        led["status"] = a.status
        return save(path, led)

    if a.cmd == "close":
        led["closed"] = True
        return save(path, led)

    return 2


if __name__ == "__main__":
    sys.exit(main())
