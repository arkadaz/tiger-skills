---
name: install
description: One-command, idempotent setup of the Tiger development kit in a project — copies the workflow, rm guard, and artifact templates (HTML + the Robot Framework e2e suite/resource), seeds harness state, verifies everything, then stops. Never grills, never builds.
---

# Tiger Install

Bootstraps a target project for the Tiger development kit. Invoke in the project you want to set up:

```text
/tiger-skills:install
```

This command **only installs**. It never grills, never plans, never writes code, never opens the board to build. When it finishes it prints a report and stops, leaving the human to start a feature with the `tiger-grill` skill (then run `/tiger-workflow-dev` once the spec is approved).

## Operating Rules (read before acting)

- **Idempotent, always.** Every step checks before it acts. A rerun on an already-set-up project visibly no-ops: each item reports `skipped (already correct)` or `verified`, nothing is clobbered.
- **Never overwrite human content.** If a destination file already exists and differs from the source, **keep theirs** and report the difference — do not merge silently, do not overwrite. The only exception is `.claude/settings.json`, which is *merged* key-preserving (never replaced).
- **Missing source = loud FATAL stop.** If a file you must copy cannot be located in the plugin, stop the whole command with a fatal message. Never silently skip — a half-installed project is worse than an un-installed one.
- **Report everything.** Track each item as one of: `created` | `skipped (already correct)` | `verified` | `NEEDS HUMAN`. Print the table at the end.
- **No coding.** This command must never bypass grill, approval, WIP=1, or `./init.sh`, and it must never start a build.

Run the steps below **in order**. Treat `<project>` as the current working directory (the project being set up), and quote every path (the plugin path may contain spaces).

## Step 1 — Locate the plugin root (FATAL if missing)

`${CLAUDE_PLUGIN_ROOT}` is **not reliably set** inside a command's Bash, so use this exact fallback chain. Stop loud if the plugin cannot be found — there is nothing to install from:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/workflows/tiger-workflow-dev.js" ] || \
  PLUGIN_ROOT="$(dirname "$(dirname "$(find "$HOME/.claude/plugins" -name tiger-workflow-dev.js -path '*tiger-skills*' 2>/dev/null | sort | tail -1)")")"
[ -n "$PLUGIN_ROOT" ] && [ -d "$PLUGIN_ROOT/workflows" ] && [ -d "$PLUGIN_ROOT/templates" ] || {
  echo "FATAL: tiger-skills plugin root not found (no workflows/ + templates/). Cannot install — stopping."; exit 1;
}
echo "plugin root: $PLUGIN_ROOT"
```

Reuse `$PLUGIN_ROOT` in every later step. If any required **source** file under `$PLUGIN_ROOT` is missing when a step needs it, that step is a FATAL stop too.

## Step 2 — Copy the workflow (creates the `/tiger-workflow-dev` slash command)

Copying `workflows/tiger-workflow-dev.js` into the project's `.claude/workflows/` registers it as a saved workflow — a `/tiger-workflow-dev` slash command in that project (per code.claude.com/docs/en/workflows; the project copy wins over a personal one on a name collision).

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
  echo "workflow: NEEDS HUMAN — project copy DIFFERS from plugin's; kept theirs. Diff with: diff \"$DST\" \"$SRC\""
fi
```

Report `created` / `skipped (already correct)` / `NEEDS HUMAN` accordingly. Never overwrite a differing project copy — the project may have repinned models or edited the script.

## Step 3 — Install the rm guard + merge the PreToolUse hook + VERIFY

The rm guard is a non-negotiable. A later build must **not** proceed if this step fails. Copy the guard, make it executable, merge the PreToolUse Bash hook into `.claude/settings.json` (preserving every existing key), then prove it works.

**3a. Copy + chmod:**

