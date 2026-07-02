---
name: install
description: One-command setup AND migration of the Tiger development kit in a project — copies the workflow, rm guard, and markdown + Robot templates, ensures main + a dev integration branch, migrates any old-version artifacts (HTML specs/codemap → markdown) to the current version, seeds harness state, verifies, then stops. Never grills, never builds.
---

# Tiger Install

Bootstraps AND migrates a target project for the Tiger kit. Invoke in the project to set up:

```text
/tiger-skills:install
```

This command **installs and migrates** — it copies plugin-owned files, ensures the `main`/`dev`
branches, and converts any old-version artifacts to the current format. It never grills, plans, or
writes feature code. When done it prints a report and stops; start a feature with `tiger-grill`, then
run `/tiger-workflow-dev` once the spec is approved.

## Operating Rules (read before acting)

- **Idempotent.** Every step checks before it acts. A re-run on an up-to-date project visibly no-ops.
- **Migrate plugin-owned formats; preserve human content.** Plugin-owned files (the workflow, the rm
  guard, the templates) and plugin-owned artifact *formats/filenames* (old HTML specs/codemap) ARE
  migrated to the current version. Human-authored *content* inside artifacts is preserved through the
  conversion. Human content files (their code, their board values, their `CLAUDE.md`) are never clobbered.
- **Missing source = loud FATAL stop.** If a file you must copy is not in the plugin, stop with a fatal message.
- **Report everything.** Track each item as `created` | `migrated` | `skipped (already correct)` | `verified` | `NEEDS HUMAN`. Print the table at the end.
- **No coding.** Never bypass grill, approval, WIP=1, or `./init.sh`, and never start a build.

Run the steps in order. Treat `<project>` as the current working directory; quote every path.

## Step 1 — Locate the plugin root (FATAL if missing)

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/workflows/tiger-workflow-dev.js" ] || \
  PLUGIN_ROOT="$(dirname "$(dirname "$(find "$HOME/.claude/plugins" -name tiger-workflow-dev.js -path '*tiger-skills*' 2>/dev/null | sort | tail -1)")")"
[ -n "$PLUGIN_ROOT" ] && [ -d "$PLUGIN_ROOT/workflows" ] && [ -d "$PLUGIN_ROOT/templates" ] || {
  echo "FATAL: tiger-skills plugin root not found. Cannot install — stopping."; exit 1;
}
echo "plugin root: $PLUGIN_ROOT"
```

Reuse `$PLUGIN_ROOT` in every later step. A missing required source under it is a FATAL stop.

## Step 2 — Copy / refresh the workflow (the `/tiger-workflow-dev` slash command)

The workflow is plugin-owned, so refresh it to the current plugin version (this is how a project
picks up a new plugin release). If the project copy differs, back it up and update it:

```bash
SRC="$PLUGIN_ROOT/workflows/tiger-workflow-dev.js"
DST=".claude/workflows/tiger-workflow-dev.js"
[ -f "$SRC" ] || { echo "FATAL: workflow source missing at $SRC — stopping."; exit 1; }
mkdir -p .claude/workflows
if [ ! -f "$DST" ]; then
  cp "$SRC" "$DST"; echo "workflow: created"
elif cmp -s "$SRC" "$DST"; then
  echo "workflow: skipped (already correct)"
else
  cp "$DST" "$DST.bak"; cp "$SRC" "$DST"
  echo "workflow: migrated (refreshed to current plugin version; previous saved as $DST.bak — re-apply any model repins)"
fi
```

## Step 3 — Install the rm guard + merge the PreToolUse hook + VERIFY

The rm guard is non-negotiable; a build must not proceed if this fails.

**3a. Copy + chmod (plugin-owned safety logic — always refreshed):**

```bash
GSRC="$PLUGIN_ROOT/project-hooks/tiger-block-rm.sh"
GDST=".claude/hooks/tiger-block-rm.sh"
[ -f "$GSRC" ] || { echo "FATAL: rm guard source missing at $GSRC — stopping."; exit 1; }
mkdir -p .claude/hooks
if [ ! -f "$GDST" ]; then cp "$GSRC" "$GDST"; chmod +x "$GDST"; echo "rm guard file: created"
elif cmp -s "$GSRC" "$GDST"; then chmod +x "$GDST"; echo "rm guard file: skipped (already correct)"
else cp "$GSRC" "$GDST"; chmod +x "$GDST"; echo "rm guard file: migrated (refreshed to plugin version)"; fi
```

**3b. Merge the PreToolUse Bash hook into `.claude/settings.json`** key-preserving (never replace), adding
the hook only if no entry already runs `tiger-block-rm.sh`:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        { "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/tiger-block-rm.sh\"", "timeout": 5 }
      ]
    }
  ]
}
```

