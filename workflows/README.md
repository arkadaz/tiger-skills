# Deterministic Workflow — `tiger-pipeline`

The tiger-skills conductor (GATES 5–12b) expressed as a **git-committed Claude Code
Workflow** — a fixed JS orchestration script that spawns the 12 agents (incl. the GATE 7b e2e-engineer and the GATE 12b cartographer) the same way
every run (including the GATE 11 review cluster: quality + correctness + security),
instead of the conductor re-deciding the plan each time. You review it
once in a PR and trust it forever.

Built on Claude Code **dynamic workflows**
([official docs](https://code.claude.com/docs/en/workflows)), applied to this plugin's
gate sequence.

> **Status.** `tiger-pipeline.js` uses the **documented** dynamic-workflow API:
> `export const meta = {…}` (pure literal), `agent(prompt, { agentType })`, the bare
> `phase()` marker, `parallel()` / `pipeline()`, and `budget.*`. It passes `node --check`.
> Dynamic workflows are a **research-preview** runtime — turn them on in `/config`
> (Dynamic workflows) and use Claude Code ≥ 2.1.154. A run spawns the 12 agents and
> costs more tokens than a normal turn, so dry-run on a small approved feature before
> making it a team default.

## Dynamic vs. deterministic — why this exists

| | Dynamic (default) | Deterministic (this file) |
|---|---|---|
| Who writes the plan | Claude, per run | You, once, committed to git |
| Reproducible | No — same prompt may replan | Yes — identical orchestration every run |
| Reviewable in a PR | No | Yes (`git diff`) |
| Best for | one-off hard tasks | a repeatable team procedure — exactly the gate sequence |

## What it covers — and what it deliberately doesn't

It runs **one already-approved feature** through:

```
explore → plan → [architect?] → persist-tasks
        → generate   (FAN-OUT: one generator per independent task, in waves ‖, then integrate)
        → e2e-author (e2e-engineer writes the user-flow E2E)
        → execute (full suite + mandatory E2E)
        → (heal + regression test → regenerate → e2e-refresh → re-execute){≤3}
        → review cluster: reviewer ‖ correctness-reviewer ‖ [security-reviewer]   (PARALLEL)
        → (fix → e2e-refresh → re-execute → re-review ‖){≤3} → track
        → map (cartographer refreshes CODEBASE_MAP.md)
```

**Where it runs in parallel (v4.9.0, hardened in v4.9.1).** Two stages fan out where the work is genuinely
independent; everything else stays sequential because each gate consumes the previous one's output:

- **Review cluster** — quality + correctness + security read the *same* diff with no
  data dependency, so they run **concurrently** (first pass and every re-review). Wall-clock
  ≈ the slowest single reviewer, not the sum of three. A reviewer that dies returns `CHANGES`,
  never a false `APPROVED`.
- **Generation** — the planner returns a structured `tasks[]` (`files` + `depends_on`). The
  script schedules it into dependency-respecting **waves**; within a wave only **file-disjoint**
  tasks run together, each as its own generator. Parallel generators write only their own files
  and **defer** shared-file changes (deps, barrels) to a short sequential **integrate** step, so
  writers never collide — no worktrees needed. A feature whose tasks form a single chain degrades
  cleanly to the old one-generator path. Force that with `sequentialGenerate: true`.

**No two concurrent agents touch the same file.** Five guarantees stack: (1) `depends_on`
serializes *read-after-write* across waves (a task that reads another's output can't run beside
it); (2) within a wave the `files` sets are disjoint **after canonicalization** (separators, `./`,
`..`, case — two spellings of one physical file can never share a wave); (3) a task with no
declared files runs **alone**; (4) the state files (`feature_list.json`, `progress.md`) are written
**only by the scribe** — generators emit a Board Update, never write state; (5) a dependency
**cycle** in the planner's `tasks[]` degrades to one-task-per-wave — strictly sequential, never an
unfiltered parallel wave. The stack is as strong as the planner's `files` declarations — which is
why the planner prompt marks them SAFETY-CRITICAL and an undeclared-files task always runs alone.
The review cluster is read-only on source (concurrent reads are safe) and is told not to re-run the
full build/test suite concurrently, so it can't race on shared build artifacts either. And **no
generator runs `git`** — solo or parallel, the commit happens in the conversational layer after the
run, so a half-finished wave is never committed.

**Memory stays bounded — structurally.** Parallel generators are told to return **concise**
handoffs (summary + Board Update, no file dumps), and the orchestrator additionally `digest()`s
every handoff it threads onward (head + Board Update tail kept, middle trimmed), so the threaded
handoff stays O(1) per task even if an agent ignores the instruction. Downstream agents re-read
the repo directly for anything trimmed; full reports stay in each agent's own context.

**GATE 7b — E2E every time.** A dedicated **opus `e2e-engineer`** authors the user-flow
E2E (Playwright) against the just-built feature, then re-runs in **every** heal loop and
**every** review-fix loop before each re-execute — so the full unit + E2E suite re-confirms
*nothing broke* end to end on every iteration, not just on the first pass. The generator
writes the feature + unit tests; the e2e-engineer owns the user-flow E2E.

**GATE 12b — the map stays true.** After track, the **opus `cartographer`** refreshes
`CODEBASE_MAP.md` — Mermaid architecture + code-flow diagrams plus the function-chain
inventory (every hop's real inputs/outputs, `file:line`-anchored). It is the **single
writer** of that one artifact, and it runs after every other agent has finished, so map
reads never race a map write. On the next run the explorer reads the map FIRST (and
verifies what the feature touches), so each feature starts from a maintained map instead
of a cold recon.

**Out of scope, on purpose — these stay in the conversational layer:**

- **GATE 0** bootstrap, **GATE 1** grill + **human spec approval**, **GATES 2–4**
  ledger / clock-in / scope (WIP=1). An autonomous orchestrator can't run a human
  interview, and per this plugin's own rule a spec is approved only by an explicit
  human "yes". So you grill and get sign-off *first*, then launch the workflow on the
  approved feature.

This boundary is the whole point: the **mechanical** part is deterministic; the
**judgment** part stays with you.

## Install

Workflows load from `.claude/workflows/` (project, shared) or `~/.claude/workflows/`
(personal). Plugins don't distribute workflows, so the file has to land in the project.

**Easiest — use the bundled command** (installs the plugin's copy into this project):

```
/tiger-skills:install-workflow
```

Then commit `.claude/workflows/tiger-pipeline.js`.

**Manual equivalent:**

```bash
mkdir -p .claude/workflows
cp path/to/tiger-skills/workflows/tiger-pipeline.js .claude/workflows/
```

Requires Claude Code ≥ 2.1.154 with **Dynamic workflows enabled** (`/config` → Dynamic
workflows), and the `tiger-skills` plugin installed (the workflow spawns its agents).

## Run

1. Finish GATES 0–4 conversationally: bootstrap, grill, **human-approve the spec**,
   pick one feature (`in_progress`, WIP=1).
2. Launch it **by its own name** — a saved workflow becomes its own slash command.
   `/workflows` (no name) only *lists and watches* runs; it does **not** launch one:

```
/tiger-pipeline
```

It expects these `args` (no clock reads — pass the date in, per the determinism rules):

| arg | type | meaning |
|---|---|---|
| `featureId` | string | e.g. `feature-001` |
| `featureTitle` | string | the feature title |
| `specFile` | string | `specs/<id>.md` (human-approved) |
| `projectDir` | string | absolute project path |
| `today` | string | ISO date for the scribe's log |
| `newModule` / `spans3PlusFiles` / `newPattern` / `structuralRisk` | bool | GATE 6 architect triggers |
| `securitySensitive` | bool | GATE 11c security-reviewer trigger (auth, untrusted input, query/command building, network/file I/O, deserialization, crypto/secrets, new dependency) |
| `proModel` | string (optional) | **pin** the model for every agent. **Unset by default ⇒ no model is sent** and every agent inherits the session/subagent default (`CLAUDE_CODE_SUBAGENT_MODEL` honored) — the safe choice on non-Anthropic backends. On an Anthropic session pass e.g. `opus` to pin the strong tier. |
| `fastModel` | string (optional) | model for the mechanical agents (explorer, generator, executor, scribe). Falls back to `proModel`; only meaningful when a pin is set. Pass it to split tiers deliberately. |
| `sequentialGenerate` | bool (optional) | force the old single-generator path (no fan-out). Default `false`. |

3. Watch in `/workflows`: `p` pause, `x` stop an agent, `r` restart, `s` save.

**Example invocation** (spec approved, feature `in_progress`):

```
Run /tiger-pipeline with featureId "feature-001", featureTitle "Checkout flow",
specFile "specs/feature-001.md", projectDir "/abs/path/to/project", today "2026-01-01",
newModule true, spans3PlusFiles true, newPattern false, structuralRisk false,
securitySensitive false
```

> `tiger-pipeline` is **args-driven, not free-text**: it runs one *already-approved
> feature* through the gate pipeline. Typing a task after it (e.g. `/tiger-pipeline fix
> the back button`) does nothing useful — that text isn't a parameter. Grill + approve a
> spec first, then launch with the `args` above. For an ad-hoc one-off, don't use this
> workflow — describe the task in your own words (or `ultracode: <task>`) and let Claude
> write a workflow for it.

> **Invoked bare?** Since v4.10.5 `/tiger-pipeline` with no args (or missing any of the
> five required strings) **aborts softly with usage instructions** — `{ aborted,
> howToLaunch, passed: false }` — before any agent spawns; the calling session reads
> `howToLaunch`, finds the `in_progress` feature in `feature_list.json`, and re-launches
> with real args (or stops, if no feature is `in_progress`). Pre-v4.10.5 copies instead
> died with `undefined is not an object (evaluating 'args.featureId')` — if you see that,
> re-copy the workflow (`/tiger-skills:install-workflow`, overwrite).

Claude passes these as the script's `args`. The run returns one compact summary
(`{ feature, passed, e2eAuthored, approved, heals, reviews, … }`); the heavy
intermediate reports stay in each agent's own context, not your session.

## Model routing — why each agent's frontmatter `model:` is *not* enough

The `agents/*.md` files declare a `model:` (8 agents `opus`, 4 `sonnet`). That field
is honored when an agent is spawned through the **Agent/Task tool** — but **not inside
a workflow**. Per the [docs](https://code.claude.com/docs/en/workflows): *"Every agent
in a workflow uses your session's model unless the script routes a stage to a different
one."* `agentType` selects an agent's **prompt and tools**, not its model.

So when no model is routed, all 12 agents run on **your session's subagent default** —
the model your session runs on, or **`CLAUDE_CODE_SUBAGENT_MODEL`** when you set it.

**Since v4.10.1 that inherit is the default — the script forces no model name.** This is
the backend-agnostic path: a hardcoded alias like `opus` is rejected at request time by a
non-Anthropic backend, and even a correct backend name can clash with that backend's
reasoning/effort parameter handling. Inheriting avoids both — the workflow runs unchanged
on any backend your session already works on.

```
# any backend (recommended): pin the subagent model once, pass no model args
set CLAUDE_CODE_SUBAGENT_MODEL=<your-model-exact-name>     # e.g. deepseek-v4-pro[1m]
Run /tiger-pipeline with featureId "feature-001", …        # no proModel needed

# Anthropic session — pin the strong tier explicitly (e.g. main loop runs a faster model):
Run /tiger-pipeline with featureId "feature-001", … , proModel "opus"

# split tiers: strong for reasoning, a cheaper model for the mechanical agents
Run /tiger-pipeline with featureId "feature-001", … ,
proModel "<your-strong-model>", fastModel "<your-fast-model>"
```

When `proModel` is passed, the `MODEL_FOR` map routes every stage as before (reasoning
agents on `proModel`; explorer/generator/executor/scribe on `fastModel`, which falls back
to `proModel`; the cartographer is always kept on the pro tier).

> **Backend note.** If you do pin a model on a non-Anthropic backend, pass the model's
> **exact name as that backend advertises it** — including any variant suffix (e.g. `[1m]`).
> A near-miss name can resolve to a different model (or none) and fail at request time,
> especially for reasoning models that are strict about `reasoning_effort`/`thinking`
> parameters. When in doubt, don't pin — set `CLAUDE_CODE_SUBAGENT_MODEL` and inherit.

## Troubleshooting non-Anthropic backends

Both known failure signatures surface as **every agent dying instantly at spawn**. Since
v4.10.2 a **spawn canary** aborts the run right after the FIRST death with a diagnostic
summary, instead of cascading dozens of doomed spawns through the heal/review loops.

| Signature | Cause | Fix |
|---|---|---|
| `undefined is not an object (evaluating 'args.featureId')` — fails in 0s, before any agent | `/tiger-pipeline` launched **bare** (no args) on a pre-v4.10.5 copy — the script dereferenced `args` unguarded | Re-copy the workflow (`/tiger-skills:install-workflow`, overwrite) — v4.10.5+ aborts softly with `howToLaunch` usage instructions instead; then launch with the full `args` (see *Run* above) |
| `400`/`404` — model not found / not served | A forced model name your backend doesn't serve (the pre-v4.10.1 default pinned `opus`) | Don't pin: leave `proModel` unset and set `CLAUDE_CODE_SUBAGENT_MODEL=<exact name, incl. variant suffix>` — v4.10.1+ inherits by default |
| `400 thinking options type cannot be disabled when reasoning_effort is set` (or similar thinking/effort conflicts) | **Root cause, reproduced at the wire level (CC 2.1.168 + DeepSeek, 2026-06-08):** Claude Code attaches the session effort to **every** request as **`output_config.effort`** — even with `CLAUDE_CODE_EFFORT_LEVEL` unset, no `effortLevel` in settings, and v4.10.6 frontmatter — and hardcodes `thinking: {type: "disabled"}` on **subagent** requests (Agent tool AND Workflow runtime). Backends that map `output_config.effort` to `reasoning_effort` (DeepSeek's `/anthropic` shim) reject that combination — so the main loop works (thinking enabled) but **every subagent dies at spawn**. `alwaysThinkingEnabled`, `MAX_THINKING_TOKENS`, env vars, settings, and agent frontmatter have all been empirically eliminated — nothing client-side reaches those two fields on subagent calls. | **The proven fix — the bundled repair proxy** (`tools/anthropic-compat-proxy.js`, v4.10.7): run `node tools/anthropic-compat-proxy.js` in its own terminal (defaults: listens on `127.0.0.1:8787`, forwards to `https://api.deepseek.com/anthropic`; override with `PROXY_TARGET`/`PROXY_PORT`), then launch Claude Code with `ANTHROPIC_BASE_URL=http://127.0.0.1:8787` — everything else (auth token, model names) unchanged. It deletes the effort field **only when thinking is disabled**, so main-loop requests keep their effort and thinking; verified against the live API: the failing payload returns 200 through it, thinking-enabled requests pass untouched, SSE streams. Alternatives: have your own router/proxy do the same remap, or report upstream via `/feedback` — the runtime should not send a disabled thinking config alongside an effort level. |

The workflow itself cannot set thinking/effort per agent — the Workflow runtime's
`agent()` accepts no such options — so these conflicts are always resolved in the session
environment or the router, never in this script. A canary abort touches **no code and no
state files**; fix the environment and re-run.

**v4.10.3 declared `effort: max` in every agent definition; v4.10.6 REMOVED it; v4.10.7
ships the actual fix.** The frontmatter field is honored for Agent-tool spawns — on a
backend that rejects effort alongside a disabled thinking config, the forced effort made
the **conversational fallback die with the same 400 as the workflow path**, so v4.10.6
removed it and let spawns inherit the session's effort. That helped but was **not
sufficient**: wire-level testing then showed Claude Code (2.1.168) attaches
`output_config.effort` to every request **even when no effort is configured anywhere**
(env, settings, frontmatter), while hardcoding thinking-disabled on subagent requests —
so the conflict survives any client-side cleanup. v4.10.7 therefore ships
`tools/anthropic-compat-proxy.js` (see the Troubleshooting table above), which repairs the
request in transit — the only layer that can. On an Anthropic session none of this fires;
use `/effort` for session-wide effort as usual. The thinking on/off flag for subagent
requests still has **no plugin-controllable surface at all** — if a backend rejects the
thinking/effort combination, that is fixed in transit (the proxy) or upstream
(`/feedback`), never in this script or the agent definitions.

### Launching through the bundled repair proxy — step by step

Two terminals. The proxy ships inside the plugin, so the cache path below works on any
machine with the plugin installed (adjust the version segment to the version you have),
or run it from a checkout of this repo (`tools/anthropic-compat-proxy.js`).

**Terminal 1 — start the proxy and leave it running:**

```bat
node "%USERPROFILE%\.claude\plugins\cache\arkadaz\tiger-skills\4.10.7\tools\anthropic-compat-proxy.js"
```

Defaults: listens on `127.0.0.1:8787`, forwards to `https://api.deepseek.com/anthropic`.
For another backend or port, set `PROXY_TARGET` / `PROXY_PORT` before launching it.

**Terminal 2 — your usual environment with ONE change: `ANTHROPIC_BASE_URL` points at
the proxy** (cmd syntax shown; bash uses `export NAME=value`, PowerShell
`$env:NAME = "value"`):

```bat
set ANTHROPIC_BASE_URL=http://127.0.0.1:8787
set ANTHROPIC_AUTH_TOKEN=<your API key>
set ANTHROPIC_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
set CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-pro[1m]
claude
```

Notes:

- The auth token still goes to the real backend — the proxy only forwards it, and it
  binds to `127.0.0.1`, so nothing off-machine can reach it.
- With the proxy in place you **may keep `CLAUDE_CODE_EFFORT_LEVEL` set** if you want
  effort on the main loop — the proxy strips effort only where it conflicts (subagent
  requests with thinking disabled).
- Keep `CLAUDE_CODE_SUBAGENT_MODEL` on your **strong** tier (e.g. `deepseek-v4-pro[1m]`)
  so the planner/reviewers/healer don't silently downgrade inside workflows.
- Then run `/tiger-pipeline` as normal — the canary passes and the explorer actually runs.
  If Claude Code can't connect, Terminal 1's proxy isn't running (you'll see
  `ECONNREFUSED`); restart it first.

**Alternative — downgrade Claude Code?** Possible, but strictly worse than the proxy.
The always-attached `output_config.effort` arrived somewhere in the 2.1.x line and no
known-good version number is documented, so finding one is trial-and-error
(`claude install <version>`, test a subagent spawn, repeat — and set `"autoUpdate": false`
in settings or `DISABLE_AUTOUPDATER=1` so it sticks). Anything below **2.1.154** loses
dynamic workflows entirely (the `/tiger-pipeline` Workflow path stops existing), and a
pinned old build misses every later fix. The proxy keeps you on current Claude Code and
survives auto-updates — prefer it.

## Determinism rules this file obeys (and why)

The runtime saves progress and **replays** the script to resume, so it must be
replayable. The file follows every rule the runtime requires:

- **`export const meta = {…}` is a pure literal, first statement** — read before anything runs.
- **No `Date.now()` / `Math.random()` / argless `new Date()`** in the orchestrator —
  the date is passed in via `args.today`.
- **No filesystem / shell / network in the script** — the orchestrator only
  coordinates; all I/O (explorer reads, scribe writes `feature_list.json`, generator
  writes code, executor runs verification) happens **inside agent prompts**.
- **Loops are guarded** by a counter *and* budget **headroom** — the heal and review loops
  cap at 3 and only enter another iteration with ≥50k output tokens remaining (the budget
  is a hard ceiling: agent() throws once it's spent, so entering on fumes would kill the
  run mid-loop before GATE 12 ever writes the board).
- **Gate decisions are machine-readable and fail CLOSED** — the executor ends with
  `PIPELINE_STATUS: PASS|FAIL` and each reviewer with its own token
  (`REVIEW_VERDICT`, `CORRECTNESS_VERDICT`, `SECURITY_VERDICT` = `APPROVED|CHANGES`).
  The parser reads the **last** occurrence of each token, so a report that merely quotes
  the approved form earlier can never false-approve a gate; a dead reviewer coerces to
  `CHANGES`, never `APPROVED`.

## Synergy with the harness

The pipeline reuses the plugin's existing contracts unchanged:

- **Proof-of-invocation** lines (`code-quality-language invoked: YES …`) are required
  in each agent's prompt — the workflow can't silently skip an agent's skill.
- **Single-writer scribe** — only the two `scribe` calls touch state; every other
  agent returns a report the orchestrator threads into the next prompt.
- **Board Updates actually reach GATE 12** — the final generator and e2e handoffs (each
  ending in a Board Update) are passed into the track prompt, so the scribe applies real
  deltas instead of reconstructing them from executor evidence.
- **Earned `passing`** — GATE 12's scribe flips the feature to `passing` only if every
  task passes and every criterion is done.

## Adapting it

- **Generation fan-out (built in):** the planner returns a structured `tasks[]` (via `schema`),
  `buildWaves()` partitions it into dependency-respecting, file-disjoint waves, and each
  multi-task wave runs `parallel(wave.map(t => () => run("tiger-skills:generator", …, phase)))`
  followed by a sequential `integrate` step. To tune it: change the disjointness rule in
  `buildWaves()`, or set `args.sequentialGenerate: true` to disable. Note the pattern — inside
  `parallel()` pass `phase` explicitly (the 3rd `run()` arg), never the `CURRENT_PHASE` global,
  so concurrent agents don't race on it.
- **Multi-feature:** wrap the body in a guarded `for` over an approved feature list
  (respect WIP=1 semantics per feature).
- **Agent selector:** named subagents are chosen via `agent(prompt, { agentType })` in the
  `run()` helper — change only `run()` to retarget, or inline an agent's `.md` role into the
  prompt. The `step(name, thunk)` helper wraps the bare `phase()` marker so each gate reads
  as one line.
- **Model per agent:** `run()` sends `opts.model` from the `MODEL_FOR` map **only when
  `args.proModel`/`fastModel` are passed** — otherwise no model is sent and every agent inherits
  the session/subagent default (`CLAUDE_CODE_SUBAGENT_MODEL` honored). To re-tier an agent when
  pinning, move it between `PRO` and `FAST` in `MODEL_FOR`; to add a third tier, add a constant
  and point the agent's entry at it (see *Model routing* above).
- **Parallel review cluster:** `reviewCluster()` runs quality + correctness + [security] via
  `parallel()` and is called for both the first pass and each loop re-review. A `null` (dead
  agent) is coerced to `CHANGES`, so the loop never false-approves.
