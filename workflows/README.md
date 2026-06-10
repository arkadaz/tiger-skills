# Deterministic Workflow — `tiger-pipeline`

The tiger-skills conductor's build flow (GATES 4–9) expressed as a **git-committed Claude Code Workflow** — a
fixed JS script that runs the linear pipeline the same way every run, instead of the conductor re-deciding each
time. Review it once in a PR, trust it forever. Built on Claude Code **dynamic workflows**
([docs](https://code.claude.com/docs/en/workflows)).

> **Status.** `tiger-pipeline.js` uses the documented dynamic-workflow API (`export const meta = {…}` pure
> literal, `agent(prompt, { agentType })`, `phase()`, `parallel()`, `budget.*`, `isolation`). It passes
> `node --check`. Dynamic workflows are a research-preview runtime — enable in `/config` (Dynamic workflows),
> Claude Code ≥ 2.1.154. A run spawns several agents per feature, so dry-run on one small approved feature first.

## The flow — one feature at a time, linear

```
read the backlog → for each approved, not-passing feature (one at a time, priority order):
   architect            — plans where the code goes (no separate planner)
   → generator          — builds in its OWN git worktree (.tiger-wt/<id>, branch tiger/<id>): code + unit tests, commits
   → reviewer + security — not pass ──> back to the generator   (loop UNTIL pass)
   → e2e (executor)      — authors + runs the E2E; not pass ──> back to the generator   (loop UNTIL pass)
   → merge              — generator merges tiger/<id> to main, resolves conflicts, removes the worktree
   → update docs        — cartographer: CODEBASE_MAP.md + feature_list.json + release_docs.html + business.html
```

No waves, no scheduler, no batch-planner. The architect does the code planning; the not-pass loops run **until
they pass** (the token budget is the only backstop). Several features are just this same flow run one after
another, each in its own worktree.

**Out of scope, on purpose — these stay in the conversational layer:** bootstrap, grill + **human spec
approval**, picking the backlog. You grill and get sign-off *first*, then launch the workflow on the approved
features. The mechanical part is deterministic; the judgment part stays with you.

## Install

Workflows load from `.claude/workflows/` (project) or `~/.claude/workflows/` (personal). Plugins don't
distribute workflows, so the file has to land in the project.

```
/tiger-skills:install-workflow      # installs the plugin's copy into this project
```

Then commit `.claude/workflows/tiger-pipeline.js`. Manual equivalent: `cp .../workflows/tiger-pipeline.js
.claude/workflows/`. Requires Claude Code ≥ 2.1.154 with **Dynamic workflows enabled** and the `tiger-skills`
plugin installed (the workflow spawns its agents).

## Run

1. Finish the conversational gates: bootstrap, grill, **human-approve the spec(s)**.
2. Launch it by its own name (a saved workflow becomes its own slash command; `/workflows` only lists/watches):

```
/tiger-pipeline
```

Args (no clock reads — pass the date in, per the determinism rules):

| arg | type | meaning |
|---|---|---|
| `projectDir` | string | absolute project path |
| `today` | string | ISO date `YYYY-MM-DD` |
| `featureIds` | string[] (optional) | restrict to specific approved features; default = every ready, approved, not-`passing` feature in priority order |
| `proModel` | string (optional) | **pin** the model for every agent. Unset ⇒ no model is sent and every agent inherits the session/subagent default (`CLAUDE_CODE_SUBAGENT_MODEL` honored) — the safe choice on non-Anthropic backends |
| `fastModel` | string (optional) | model for the mechanical agents (generator); falls back to `proModel`; only meaningful when a pin is set |

The **reader agent reads `feature_list.json` itself**, so you don't pass per-feature details — just `projectDir`
+ `today`. The run returns one compact summary (`{ features, passedCount, passedIds, results }`); the heavy
reports stay in each agent's own context.

```
Run /tiger-pipeline with projectDir "/abs/path/to/project", today "2026-06-10"
```

> Invoked bare (missing `projectDir`/`today`) it **aborts softly** with `{ aborted, howToLaunch, passed:false }`
> before any agent spawns — re-copy the workflow (`/tiger-skills:install-workflow`, overwrite) if an old copy
> crashes instead.

## Model routing — why each agent's frontmatter `model:` is *not* enough

`agentType` selects an agent's **prompt + tools**, not its model. Per the
[docs](https://code.claude.com/docs/en/workflows): *"Every agent in a workflow uses your session's model unless
the script routes a stage to a different one."* So when no model is routed, all agents run on your session's
subagent default — the model your session runs on, or **`CLAUDE_CODE_SUBAGENT_MODEL`** when set.

**The script forces no model name by default** — the backend-agnostic path (a hardcoded alias like `opus` is
rejected by a non-Anthropic backend). Pass `proModel` to pin tiers on an Anthropic session; the `MODEL_FOR`
map then routes the six agents (`code-architect`, `generator`, `reviewer`, `security-reviewer`, `executor`,
`cartographer`), with `generator` on `fastModel` when split.

```
# any backend (recommended): pin the subagent model once, pass no model args
set CLAUDE_CODE_SUBAGENT_MODEL=<your-model-exact-name>      # e.g. deepseek-v4-pro[1m]
Run /tiger-pipeline with projectDir "…", today "2026-06-10"

# Anthropic session — pin the strong tier explicitly:
Run /tiger-pipeline with projectDir "…", today "2026-06-10", proModel "opus"
```

> **Backend note.** If you pin a model on a non-Anthropic backend, pass its **exact name including any variant
> suffix** (e.g. `[1m]`). A near-miss name fails at request time. When in doubt, don't pin — set
> `CLAUDE_CODE_SUBAGENT_MODEL` and inherit.

## Troubleshooting non-Anthropic backends

Both known failure signatures surface as **every agent dying instantly at spawn**. A **spawn canary** aborts the
run right after the FIRST death with a diagnostic, instead of cascading doomed spawns.

| Signature | Cause | Fix |
|---|---|---|
| `400`/`404` — model not found / not served | A forced model name your backend doesn't serve | Don't pin: leave `proModel` unset and set `CLAUDE_CODE_SUBAGENT_MODEL=<exact name, incl. variant suffix>` |
| `400 thinking options type cannot be disabled when reasoning_effort is set` (or similar) | **Root cause (reproduced at the wire level, CC 2.1.168 + DeepSeek):** Claude Code attaches the session effort to **every** request as `output_config.effort` and hardcodes `thinking: {type:"disabled"}` on **subagent** requests (Agent tool AND Workflow runtime). Backends that map `output_config.effort` to `reasoning_effort` reject that combination — so the main loop works but **every subagent dies at spawn**. No env var, settings key, or frontmatter fixes it. | **The proven fix — the bundled repair proxy** (`tools/anthropic-compat-proxy.js`): run `node tools/anthropic-compat-proxy.js` in its own terminal (defaults: `127.0.0.1:8787` → `https://api.deepseek.com/anthropic`; override `PROXY_TARGET`/`PROXY_PORT`), then launch Claude Code with `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`. It deletes the effort field **only when thinking is disabled**, leaving main-loop requests untouched. Or report upstream via `/feedback`. |

The workflow itself cannot set thinking/effort per agent — the runtime's `agent()` accepts no such options — so
these are resolved in the session environment or the router, never in this script. A canary abort touches no
code and no state files; fix the environment and re-run.

### Launching through the repair proxy — step by step

Two terminals. **Terminal 1 — start the proxy and leave it running:**

```bat
node "%USERPROFILE%\.claude\plugins\cache\arkadaz\tiger-skills\<version>\tools\anthropic-compat-proxy.js"
```

Defaults: listens on `127.0.0.1:8787`, forwards to `https://api.deepseek.com/anthropic` (set
`PROXY_TARGET`/`PROXY_PORT` for another backend/port).

**Terminal 2 — your usual env with ONE change: `ANTHROPIC_BASE_URL` points at the proxy:**

```bat
set ANTHROPIC_BASE_URL=http://127.0.0.1:8787
set ANTHROPIC_AUTH_TOKEN=<your API key>
set CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro[1m]
claude
```

Notes: the auth token still goes to the real backend (the proxy only forwards, bound to `127.0.0.1`); keep
`CLAUDE_CODE_SUBAGENT_MODEL` on your strong tier so the agents don't downgrade; if you see `ECONNREFUSED`,
Terminal 1's proxy isn't running. Then run `/tiger-pipeline` as normal — the canary passes and the agents run.

## Determinism rules this file obeys

The runtime replays the script to resume, so it must be replayable:

- **`export const meta = {…}` is a pure literal, first statement.**
- **No clock / randomness in the orchestrator** — the date is passed in via `args.today`.
- **No filesystem / shell / network in the script** — the orchestrator only coordinates; all I/O happens
  inside agent prompts (the reader reads `feature_list.json`, the generator writes code in its worktree, the
  executor runs verification, the cartographer writes the docs).
- **`isolation:'worktree'` is used only for the build agents** — they would otherwise collide on the working tree.
- **Loops run UNTIL they pass**, guarded only by budget **headroom** (≥50k output tokens) — no fixed try-count.
  The budget is a hard ceiling (`agent()` throws once spent), so a genuinely stuck feature stops gracefully.
- **Gate decisions are machine-readable and fail CLOSED** — the executor ends with `PIPELINE_STATUS: PASS|FAIL`,
  each reviewer with `REVIEW_VERDICT`/`SECURITY_VERDICT` = `APPROVED|CHANGES`. The parser reads the **last**
  occurrence of each token, so an earlier quote can't false-approve; a dead reviewer coerces to `CHANGES`.

## The agents it spawns

`code-architect` (plans) · `generator` (worktree build + the fix loop) · `reviewer` (quality + correctness) ·
`security-reviewer` (when triggered) · `executor` (authors + runs the E2E) · `cartographer` (update-docs).
Each agent is a bundle of independent skills — see `agents/*.md` and the conductor `skills/harness-engineering/SKILL.md`.