Use `python3` for the merge: load existing JSON (start `{}` if missing/empty), ensure `PreToolUse` is a
list, append the guard hook only if absent. Report `created` / `skipped (already correct)` / `NEEDS HUMAN`.

**3c. VERIFY (the gate):**

```bash
RM_OUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"rm -rf build"}}' | bash "$GDST"; echo "exit=$?")
SAFE_OUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | bash "$GDST"; echo "exit=$?")
case "$RM_OUT" in *exit=2*) RM_OK=1;; *) RM_OK=0;; esac
case "$SAFE_OUT" in *exit=0*) SAFE_OK=1;; *) SAFE_OK=0;; esac
if [ "$RM_OK" = 1 ] && [ "$SAFE_OK" = 1 ]; then echo "rm guard: verified (rm exits 2, safe exits 0)"
else echo "rm guard: NEEDS HUMAN — verification FAILED (rm=$RM_OUT, safe=$SAFE_OUT). Do NOT build until this passes."; fi
```

If verification fails, mark `NEEDS HUMAN` and state no build may proceed.

## Step 4 — Copy the templates (markdown + Robot; refresh plugin-owned, keep customized)

Copy the seven current templates into `tiger/templates/`: four markdown artifacts (`feature.md`,
`CODEBASE_MAP.md`, `business.md`, `release_docs.md`) plus the two Robot e2e templates
(`e2e_testcases.robot`, `e2e_keywords.resource`). A customized (human-edited) copy is kept and reported;
an unchanged copy is refreshed silently.

```bash
mkdir -p tiger/templates
for f in feature.md CODEBASE_MAP.md business.md release_docs.md e2e_testcases.robot e2e_keywords.resource; do
  TS="$PLUGIN_ROOT/templates/$f"; TD="tiger/templates/$f"
  [ -f "$TS" ] || { echo "FATAL: template source missing at $TS — stopping."; exit 1; }
  if [ ! -f "$TD" ]; then cp "$TS" "$TD"; echo "template $f: created"
  elif cmp -s "$TS" "$TD"; then echo "template $f: skipped (already correct)"
  else echo "template $f: NEEDS HUMAN — customized copy DIFFERS; kept theirs."; fi
done
# Remove retired HTML templates (plugin-owned; superseded by the markdown set).
for old in spec.html adr.html business.html codemap.html release_docs.html e2e_testcases.html; do
  [ -f "tiger/templates/$old" ] && { rm -f "tiger/templates/$old"; echo "template $old: migrated (removed retired HTML template)"; }
done
```

**Board helper.** Copy the Python board CLI `scripts/board.py` to `tiger/board.py` (plugin-owned;
always refreshed). Stages call it to read and surgically patch `feature_list.json` instead of dumping
and hand-rewriting the whole board:

```bash
BSRC="$PLUGIN_ROOT/scripts/board.py"; BDST="tiger/board.py"
[ -f "$BSRC" ] || { echo "FATAL: board helper source missing at $BSRC — stopping."; exit 1; }
if [ ! -f "$BDST" ]; then cp "$BSRC" "$BDST"; echo "board helper: created (tiger/board.py)"
elif cmp -s "$BSRC" "$BDST"; then echo "board helper: skipped (already correct)"
else cp "$BSRC" "$BDST"; echo "board helper: migrated (refreshed to plugin version)"; fi
```

**Research loop (git-free).** Copy the second workflow, its novelty-engine CLI, and the research templates so `/research-goal` + `/research-workflow` work. `research.py` lands at the **project root** (the loop is deliberately standalone — it drives a local `research/<goalId>/` tree, no git, no board):

