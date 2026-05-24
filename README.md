# tiger-skills

Two Claude Code skills that work as one system. **harness-engineering** is the outer loop — process, workflow, and session management. **code-quality** is the inner loop — how to write the actual code. Each cross-references the other at defined handoff points.

Follows the [Agent Skills](https://agentskills.io) standard.

## What This Does

### code-quality (Inner Loop)

Enforces design principles and language-specific rules during implementation. **Comprehension gate blocks code until all rules are read and understood.**

**Comprehension Gate:** Before writing ANY code, the agent must read all 13 design principles + all language rules + all language examples, then pass a 5-item self-check. Skimming is not reading. "I get the idea" is not understanding.

**Design Principles (13):** SRP, OCP, LSP, DRY, Interface Segregation, Composition over Inheritance, Encapsulation, Least Surprise, Lazy Evaluation, Invariant Protection, and more — each with violation signals and fixes.

**Design Patterns (13):** Factory, Strategy, Observer, State, Decorator, Template Method, Adapter, Iterator, Composite, Singleton, Abstract Factory, Facade, Visitor — with pattern selection guide.

**Language Support:**
- **Python** — Pydantic at boundaries, `mypy --strict`, `ruff`, structured logging, enums, config injection
- **Rust** — serde at boundaries, `clippy`, `cargo`, tracing, enums, config injection

**Enforced Rules (10 tooling items):**
- Types — Pydantic/serde at boundaries, fully parameterized generics (no bare `dict`/`list`/`set`/`tuple`)
- Enums — all fixed choice sets are enums, including factory/registry keys
- Naming — no leading-underscore on ANY name (functions, methods, variables, attributes)
- Logging — structured logging only (no `print()`/`println!()`)
- No bare except — specific exceptions only
- Lint clean — project linter passes
- Type check clean — project type checker passes
- No water — every line earns its place
- Flat functions — no nested `def` inside `def`, every function at module level or class method
- Init files — `__init__.py` present in every package directory, always empty

**Independent Review Agent:** After implementing, a separate agent audits the diff against all 23 audit items (13 principles + 10 tooling rules).

### harness-engineering (Outer Loop)

Self-contained conductor — manages the full agent workflow from business discovery to tracked completion. No external dependencies.

**7-Phase Conductor Protocol:**

| Phase | What Happens | Gate |
|-------|-------------|------|
| 1. CLARIFY | Business discovery (WHY), 2-3 approaches with trade-offs, technical confirmation | User confirms |
| 2. EXPLORE | Read codebase map, graph, business docs, existing code; create missing harness files | Can answer: what exists, how it connects |
| 3. SPEC | Write spec, self-review (placeholders/consistency/scope/ambiguity), get approval | User approves |
| 4. PLAN | Bite-sized tasks, checkpoints, dependencies | User approves |
| 5. IMPLEMENT | TDD + code-quality rules + subagent parallel execution | Two-stage review passes |
| 6. VERIFY | Iron Law: 3-layer pipeline, 5-point completion gate, rationalization prevention | Fresh evidence THIS session |
| 7. TRACK | Auto-update ALL 8 harness files after every phase, every commit | All files current |

**Business Discovery (Phase 1):**
- Asks WHY: purpose, users, success criteria, constraints — one question at a time
- Scope gate: decomposes large requests into independent subsystems
- Always proposes 2-3 approaches with trade-offs (YAGNI ruthlessly)
- Technical confirmation: I/Os, files to touch, verification criteria

**Auto-Track (Phase 7):**
Fires after EVERY phase, EVERY commit — not just "at the end." Updates all 8 harness files:
- `PROGRESS.md` — feature state, progress %, known issues, next steps
- `DECISIONS.md` — every architectural choice with rationale
- `docs/GRAPH.md` — every code flow with IN/OUT/ADDS/COMPUTES field-level detail
- `docs/codebase-map.md` — every file create/delete/rename with dependency graph
- `docs/business/<domain>.md` — every business rule with implementation reference
- `AGENTS.md` — every new convention, command, constraint, or topic doc
- Spec doc — any difference between spec and what was built
- Plan doc — every task completed/blocked

**Iron Law Verification (Phase 6):**
- Never claim done without fresh evidence from THIS session
- 5-point completion gate (all must be TRUE)
- Rationalization prevention table (9 common rationalizations)
- Red flag words table (10 weasel words that signal skipped verification)

**Subagent-Driven Development (Phase 5):**
- Self-contained prompt template (subagent gets full spec, not a reference)
- Status protocol: DONE / DONE\_WITH\_CONCERNS / NEEDS\_CONTEXT / BLOCKED
- Model selection by complexity (opus for design, sonnet for patterns, haiku for trivial)
- Two-stage review: spec compliance first, then code quality
- Escalation protocol (when to stop and say "too hard")

**TDD (Red-Green-Refactor):**
- No production code without failing test first
- Testing anti-patterns + 11 common rationalizations table

**Systematic Debugging:**
- 4-phase: root cause → pattern → hypothesis → implementation
- Defense-in-depth validation (4 layers)
- 3-fix limit before questioning architecture

**Bite-Sized Tasks:**
- Every task = one commit, independently verifiable
- No placeholders ever (`pass`, `todo!()`, `raise NotImplementedError`)
- Decomposition guide by task type

**Session Management:**
- Bootstrap gate (9 checks — auto-creates missing harness files)
- Clock-in/out routines
- WIP=1 (one feature at a time)
- Feature state machine (not\_started → active → passing / blocked)
- 14-step implementation workflow
- Diagnostic loop (5 layers: spec / context / environment / verification / state)

## Structure

```
tiger-skills/
├── skills/
│   ├── code-quality/
│   │   ├── SKILL.md                   — Router: 5 non-negotiables, 9-item audit checklist
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
│       ├── SKILL.md                   — Router: bootstrap gate, 7-phase conductor protocol
│       └── references/
│           ├── repo-system.md         — AGENTS.md template, codebase map, cold-start test
│           ├── session-discipline.md  — Clock-in/out, PROGRESS.md, DECISIONS.md
│           ├── task-management.md     — WIP=1, bite-sized tasks, subagent protocol, model selection
│           ├── verification.md        — Iron Law, completion gate, rationalization prevention
│           ├── doc-first.md           — Spec-before-code, business docs, GRAPH.md
│           ├── workflow.md            — 14-step flow, self-review checklists, diagnostic loop
│           ├── tdd.md                 — Red-Green-Refactor, testing anti-patterns
│           └── debugging.md           — 4-phase debugging, root cause tracing, defense-in-depth
├── .claude-plugin/
│   └── plugin.json
└── README.md
```

## Install

### Via npx

```bash
npx skills add arkadaz/tiger-skills
```

### Via Claude Code Plugin

```
/plugin marketplace add arkadaz/tiger-skills
/plugin install tiger-skills@arkadaz
```

### Manual (macOS/Linux)

```bash
git clone https://github.com/arkadaz/tiger-skills.git
mkdir -p ~/.claude/skills
cp -r tiger-skills/skills/code-quality ~/.claude/skills/
cp -r tiger-skills/skills/harness-engineering ~/.claude/skills/
```

### Manual (Windows PowerShell)

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

## Update

```bash
cd tiger-skills
git pull
# Restart Claude Code — skills reload automatically
```

## Verify

Start Claude Code. Both `/code-quality` and `/harness-engineering` should appear in available commands.

## How the Two Skills Connect

```
User Request
    ↓
harness-engineering: CLARIFY (business discovery, 2-3 approaches)
    ↓  └→ AUTO-TRACK
harness-engineering: EXPLORE (codebase, create missing harness files)
    ↓
harness-engineering: SPEC (technical spec, self-review)
    ↓  └→ AUTO-TRACK
harness-engineering: PLAN (bite-sized tasks, checkpoints)
    ↓  └→ AUTO-TRACK
    IMPLEMENT ──→ code-quality: comprehension gate → 13 principles + 10 tooling rules
                  code-quality: review agent (23-item audit)
    ↓  └→ AUTO-TRACK (after every commit)
harness-engineering: VERIFY (Iron Law, 3-layer pipeline, completion gate)
    ↓  └→ AUTO-TRACK (evidence recorded, feature → passing)
harness-engineering: TRACK (final sweep: all 8 harness files current)
    ↓
Done
```

Handoff points:
- `→ apply code-quality` — at IMPLEMENT phase: comprehension gate, principles, rules, review agent
- `→ auto-track` — after every phase and every commit: PROGRESS, DECISIONS, GRAPH, codebase-map, business docs, AGENTS, spec, plan
