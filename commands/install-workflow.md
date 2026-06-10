# Install the tiger-pipeline Workflow (+ repair proxy) into this project

Copy the plugin's bundled deterministic Workflow (`workflows/tiger-pipeline.js`) **and** the
backend repair proxy (`tools/anthropic-compat-proxy.js`) into the **current project** so the
team gets them on clone and can run them. A saved workflow becomes its own slash command, so it
launches as **`/tiger-pipeline`** (NOT `/workflows tiger-pipeline` — `/workflows` with no name only
lists and watches runs).

Workflows are not a plugin-distributed type — they load only from a project's `.claude/workflows/`
or `~/.claude/workflows/`. The repair proxy is a runtime helper needed only on **non-Anthropic
backends** (it fixes the thinking/effort `400` that kills every subagent at spawn). This command
bridges both gaps: it places the bundled files into the project repo for you to commit.

## Install Protocol

### 1. Locate the bundled sources
They ship inside this plugin at:
- `${CLAUDE_PLUGIN_ROOT}/workflows/tiger-pipeline.js` (the workflow)
- `${CLAUDE_PLUGIN_ROOT}/tools/anthropic-compat-proxy.js` (the repair proxy)

Confirm they exist. If `${CLAUDE_PLUGIN_ROOT}` is unset (older Claude Code), search the plugin
install under the plugins cache for those two paths and use them.

### 2. Choose the destinations
- **Workflow (required):** `<repo-root>/.claude/workflows/tiger-pipeline.js`
- **Repair proxy (recommended, esp. on a non-Anthropic backend):** `<repo-root>/.claude/tools/anthropic-compat-proxy.js`
- **Personal scope instead (only if asked):** `~/.claude/workflows/…` and `~/.claude/tools/…` — just this user, not shared.

Create the destination directories if they do not exist (`.claude/workflows/`, `.claude/tools/`).

### 3. Copy safely
For **each** file:
- If the destination does **not** exist: copy verbatim. Prefer a Read-then-Write (read the source,
  write the destination) so it is byte-identical and cross-platform — do not depend on a shell
  `cp`/`copy` that differs per OS.
- If the destination **already exists**: do NOT silently overwrite. Show the user the difference (or
  note "already installed") and ask whether to overwrite, keep, or save as `*.local.js`. The user
  may have customized it (e.g. the proxy's `PROXY_TARGET`/`PROXY_PORT`).

### 4. Verify
- `node --check <dest>/tiger-pipeline.js` parses, and its `export const meta = { name: "tiger-pipeline" … }` is intact.
- `node --check <dest>/anthropic-compat-proxy.js` parses, and the file is non-empty.

### 5. Report and remind
Tell the user:
- Where each file was written.
- **Commit them:** `git add .claude/workflows/tiger-pipeline.js .claude/tools/anthropic-compat-proxy.js && git commit -m "Add tiger-pipeline workflow + repair proxy"` so teammates get them on clone.
- **Prerequisites for anyone who runs the workflow:**
  1. Claude Code ≥ 2.1.154 with dynamic workflows enabled (`/config`; not disabled via `CLAUDE_CODE_DISABLE_WORKFLOWS=1`).
  2. The `tiger-skills` plugin installed — the workflow spawns `tiger-skills:code-architect`, `…:generator`, etc., which resolve only when the plugin is present.
- **How to run the workflow:** finish the conversational gates (bootstrap, grill, **human-approve the spec(s)**), then launch **`/tiger-pipeline`** with `projectDir` + `today` (it reads `feature_list.json` itself; optional `integrationBranch` default `dev`). See `workflows/README.md`. `/workflows` (no name) is only the dashboard to watch the run.
- **Non-Anthropic backend (e.g. DeepSeek)?** If every subagent dies at spawn with a thinking/effort `400`, run the proxy in its own terminal first: `node .claude/tools/anthropic-compat-proxy.js` (defaults: listens on `127.0.0.1:8787`, forwards to `https://api.deepseek.com/anthropic`; override `PROXY_TARGET`/`PROXY_PORT`), then relaunch Claude Code with `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`. Full step-by-step: `workflows/README.md` → Troubleshooting.
- **Caveat:** dynamic workflows are research-preview; a run spawns many agents and costs far more tokens than a normal turn — dry-run on a small approved feature before making it a team default.

Do not modify the bundled sources under `${CLAUDE_PLUGIN_ROOT}`; only write into the project (or home) `.claude/` directories.