```bash
# second workflow → /research-workflow
RSRC="$PLUGIN_ROOT/workflows/research-workflow.js"; RDST=".claude/workflows/research-workflow.js"
[ -f "$RSRC" ] || { echo "FATAL: research workflow source missing at $RSRC — stopping."; exit 1; }
mkdir -p .claude/workflows
if [ ! -f "$RDST" ]; then cp "$RSRC" "$RDST"; echo "research workflow: created"
elif cmp -s "$RSRC" "$RDST"; then echo "research workflow: skipped (already correct)"
else cp "$RDST" "$RDST.bak"; cp "$RSRC" "$RDST"; echo "research workflow: migrated (previous saved as $RDST.bak)"; fi

# novelty engine + ledger CLI → project-root research.py
PSRC="$PLUGIN_ROOT/scripts/research.py"; PDST="research.py"
[ -f "$PSRC" ] || { echo "FATAL: research.py source missing at $PSRC — stopping."; exit 1; }
if [ ! -f "$PDST" ]; then cp "$PSRC" "$PDST"; echo "research helper: created (research.py)"
elif cmp -s "$PSRC" "$PDST"; then echo "research helper: skipped (already correct)"
else cp "$PSRC" "$PDST"; echo "research helper: migrated (refreshed to plugin version)"; fi

# research templates → tiger/templates/research/
mkdir -p tiger/templates/research
for f in goal.md taxonomy.md experiment.md research_ledger.json; do
  TS="$PLUGIN_ROOT/templates/research/$f"; TD="tiger/templates/research/$f"
  [ -f "$TS" ] || { echo "FATAL: research template $f missing at $TS — stopping."; exit 1; }
  if [ ! -f "$TD" ]; then cp "$TS" "$TD"; echo "research template $f: created"
  elif cmp -s "$TS" "$TD"; then echo "research template $f: skipped (already correct)"
  else echo "research template $f: NEEDS HUMAN — customized copy DIFFERS; kept theirs."; fi
done
```

## Step 5 — Migrate old-version artifacts (every run; no-op on a current project)

Convert any v5/earlier artifacts to the v6 markdown format, **preserving human content**. Do each only
if the old form exists; report `migrated` per item, or note "nothing to migrate" if none found. Use an
agentic read→convert→write for the HTML→markdown conversions (read the old HTML, extract its sections,
write the markdown shape from `tiger/templates/`), then remove the old file.

1. **Per-feature docs** — for each `tiger/features/<id>/` containing `spec.html` (and optional
   `adr.html`/`business.html`) but no `feature.md`: write `tiger/features/<id>/feature.md` merging the
   three (Problem/JTBD + What we'll do from spec, Why/Decisions from adr, Business context from
   business). Set frontmatter `tiger-status: approved` **iff** the old `spec.html` contained
   `content="approved"`, else `awaiting_review`. Then remove the three `.html` files.
2. **Codemap** — if `tiger/codemap.html` exists: convert it to `tiger/CODEBASE_MAP.md` (the markdown shape
   in `tiger/templates/CODEBASE_MAP.md`: Overview, System map, Modules, How it works per workflow,
   Business glossary, Recent changes), then remove `tiger/codemap.html`.
3. **Global docs** — `tiger/business.html` → `tiger/business.md`; `tiger/release_docs.html` →
   `tiger/release_docs.md` (convert content, remove the old `.html`).
