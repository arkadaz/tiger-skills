# tiger-skills

Two Claude Code skills that work as one system — **harness-engineering** (outer loop) orchestrates the full agent workflow and delegates to **superpowers** skills for brainstorming, planning, TDD, debugging, and verification, while **code-quality** (inner loop) governs every line of code written. The harness wraps each delegated skill with state tracking, session discipline, and verification gates.

Follows the [Agent Skills](https://agentskills.io) standard.

## How the System Works

```
USER REQUEST
    |
    v
+------------------------------------------------------------------+
|  harness-engineering (Conductor)                                  |
|                                                                   |
|  SESSION START ── clock-in, read PROGRESS.md, DECISIONS.md,      |
|  |                run make check                                  |
|  |                                                                |
|  CLARIFY                                                          |
|  |  BEFORE: read GRAPH.md, codebase-map, business docs            |
|  |  INVOKE: superpowers:brainstorming ──> design + spec           |
|  |  AFTER:  update PROGRESS.md, DECISIONS.md, business docs       |
|  |                                                                |
|  PLAN                                                             |
|  |  BEFORE: verify spec, check WIP=1, read GRAPH.md               |
|  |  INVOKE: superpowers:writing-plans ──> bite-sized tasks         |
|  |  AFTER:  update PROGRESS.md (planned)                          |
|  |                                                                |
|  IMPLEMENT                                                        |
|  |  BEFORE: pass code-quality comprehension gate                  |
|  |  INVOKE: superpowers:subagent-driven-development               |
|  |          + superpowers:test-driven-development                 |
|  |          + superpowers:systematic-debugging (on failure)        |
|  |          + code-quality rules (every line)                     |
|  |  DURING: WIP=1, no placeholders, auto-track after every commit |
|  |  AFTER:  update PROGRESS, GRAPH, codebase-map, DECISIONS       |
|  |                                                                |
|  VERIFY                                                           |
|  |  INVOKE: superpowers:verification-before-completion            |
|  |  RUN:    3-layer pipeline (static > runtime > system)          |
|  |  SPAWN:  code-quality review agent (independent audit)         |
|  |  GATE:   7-item completion gate, all TRUE                      |
|  |                                                                |
|  TRACK ── auto-update all 8 harness files                         |
|  |                                                                |
|  SESSION END ── clock-out, 8-item exit checklist                  |
+------------------------------------------------------------------+
```

Every phase follows the same pattern: **BEFORE** (harness reads state files) **> INVOKE** (superpowers skill runs) **> AFTER** (harness updates state files). The harness never delegates control — it wraps each skill.

---

## What Each Piece Does

### harness-engineering (Outer Loop + Conductor)

The conductor orchestrates the full agent workflow. It manages session state, delegates to superpowers skills at defined handoff points, and wraps every delegation with harness-specific pre-work and state updates.

**8-Phase Conductor Protocol:**

| Phase | BEFORE (Harness) | INVOKE (Skill) | AFTER (Harness) |
|-------|-------------------|----------------|-----------------|
| 1. SESSION START | Clock-in, read state files, `make check` | — | — |
| 2. CLARIFY | Read GRAPH, codebase-map, business docs | `superpowers:brainstorming` | PROGRESS, DECISIONS, business docs |
| 3. SPEC | (only if brainstorming skipped) | — | PROGRESS |
| 4. PLAN | Verify spec, WIP=1, read GRAPH, task rules | `superpowers:writing-plans` | PROGRESS (planned) |
| 5. IMPLEMENT | Code-quality comprehension gate | `subagent-driven-dev` or `executing-plans` + `TDD` + `debugging` + `code-quality` | PROGRESS, GRAPH, codebase-map, DECISIONS |
| 6. VERIFY | — | `verification-before-completion` + 3-layer pipeline + code-quality review agent | PROGRESS (passing + evidence) |
| 7. TRACK | — | — | Full auto-track checklist |
| 8. SESSION END | Clock-out, 8-item exit checklist | — | — |

**Skills the conductor orchestrates:**

| Superpowers Skill | What It Does | Invoked At |
|-------------------|-------------|-----------|
| `superpowers:brainstorming` | Business discovery, 2-3 approaches, design, spec writing, spec self-review | Phase 2 (CLARIFY) |
| `superpowers:writing-plans` | Bite-sized task decomposition, complete code in every step, plan self-review | Phase 4 (PLAN) |
| `superpowers:test-driven-development` | Red-Green-Refactor — no production code without a failing test first | Phase 5 (IMPLEMENT) |
| `superpowers:subagent-driven-development` | Fresh subagent per task, two-stage review (spec compliance + code quality) | Phase 5 (IMPLEMENT) |
| `superpowers:executing-plans` | Sequential task execution in current session | Phase 5 (IMPLEMENT) |
| `superpowers:systematic-debugging` | 4-phase root cause analysis — investigate, pattern, hypothesis, fix | Phase 5 (on failure) |
| `superpowers:verification-before-completion` | Iron Law — no completion claims without fresh evidence THIS session | Phase 6 (VERIFY) |

**Harness-specific features (NOT delegated to superpowers):**

- **Bootstrap Gate** — 12-item check before any work. Auto-creates missing harness files (AGENTS.md, PROGRESS.md, DECISIONS.md, GRAPH.md, codebase-map.md, Makefile, docs/business/, docs/specs/, .env.example) + hook enforcement (.harness-state, .claude/hooks/, hook settings)
- **Hook Enforcement** — 5 Claude Code hooks that mechanically enforce workflow gates: code edits blocked before 4-gate unlock (docs read + code-quality loaded + codebase read + comprehension check), commits blocked before tests pass + docs updated, push blocked before verification, auto-reset of test/doc flags after code edits, session end exit checklist reminder
- **Session Discipline** — clock-in (read state, run `make check`) and clock-out (8-item exit checklist) routines
- **Auto-Track** — after every phase and every commit, update all 8 harness files (PROGRESS.md, DECISIONS.md, GRAPH.md, codebase-map.md, business docs, AGENTS.md, spec doc, plan doc)
- **3-Layer Verification Pipeline** — static (lint + type check) > runtime (tests) > system (E2E). Sequential — layer 2 blocked until layer 1 passes.
- **7-Point Completion Gate** — all 3 layers passed + evidence recorded + code quality review passed + spec compliance confirmed
- **Diagnostic Loop** — attribute every failure to one of 5 layers (spec / context / environment / verification / state), fix that layer, never fail the same way twice
- **WIP=1** — one feature active at a time, non-negotiable
- **Feature State Machine** — `not_started` > `active` > `passing` / `blocked`
- **Bite-Sized Tasks** — every task = one commit, independently verifiable, no placeholders ever

**Reference files:**

| Reference | Content |
|-----------|---------|
| `references/repo-system.md` | AGENTS.md template, codebase knowledge map, cold-start test |
| `references/session-discipline.md` | Clock-in/out routines, PROGRESS.md template, DECISIONS.md template |
| `references/task-management.md` | WIP=1 rules, bite-sized tasks, subagent protocol, model selection |
| `references/verification.md` | Iron Law, completion gate, rationalization prevention, 3-layer pipeline |
| `references/doc-first.md` | Spec template, business docs, GRAPH.md template with completeness checklist |
| `references/workflow.md` | 14-step implementation flow, self-review checklists, anti-patterns |
| `references/hooks.md` | Hook scripts, .harness-state format, phase transitions, settings config |

---

### code-quality (Inner Loop)

Enforces design principles and language-specific rules during implementation. Loaded by harness-engineering at Phase 5 (IMPLEMENT) and Phase 6 (VERIFY).

**Integration with harness-engineering:**

| Handoff Point | What Happens |
|---------------|-------------|
| Phase 5 BEFORE | Agent passes the comprehension gate (read all 13 principles + language rules, pass 5-question self-check) before writing any code |
| Phase 5 DURING | All code must comply with code-quality rules (13 design principles + 11 tooling rules) |
| Phase 6 Step 3 | Harness spawns an independent code-quality review agent to audit the diff |
| Phase 6 GATE | Code quality review must pass (0 MAJOR/BLOCKING findings) before completion |

**Comprehension Gate:** Before writing ANY code, the agent must read all 13 design principles + all language rules + all language examples, then pass a 5-item self-check. Skimming is not reading. "I get the idea" is not understanding.

**Design Principles (13):** SRP, OCP, LSP, DRY, Interface Segregation, Composition over Inheritance, Encapsulation, Least Surprise, Lazy Evaluation, Invariant Protection, and more — each with violation signals and fixes.

**Design Patterns (13):** Factory, Strategy, Observer, State, Decorator, Template Method, Adapter, Iterator, Composite, Singleton, Abstract Factory, Facade, Visitor — with pattern selection guide.

**Language Support:**
- **Python** — Pydantic at boundaries, `mypy --strict`, `ruff`, structured logging, enums, config injection
- **Rust** — serde at boundaries, `clippy`, `cargo`, tracing, enums, config injection

**Enforced Rules (11 tooling items):**
- Types — Pydantic/serde at boundaries, fully parameterized generics (no bare `dict`/`list`/`set`/`tuple`); 5-case type fix: TypedDict/Pydantic/dataclass for data, Callable/Protocol for callables, NewType for primitives, Enum/Literal for fixed sets, recursive alias for unknown JSON
- DI — external dependencies constructor-injected, never passed as function parameters
- Enums — all fixed choice sets are enums, including factory/registry keys
- Naming — no leading-underscore on ANY name (functions, methods, variables, attributes)
- Logging — structured logging only (no `print()`/`println!()`)
- No bare except — specific exceptions only
- Lint clean — project linter passes
- Type check clean — project type checker passes
- No water — every line earns its place
- Flat functions — no nested `def` inside `def`, every function at module level or class method
- Init files — `__init__.py` present in every package directory, always empty

**Independent Review Agent:** After implementing, a separate agent audits the diff against all 24 audit items (13 principles + 11 tooling rules).

---

### superpowers (External Dependency)

The superpowers plugin provides the implementation skills that harness-engineering orchestrates. These are NOT bundled in tiger-skills — they come from the [superpowers plugin](https://github.com/anthropics/claude-code-superpowers).

| Skill | Role in Tiger-Skills |
|-------|---------------------|
| `brainstorming` | Business discovery, design, spec writing — invoked at Phase 2 |
| `writing-plans` | Bite-sized task decomposition — invoked at Phase 4 |
| `test-driven-development` | Red-Green-Refactor — invoked at Phase 5 |
| `subagent-driven-development` | Parallel task execution with review — invoked at Phase 5 |
| `executing-plans` | Sequential task execution — invoked at Phase 5 |
| `systematic-debugging` | 4-phase root cause analysis — invoked on any failure |
| `verification-before-completion` | Iron Law enforcement — invoked at Phase 6 |

Tiger-skills works without superpowers installed — the harness-engineering references contain equivalent guidance in the reference files. But with superpowers installed, the conductor automatically delegates to the more detailed superpowers implementations.

---

## Structure

```
tiger-skills/
├── skills/
│   ├── code-quality/
│   │   ├── SKILL.md                   — Router: 5 non-negotiables, comprehension gate, 11-item audit checklist
│   │   └── references/
│   │       ├── design-principles.md   — 13 principles with violation signals and fixes
│   │       ├── design-patterns.md     — 13 patterns with selection guide
│   │       ├── review-agent.md        — Independent review flow + report template
│   │       ├── python/
│   │       │   ├── rules.md           — Pydantic, logging, enums, mypy, ruff, no bare generics
│   │       │   └── examples.md        — Code examples for all 13 principles + 13 patterns
│   │       └── rust/
│   │           ├── rules.md           — serde, tracing, enums, clippy, cargo
│   │           └── examples.md        — Code examples for all 13 principles + 13 patterns
│   └── harness-engineering/
│       ├── SKILL.md                   — Conductor: bootstrap gate, 8-phase protocol, hook enforcement
│       └── references/
│           ├── repo-system.md         — AGENTS.md template, codebase map, cold-start test
│           ├── session-discipline.md  — Clock-in/out, PROGRESS.md, DECISIONS.md
│           ├── task-management.md     — WIP=1, bite-sized tasks, subagent protocol, model selection
│           ├── verification.md        — Iron Law, completion gate, rationalization prevention
│           ├── doc-first.md           — Spec-before-code, business docs, GRAPH.md
│           ├── workflow.md            — 14-step flow, self-review checklists, diagnostic loop
│           └── hooks.md              — Hook scripts, .harness-state, phase gates, settings config
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
└── README.md
```

---

## Install

### Step 1: Add the marketplace (one-time)

```bash
claude plugin marketplace add https://github.com/arkadaz/tiger-skills.git
```

### Step 2: Install the plugin

```bash
claude plugin install tiger-skills@arkadaz
```

That's it. Both `/code-quality` and `/harness-engineering` skills are now available.

### Update to latest version

```bash
claude plugin marketplace update arkadaz
claude plugin uninstall tiger-skills@arkadaz
claude plugin install tiger-skills@arkadaz
```

### Manual install (alternative)

If you prefer not to use the marketplace:

**macOS/Linux:**
```bash
git clone https://github.com/arkadaz/tiger-skills.git
mkdir -p ~/.claude/skills
cp -r tiger-skills/skills/code-quality ~/.claude/skills/
cp -r tiger-skills/skills/harness-engineering ~/.claude/skills/
```

**Windows PowerShell:**
```powershell
git clone https://github.com/arkadaz/tiger-skills.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills"
Copy-Item -Recurse tiger-skills\skills\code-quality "$env:USERPROFILE\.claude\skills\"
Copy-Item -Recurse tiger-skills\skills\harness-engineering "$env:USERPROFILE\.claude\skills\"
```

### Symlink (dev/contributing)

```bash
git clone https://github.com/arkadaz/tiger-skills.git
mkdir -p ~/.claude/skills
ln -s $(pwd)/tiger-skills/skills/code-quality ~/.claude/skills/
ln -s $(pwd)/tiger-skills/skills/harness-engineering ~/.claude/skills/
```

---

## Update

```bash
cd tiger-skills
git pull
# Restart Claude Code — skills reload automatically
```

---

## Verify

Start Claude Code. Both `/code-quality` and `/harness-engineering` should appear in available commands.

---

## Detailed Phase Walkthrough

### Phase 1: SESSION START

The agent reads harness state files to understand where the project left off.

```
1. Read PROGRESS.md — what's completed, in progress, known issues
2. Read DECISIONS.md — locked architectural choices
3. Run make check — confirm repo is consistent
4. If make check fails — diagnose before starting new work
```

### Phase 2: CLARIFY (delegates to `superpowers:brainstorming`)

The agent reads harness context first, then invokes brainstorming for business discovery and design.

**BEFORE:** Read GRAPH.md (existing code flows), codebase-map.md (file structure), business docs (domain rules). Grep for overlapping code.

**INVOKE brainstorming:** Asks clarifying questions one at a time. Proposes 2-3 approaches with trade-offs. Presents design section by section. Writes spec. Runs spec self-review. Gets user approval.

**AFTER:** Update PROGRESS.md (feature → active). Record decisions in DECISIONS.md. Create/update business docs.

### Phase 3: SPEC (only if brainstorming was skipped)

For bug fixes or when the user provides a complete spec. Write to `docs/specs/YYYY-MM-DD-<topic>.md`. Run spec self-review. Get approval.

### Phase 4: PLAN (delegates to `superpowers:writing-plans`)

**BEFORE:** Verify spec exists. Check WIP=1. Read GRAPH.md for integration points. Load task-management rules.

**INVOKE writing-plans:** Maps file structure. Decomposes into bite-sized tasks (2-5 min each). Provides complete code in every step. TDD structure. Plan self-review. Offers execution choice (subagent-driven vs inline).

**AFTER:** Update PROGRESS.md (planned). Verify plan aligns with GRAPH.md.

### Phase 5: IMPLEMENT (delegates to execution + TDD + debugging + code-quality)

**BEFORE — Code-quality comprehension gate:**
1. Read all 13 design principles
2. Read language-specific rules (Python or Rust)
3. Read language examples
4. Pass 5-question self-check — all must be YES

**INVOKE execution skill:**

| Path | Skill | How It Works |
|------|-------|-------------|
| Subagent-driven (recommended) | `superpowers:subagent-driven-development` | Fresh subagent per task. Each uses TDD + code-quality. Two-stage review after each (spec compliance + code quality review agent). |
| Inline | `superpowers:executing-plans` | Sequential execution. TDD + code-quality on every step. |

All code also uses:
- `superpowers:test-driven-development` — Red-Green-Refactor, no code before tests
- `superpowers:systematic-debugging` — on any failure, 4-phase root cause analysis
- `code-quality` rules — 13 principles + 11 tooling rules on every line

**DURING (harness rules on top):**
- WIP=1 — one feature at a time
- No placeholders — `pass`, `todo!()`, `raise NotImplementedError` forbidden
- Auto-track after every commit — update PROGRESS, GRAPH, codebase-map, DECISIONS

### Phase 6: VERIFY (delegates to verification + pipeline + review)

Three verification systems combine:

**Step 1 — Iron Law** (`superpowers:verification-before-completion`): No completion claims without fresh evidence. Identify command > run it > read output > verify > only then claim.

**Step 2 — 3-Layer Pipeline:**

| Layer | What | Required For |
|-------|------|-------------|
| 1. Static | Lint + type check | Every change |
| 2. Runtime | Unit + integration tests | Every change |
| 3. System | E2E / smoke test | Cross-component changes |

Sequential — layer 2 blocked until layer 1 passes.

**Step 3 — Code Quality Review:** Spawn independent review agent (per `code-quality/references/review-agent.md`) to audit against all 24 items. Fix MAJOR/BLOCKING findings. Re-run verification.

**7-Point Completion Gate (all must be TRUE):**
1. Layer 1 ran THIS session, after last code change
2. Layer 2 ran THIS session, after last code change
3. Layer 3 ran THIS session (if required)
4. Every output shows zero failures
5. Evidence recorded
6. Code quality review passed (0 MAJOR/BLOCKING)
7. Spec compliance confirmed

### Phase 7: TRACK (harness-specific)

Auto-update all 8 harness files:

```
- [ ] PROGRESS.md — feature state, progress %, known issues
- [ ] DECISIONS.md — architectural choices with rationale
- [ ] docs/GRAPH.md — code flows with IN/OUT/ADDS/COMPUTES
- [ ] docs/codebase-map.md — file paths, roles, dependencies
- [ ] docs/business/<domain>.md — business rules with implementation references
- [ ] AGENTS.md — conventions, commands, constraints
- [ ] Spec doc — differences between spec and what was built
- [ ] Plan doc — tasks completed/blocked
```

### Phase 8: SESSION END

8-item exit checklist:
```
- [ ] make check passes
- [ ] PROGRESS.md updated
- [ ] DECISIONS.md updated
- [ ] All work committed with clean messages
- [ ] No debug code, print(), commented-out code, stale TODOs
- [ ] No temporary files
- [ ] Standard startup path works
- [ ] AGENTS.md updated if needed
```

---

## Diagnostic Loop

When something fails, the system combines superpowers debugging with harness layer diagnosis:

1. **INVOKE `superpowers:systematic-debugging`** — 4-phase root cause analysis
2. **Attribute to harness layer** — spec / context / environment / verification / state
3. **Fix the harness** — so this class of failure never happens again

| Layer | Example | Fix |
|-------|---------|-----|
| Spec | Built X, wanted Y | Run brainstorming for the ambiguous part |
| Context | Used raw SQL, didn't know the rule | Add rule to AGENTS.md |
| Environment | Module not found | Fix pyproject.toml + `make setup` |
| Verification | Tests pass, E2E fails | Add step to `make check` |
| State | Re-implemented finished work | Update PROGRESS.md, read at clock-in |

---

## Bootstrap Gate

On first run, harness-engineering checks for 12 required items and auto-creates any that are missing:

| # | File | Purpose |
|---|------|---------|
| 1 | `AGENTS.md` / `CLAUDE.md` | Agent instruction routing |
| 2 | `PROGRESS.md` | Feature state + progress tracking |
| 3 | `DECISIONS.md` | Architectural decision records |
| 4 | `docs/GRAPH.md` | Code flow graph |
| 5 | `docs/codebase-map.md` | File directory + dependency map |
| 6 | `Makefile` | setup, test, lint, check, dev targets |
| 7 | `docs/business/` | Business rule documentation |
| 8 | `docs/specs/` | Per-feature specifications |
| 9 | `.env.example` | Required environment variables |
| 10 | `.harness-state` | Session phase tracking (gitignored) |
| 11 | `.claude/hooks/*.js` | 5 hook enforcement scripts |
| 12 | `.claude/settings.json` hooks | Hook event configuration |

No other work happens until all 12 exist.

---

## Hook Enforcement

The skill uses Claude Code hooks to mechanically enforce workflow gates. The skill prompt governs conversational flow (phase ordering). Hooks govern tool-level actions that the prompt alone can't reliably prevent.

### How It Works

```
Skill writes phase transitions → .harness-state (JSON)
Hook scripts read .harness-state → block/allow tool calls
```

### The 5 Hooks

| Hook | Event | Blocks / Does | Until / When |
|------|-------|---------------|-------------|
| **pre-edit-gate** | PreToolUse on Edit\|Write | Blocks code file edits | Phase = `implement` AND all 4 gates: `docs_read` + `code_quality_loaded` + `codebase_read` + `comprehension_gate` |
| **pre-commit-gate** | PreToolUse on Bash\|PowerShell | Blocks `git commit` | Tests passed AND docs updated this session |
| **pre-push-gate** | PreToolUse on Bash\|PowerShell | Blocks `git push` | Full verification pipeline passed |
| **post-edit-reset** | PostToolUse on Edit\|Write | Auto-resets `tests_passed` + `docs_updated` to false | After any code file edit (non-code files excluded) |
| **session-end-check** | Stop | Advisory exit warnings | Reminds about 8-item exit checklist |

### State File: `.harness-state`

Session-specific JSON file in project root. Tracks current phase and gate flags:

```json
{
  "phase": "implement",
  "docs_read": true,
  "code_quality_loaded": true,
  "codebase_read": true,
  "comprehension_gate": true,
  "tests_passed": false,
  "docs_updated": false,
  "verification_passed": false
}
```

The agent updates this file at each phase transition. Hook scripts read it to make allow/deny decisions. The file is gitignored (session-specific, not shared).

### What Hooks Can vs Cannot Enforce

| Enforceable (tool-level) | Not enforceable (conversation-level) |
|--------------------------|--------------------------------------|
| No code edits before harness docs read | Phase ordering (brainstorm before plan) |
| No code edits before code-quality skill loaded | Spec self-review happened |
| No code edits before codebase is read | Questions asked one-at-a-time |
| No code edits before comprehension gate passed | Design presented section-by-section |
| No commits without tests passing | — |
| No commits without docs updated | — |
| No push without verification | — |
| Auto-reset test/doc flags after code edits | — |
| Exit checklist reminder | — |

Hooks provide the mechanical safety net. The skill prompt provides the conversational discipline. Together they cover both layers.