```bash
GSRC="$PLUGIN_ROOT/project-hooks/tiger-block-rm.sh"
GDST=".claude/hooks/tiger-block-rm.sh"
[ -f "$GSRC" ] || { echo "FATAL: rm guard source missing at $GSRC — stopping (do not build without it)."; exit 1; }
mkdir -p .claude/hooks
if [ ! -f "$GDST" ]; then
  cp "$GSRC" "$GDST"; chmod +x "$GDST"; echo "rm guard file: created"
elif cmp -s "$GSRC" "$GDST"; then
  chmod +x "$GDST"; echo "rm guard file: skipped (already correct)"
else
  cp "$GSRC" "$GDST"; chmod +x "$GDST"; echo "rm guard file: created (refreshed to plugin version — guard logic is plugin-owned, not user content)"
fi
```

The guard script itself is plugin-owned safety logic (read-only surface for the project), so refreshing it to the plugin version is correct — unlike user content, it must stay canonical.

**3b. Merge the PreToolUse Bash hook into `.claude/settings.json`** without removing `extraKnownMarketplaces`, `enabledPlugins`, or any existing settings. Read the current file (if any), preserve all keys, and add this hook only if an equivalent one is not already present (idempotent — never append a duplicate):

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/tiger-block-rm.sh\"",
          "timeout": 5
        }
      ]
    }
  ]
}
```

Use `python3` to do a key-preserving merge: load the existing JSON (start from `{}` if the file is missing or empty), ensure `PreToolUse` is a list, and append the `Bash`/guard hook **only if** no existing entry already runs `tiger-block-rm.sh`. Write it back pretty-printed. Report `created` (hook added), `skipped (already correct)` (hook already present), or `NEEDS HUMAN` if the existing `settings.json` is malformed JSON you cannot safely parse.

**3c. VERIFY (do not skip — this is the gate):** the guard reads a JSON hook payload on stdin. An `rm` payload must exit 2 (deny); a safe payload must exit 0 (allow):

```bash
RM_OUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"rm -rf build"}}' | bash "$GDST"; echo "exit=$?")
SAFE_OUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' | bash "$GDST"; echo "exit=$?")
case "$RM_OUT" in *exit=2*) RM_OK=1;; *) RM_OK=0;; esac
case "$SAFE_OUT" in *exit=0*) SAFE_OK=1;; *) SAFE_OK=0;; esac
if [ "$RM_OK" = 1 ] && [ "$SAFE_OK" = 1 ]; then
  echo "rm guard: verified (rm exits 2, safe exits 0)"
else
  echo "rm guard: NEEDS HUMAN — verification FAILED (rm=$RM_OUT, safe=$SAFE_OUT). Do NOT build until this passes."
fi
```

If verification fails, mark it `NEEDS HUMAN` in the report and state plainly that no build may proceed until the guard blocks `rm` and allows safe commands.

## Step 4 — Copy the templates (never clobber a customized one)

Copy all seven templates into the project's `tiger/templates/`: five HTML artifacts (`spec.html`, `adr.html`, `business.html`, `codemap.html`, `release_docs.html`) plus the two Robot Framework e2e templates (`e2e_testcases.robot` — the agreed CASES grill writes; `e2e_keywords.resource` — the executable IMPLEMENTATIONS the tiger-e2e gate writes, Playwright behind the scenes). These are the per-feature and global artifact starting points the stages read. Never overwrite a customized template — a differing destination is reported and **theirs is kept**.

```bash
mkdir -p tiger/templates
for f in spec.html adr.html business.html codemap.html release_docs.html e2e_testcases.robot e2e_keywords.resource; do
  TS="$PLUGIN_ROOT/templates/$f"; TD="tiger/templates/$f"
  [ -f "$TS" ] || { echo "FATAL: template source missing at $TS — stopping."; exit 1; }
  if [ ! -f "$TD" ]; then
    cp "$TS" "$TD"; echo "template $f: created"
  elif cmp -s "$TS" "$TD"; then
    echo "template $f: skipped (already correct)"
  else
    echo "template $f: NEEDS HUMAN — customized copy DIFFERS; kept theirs."
  fi