4. **Board structure** — a v5/earlier `feature_list.json` is a bare object whose `features` is a **list**
   (no `schema_version`, often no `current_feature`). board.py and the workflow bootstrap require the
   **schema-v2 dict** shape (`features` keyed by id), so an unmigrated list-board makes grill's board write
   crash and the workflow abort discovery. Convert it in place, **preserving every field** (back it up first):
   ```bash
   [ -f feature_list.json ] && python3 - <<'PY'
import json, sys
p="feature_list.json"
b=json.load(open(p,encoding="utf-8"))
feats=b.get("features")
if not isinstance(feats,list):
    print("board structure: skipped (already schema-v2 dict)"); sys.exit(0)
import shutil; shutil.copyfile(p,p+".pre-v2.bak")
PHASE={"plan","build","validate","blocked","passing"}
d={}
for x in feats:
    fid=x.get("id")
    if not fid:
        print("board structure: NEEDS HUMAN — a feature has no id; cannot key it"); sys.exit(0)
    if x.get("phase") not in PHASE:
        x["phase"]="passing" if x.get("status")=="passing" else "plan"
    d[fid]=x
ip=[k for k,v in d.items() if v.get("status")=="in_progress"]
new={"schema_version":2,"current_feature":(ip[0] if len(ip)==1 else None),"features":d}
for k,v in b.items():
    if k not in new: new[k]=v
json.dump(new,open(p,"w",encoding="utf-8"),indent=2,ensure_ascii=False); open(p,"a",encoding="utf-8").write("\n")
print(f"board structure: migrated (list -> schema-v2 dict, {len(d)} features; current_feature={new['current_feature']}; backup .pre-v2.bak)")
PY
   ```
   Then run `python3 tiger/board.py summary` to confirm it validates; if board.py reports a broken invariant
   (e.g. non-reciprocal `depends_on`/`blocks`), mark `board structure` `NEEDS HUMAN` with the message.
5. **Board spec_file paths** — rewrite every `spec_file` ending `/spec.html` to `/feature.md` (run AFTER the
   structural migration above, so `features` is a dict):
   ```bash
   [ -f feature_list.json ] && grep -q '/spec\.html"' feature_list.json && {
     python3 - <<'PY'
import json
b=json.load(open("feature_list.json",encoding="utf-8"))
ch=False
for f in b.get("features",{}).values():
    sf=f.get("spec_file","")
    if sf.endswith("/spec.html"):
        f["spec_file"]=sf[:-len("/spec.html")]+"/feature.md"; ch=True
if ch:
    json.dump(b,open("feature_list.json","w",encoding="utf-8"),indent=2); open("feature_list.json","a",encoding="utf-8").write("\n")
PY
     echo "board spec_file paths: migrated (.../spec.html -> .../feature.md)"; }
   ```
6. Report "migration: nothing to convert" when none of the above old forms were present.

## Step 6 — Verify / seed harness state

Each item is checked before it is written; existing files are never clobbered.

**6a. Board** — empty schema-v2 board if missing (never copy the demo reference):

```bash
if [ -f feature_list.json ]; then echo "feature_list.json: skipped (already exists)"; else
  printf '%s\n' '{ "schema_version": 2, "current_feature": null, "features": {} }' > feature_list.json; echo "feature_list.json: created (empty board)"; fi
```

**6b. Progress log:**

```bash
if [ -f progress.md ]; then echo "progress.md: skipped (already exists)"; else printf '%s\n' '# Progress Log' > progress.md; echo "progress.md: created"; fi
```

**6c. CLAUDE.md** — minimal manual naming the project + its test command, only if missing. Fill real
values from the repo; only fall back to a `TODO … NEEDS HUMAN` line for a value you cannot determine:

```bash
if [ -f CLAUDE.md ]; then echo "CLAUDE.md: skipped (already exists)"; else
  NAME="$(basename "$PWD")"
  [ -f package.json ] && NAME="$(python3 -c 'import json;print(json.load(open("package.json")).get("name") or "")' 2>/dev/null || echo "$NAME")"
  if   [ -f package.json ]; then TEST="npm test"
  elif [ -f Cargo.toml ];  then TEST="cargo test"
  elif [ -f go.mod ];      then TEST="go test ./..."
  elif [ -f pyproject.toml ] || [ -f setup.py ] || ls tests/*.py >/dev/null 2>&1; then TEST="python3 -m pytest"
  elif [ -f Makefile ] && grep -qE '^test:' Makefile; then TEST="make test"
  else TEST="TODO — set the project's test command (NEEDS HUMAN)"; fi
  printf '# %s\nRun tests: %s.\n' "${NAME:-$(basename "$PWD")}" "$TEST" > CLAUDE.md
  case "$TEST" in TODO*) echo "CLAUDE.md: created — but test command is NEEDS HUMAN";; *) echo "CLAUDE.md: created (test: $TEST)";; esac
fi
```

**6d. `init.sh` — the verification entrypoint, SCAFFOLDED.** Writes a runnable gate from the detected
test command, or a **fail-closed stub** (exits non-zero) when the toolchain is unknown, so a build can
never run green on an unverified gate. An existing `init.sh` is kept.

