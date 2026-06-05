# Install the tiger-pipeline Workflow into this project

Copy the plugin's bundled deterministic Workflow (`workflows/tiger-pipeline.js`)
into the **current project's** `.claude/workflows/` so the team gets it on clone
and can run it. A saved workflow becomes its own slash command, so it launches as
**`/tiger-pipeline`** (NOT `/workflows tiger-pipeline` — `/workflows` with no name only
lists and watches runs).

Workflows are not a plugin-distributed type — they load only from a project's
`.claude/workflows/` or `~/.claude/workflows/`. This command bridges that gap:
it places the bundled file into the project repo for you to commit.

## Install Protocol

### 1. Locate the bundled source
The file ships inside this plugin at `${CLAUDE_PLUGIN_ROOT}/workflows/tiger-pipeline.js`.
Confirm it exists. If `${CLAUDE_PLUGIN_ROOT}` is unset (older Claude Code), search the
plugin install for `workflows/tiger-pipeline.js` under the plugins cache and use that path.

### 2. Choose the destination
- **Project (default, recommended):** `<repo-root>/.claude/workflows/tiger-pipeline.js`
  — shared with everyone who clones the repo, versioned, PR-reviewable.
- **Personal (only if asked):** `~/.claude/workflows/tiger-pipeline.js` — just this user,
  across all their projects, not shared.

Create the destination directory if it does not exist (`.claude/workflows/`).

### 3. Copy safely
- If the destination file does **not** exist: copy the bundled file verbatim. Prefer a
  Read-then-Write (read the source, write the destination) so it is byte-identical and
  cross-platform — do not depend on a shell `cp`/`copy` that differs per OS.
- If the destination **already exists**: do NOT silently overwrite. Show the user the
  difference (or note "a workflow is already installed") and ask whether to overwrite,
  keep, or save as `tiger-pipeline.local.js`. The user may have customized it.

### 4. Verify
Confirm the destination file exists and is non-empty, and that its
`export const meta = { name: "tiger-pipeline" ... }` block is intact. Optionally run
`node --check <dest>` to confirm it parses.

### 5. Report and remind
Tell the user:
- Where the file was written.
- **Commit it:** `git add .claude/workflows/tiger-pipeline.js && git commit -m "Add tiger-pipeline workflow"` so teammates get it on clone.
- **Prerequisites for anyone who runs it:**
  1. Claude Code ≥ 2.1.154 with dynamic workflows enabled (`/config`; Enterprise admins enable it in managed settings; not disabled via `CLAUDE_CODE_DISABLE_WORKFLOWS=1`).
  2. The `tiger-skills` plugin installed — the workflow spawns `tiger-skills:explorer`, `…:planner`, etc., which resolve only when the plugin is present.
- **How to run:** finish GATES 0–4 conversationally (bootstrap, grill, **human-approve the spec**, pick one feature), then launch **`/tiger-pipeline`** (its own slash command) with the feature's `args` (see `workflows/README.md`). It is args-driven, not a free-text task. `/workflows` (no name) is only the dashboard to watch the run.
- **Caveat:** dynamic workflows are research-preview (enable in `/config`); a run spawns many agents and costs far more tokens than a normal turn — dry-run it on a small approved feature before making it the team default.

Do not modify the bundled source under `${CLAUDE_PLUGIN_ROOT}`; only write into the project (or home) `.claude/workflows/`.