done
```

Report each template line individually so a human can see which were created vs kept.

## Step 5 — Verify / seed harness state

Each item is checked before it is written. Existing files are never clobbered — only genuinely missing ones are seeded.

**5a. Board** — `feature_list.json` at the project root, an **empty** schema-v2 board so the project starts clean. The plugin's `templates/feature_list.json` is the full-shape **reference** (it carries example features to show the schema) — do NOT copy it verbatim, or a new project would start with demo features and a tripped WIP=1. grill adds the first feature entry; the architect plans it:

```bash
if [ -f feature_list.json ]; then echo "feature_list.json: skipped (already exists)"; else
  printf '%s\n' '{ "schema_version": 2, "current_feature": null, "features": {} }' > feature_list.json; echo "feature_list.json: created (empty board — grill fills the first feature)"; fi
```

**5b. Progress log** — append-only human log:

```bash
if [ -f progress.md ]; then echo "progress.md: skipped (already exists)"; else printf '%s\n' '# Progress Log' > progress.md; echo "progress.md: created"; fi
```

**5c. CLAUDE.md** — a minimal manual naming the project + its test command, only if missing. **You must fill real values, never the literal `<…>` placeholders.** Inspect the repo first and substitute what you find; only fall back to a `TODO … NEEDS HUMAN` line for a value you genuinely cannot determine (never invent a test command you cannot back up). Detect, then write:

```bash
if [ -f CLAUDE.md ]; then
  echo "CLAUDE.md: skipped (already exists)"