```bash
if [ -f init.sh ]; then chmod +x init.sh 2>/dev/null || true; echo "init.sh: skipped (already exists — kept yours)"; else
  if   [ -f package.json ]; then ITEST="npm test"
  elif [ -f Cargo.toml ];  then ITEST="cargo test"
  elif [ -f go.mod ];      then ITEST="go test ./..."
  elif [ -f pyproject.toml ] || [ -f setup.py ] || ls tests/*.py >/dev/null 2>&1; then ITEST="python3 -m pytest"
  elif [ -f Makefile ] && grep -qE '^test:' Makefile; then ITEST="make test"
  else ITEST=""; fi
  if [ -n "$ITEST" ]; then
    printf '#!/usr/bin/env bash\nset -euo pipefail\necho "== Tiger verify: %s =="\n%s\n' "$ITEST" "$ITEST" > init.sh
    chmod +x init.sh; echo "init.sh: created (runs: $ITEST)"
  else
    printf '#!/usr/bin/env bash\nset -euo pipefail\necho "Tiger: init.sh is not configured yet — add this project'\''s test command." >&2\nexit 1\n' > init.sh
    chmod +x init.sh; echo "init.sh: created (STUB — NEEDS HUMAN: wire the real test command; fails closed until you do)"
  fi
fi
```

If a STUB was written, mark `init.sh` `NEEDS HUMAN`.

**6e. `main` + `dev` branches born** — the kit is git-based: `main` is the protected release branch and
`dev` is the integration trunk the pipeline branches `feature/<id>` from and merges back to. This
`git init`s a non-repo, ensures `main` exists with a first commit when unborn, then ensures a born `dev`
branched from `main`:

```bash
if ! git rev-parse --git-dir >/dev/null 2>&1; then git init -q && echo "git repo: created (git init)"; fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  git show-ref --verify --quiet refs/heads/main && echo "main branch: verified" || { git checkout -b main >/dev/null 2>&1 && echo "main branch: created"; }
  git rev-parse HEAD >/dev/null 2>&1 || { git add -A && git commit -qm "chore(tiger): install harness state + rm guard" && echo "main initial commit: created (was unborn)"; }
  if git show-ref --verify --quiet refs/heads/dev; then echo "dev branch: verified"; else
    git branch dev main >/dev/null 2>&1 && echo "dev branch: created (born from main — the integration trunk)" || echo "dev branch: NEEDS HUMAN — could not create dev from main"; fi
else
  echo "main/dev trunk: NEEDS HUMAN — could not initialize a git repo; run 'git init' then rerun install."
fi
```

## Step 7 — Print the report, then STOP

Collect every line from steps 2–6 into one table; each item is `created` | `migrated` |
`skipped (already correct)` | `verified` | `NEEDS HUMAN`:

```text
Tiger install report
--------------------------------------------------
workflow (.claude/workflows/tiger-workflow-dev.js)  ...  <status>
rm guard file (.claude/hooks/tiger-block-rm.sh)     ...  <status>
rm guard PreToolUse hook (.claude/settings.json)    ...  <status>
rm guard verification (rm→2, safe→0)                ...  <status>
template feature.md                                  ...  <status>
template CODEBASE_MAP.md                             ...  <status>
template business.md                                 ...  <status>
template release_docs.md                             ...  <status>
template e2e_testcases.robot                          ...  <status>
template e2e_keywords.resource                        ...  <status>
board helper (tiger/board.py)                        ...  <status>
migration (old HTML artifacts → markdown)            ...  <status>
feature_list.json                                    ...  <status>
progress.md                                          ...  <status>
CLAUDE.md                                            ...  <status>
init.sh                                              ...  <status>
main branch                                          ...  <status>
dev branch                                           ...  <status>
--------------------------------------------------
```

If any line is `NEEDS HUMAN`, list those again under "Needs your attention" with the fix for each, and
state that **a build must not proceed until the rm guard verifies and `init.sh` runs the real tests**.

Then **STOP.** Tell the human to start a feature with `tiger-grill`, then run `/tiger-workflow-dev` once
the spec is approved (no args needed). Do not grill, plan, or write code from this command.