else
  # Detect the project name from the dir or a manifest, and the test command from the toolchain.
  NAME="$(basename "$PWD")"
  [ -f package.json ] && NAME="$(python3 -c 'import json;print(json.load(open("package.json")).get("name") or "")' 2>/dev/null || echo "$NAME")"
  if   [ -f package.json ];               then TEST="npm test"
  elif [ -f Cargo.toml ];                 then TEST="cargo test"
  elif [ -f go.mod ];                     then TEST="go test ./..."
  elif [ -f pyproject.toml ] || [ -f setup.py ] || ls tests/*.py >/dev/null 2>&1; then TEST="python3 -m pytest"
  elif [ -f Makefile ] && grep -qE '^test:' Makefile; then TEST="make test"
  else TEST="TODO — set the project's test command (NEEDS HUMAN)"; fi
  printf '# %s\nRun tests: %s.\n' "${NAME:-$(basename "$PWD")}" "$TEST" > CLAUDE.md
  case "$TEST" in TODO*) echo "CLAUDE.md: created — but test command is NEEDS HUMAN";; *) echo "CLAUDE.md: created (test: $TEST)";; esac
fi
```

If the detected test command is the `TODO` fallback, mark CLAUDE.md `NEEDS HUMAN` in the report.

**5d. `init.sh` — the verification entrypoint, SCAFFOLDED.** The pipeline runs `./init.sh` as the green-cycle gate (the code generator, integrator, and e2e gate all call it), so the project needs one. `/install` creates it from the test command it can detect — but **never invents a command it cannot back up**: if the toolchain is recognizable it writes a runnable `init.sh`; if not, it writes a **fail-closed stub** (exits non-zero, with a one-line "wire your test command" message) so a build can never run green on an unverified gate. An existing `init.sh` is never clobbered.

```bash
if [ -f init.sh ]; then
  chmod +x init.sh 2>/dev/null || true
  echo "init.sh: skipped (already exists — kept yours)"
else
  # Same toolchain probe as 5c — only a REAL detected command goes into a runnable gate.
  if   [ -f package.json ];               then ITEST="npm test"
  elif [ -f Cargo.toml ];                 then ITEST="cargo test"
  elif [ -f go.mod ];                     then ITEST="go test ./..."
  elif [ -f pyproject.toml ] || [ -f setup.py ] || ls tests/*.py >/dev/null 2>&1; then ITEST="python3 -m pytest"
  elif [ -f Makefile ] && grep -qE '^test:' Makefile; then ITEST="make test"
  else ITEST=""; fi
  if [ -n "$ITEST" ]; then
    cat > init.sh <<EOF
#!/usr/bin/env bash
# Tiger verification entrypoint. The pipeline runs ./init.sh as the green-cycle gate
# (code generator, integrator, and the e2e gate all call it); it MUST exit non-zero on
# any failure. Extend with lint / typecheck / build lines as the project grows.
set -euo pipefail
echo "== Tiger verify: $ITEST =="
$ITEST
EOF
    chmod +x init.sh
    echo "init.sh: created (runs: $ITEST)"
  else
    cat > init.sh <<'EOF'
#!/usr/bin/env bash
# Tiger verification entrypoint. The pipeline runs ./init.sh as the green-cycle gate and
# requires a non-zero exit on failure. The project's test command could not be auto-detected —
# replace the two lines below with the real one (npm test, cargo test, go test ./..., pytest,
# make test, ...). Until then this FAILS CLOSED so no build runs on an unverified gate.
set -euo pipefail
echo "Tiger: init.sh is not configured yet — add this project's test command." >&2
exit 1
EOF
    chmod +x init.sh
    echo "init.sh: created (STUB — NEEDS HUMAN: wire the real test command; fails closed until you do)"
  fi
fi
```

If a STUB was written, mark `init.sh` `NEEDS HUMAN` in the report — the human must replace the stub with the real test command before a build can pass.

**5e. `main` trunk born** — the kit is trunk-based: the pipeline branches `feature/<id>` off `main`, so the project MUST be a git repo with a born `main`. This step makes that true smoothly: it `git init`s a non-repo (the kit needs git either way — better to initialize and report than dead-end), ensures `main` exists, and makes the first commit **only when no commit exists** (a no-op in any repo with history — existing projects keep their seed files uncommitted for human review):

```bash
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  git init -q && echo "git repo: created (git init — the kit is trunk-based on main)"
fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  git show-ref --verify --quiet refs/heads/main && echo "main branch: verified (exists)" || {
    git checkout -b main >/dev/null 2>&1 && echo "main branch: created"; }
  git rev-parse HEAD >/dev/null 2>&1 || {
    git add -A && git commit -qm "chore(tiger): install harness state + rm guard" && echo "main initial commit: created (was unborn)"; }
else
  echo "main trunk: NEEDS HUMAN — could not initialize a git repo here; run 'git init' manually, then rerun install."
fi
```

## Step 6 — Print the report, then STOP

Collect every line from steps 2–5 into one table and print it. Each item is exactly one of `created` | `skipped (already correct)` | `verified` | `NEEDS HUMAN`:

```text
Tiger install report
--------------------------------------------------
workflow (.claude/workflows/tiger-workflow-dev.js)  ...  <status>
rm guard file (.claude/hooks/tiger-block-rm.sh)     ...  <status>
rm guard PreToolUse hook (.claude/settings.json)    ...  <status>
rm guard verification (rm→2, safe→0)                ...  <status>
template spec.html                                   ...  <status>
template adr.html                                    ...  <status>
template business.html                               ...  <status>
template codemap.html                                ...  <status>
template release_docs.html                           ...  <status>
template e2e_testcases.robot                          ...  <status>
template e2e_keywords.resource                        ...  <status>
feature_list.json                                    ...  <status>
progress.md                                          ...  <status>
CLAUDE.md                                            ...  <status>
init.sh                                              ...  <status>
main branch                                          ...  <status>
--------------------------------------------------
```

If any line is `NEEDS HUMAN`, list those items again under a short "Needs your attention" heading with the fix for each, and state clearly that **a build must not proceed until the rm guard verifies and `init.sh` runs the project's real tests** (a fail-closed stub counts as not-ready — it blocks every build until you wire the real command).

Then **STOP.** Install is done. Tell the human to start a feature with the `tiger-grill` skill, then run `/tiger-workflow-dev` once the spec is approved — no args needed (the workflow auto-discovers the approved in-progress feature). Do not grill, do not plan, do not write code from this command.
