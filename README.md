# tiger-skills

Two Claude Code skills that work as one system. **harness-engineering** is the outer loop — process, workflow, and session management. **code-quality** is the inner loop — how to write the actual code. Each cross-references the other at defined handoff points.

Follows the [Agent Skills](https://agentskills.io) standard.

## What This Does

### code-quality (Inner Loop)

Enforces design principles and language-specific rules during implementation.

**Design Principles (13):** SRP, OCP, LSP, DRY, Interface Segregation, Composition over Inheritance, Encapsulation, Least Surprise, Lazy Evaluation, Invariant Protection, and more — each with violation signals and fixes.

**Design Patterns (13):** Factory, Strategy, Observer, State, Decorator, Template Method, Adapter, Iterator, Composite, Singleton, Abstract Factory, Facade, Visitor — with pattern selection guide.

**Language Support:**
- **Python** — Pydantic at boundaries, `mypy --strict`, `ruff`, structured logging, enums, config injection
- **Rust** — serde at boundaries, `clippy`, `cargo`, tracing, enums, config injection

**Enforced Rules:**
- No bare generics (`dict`/`list`/`set`/`tuple` must have type parameters)
- All fixed choice sets must be enums (including factory/registry keys)
- `__init__.py` must be empty (no re-exports, no `__all__`, no code)
- No leading-underscore on ANY name (functions, methods, variables, attributes)
- Flat functions — no nested `def` inside `def`, every function at module level
- Structured logging only (no `print()`/`println!()`)
- No bare `except` / `catch` (specific exceptions only)
- Every line earns its place (no water code)

**Independent Review Agent:** After implementing, a separate agent audits the diff against all 19 audit items (13 principles + 6 tooling rules).

### harness-engineering (Outer Loop)

Manages the full agent workflow from session start to session end.

**7-Phase Conductor Protocol:**

| Phase | What Happens | Gate |
|-------|-------------|------|
| 1. CLARIFY | Ask questions until scope/criteria are certain | User confirms |
| 2. EXPLORE | Read codebase map, graph, business docs, existing code | Can answer: what exists, how it connects |
| 3. SPEC | Write spec, self-review, get user approval | User approves |
| 4. PLAN | Write plan with bite-sized tasks, self-review, get approval | User approves |
| 5. IMPLEMENT | TDD, code-quality rules, subagent-driven parallel execution | Two-stage review passes |
| 6. VERIFY | Iron Law — 3-layer pipeline, completion gate | Fresh evidence recorded |
| 7. TRACK | Update PROGRESS, DECISIONS, GRAPH, codebase-map, AGENTS | All files committed |

**Iron Law Verification:**
- Never claim done without fresh evidence from THIS session
- 5-point completion gate (all must be TRUE)
- Rationalization prevention table (9 common rationalizations)
- Red flag words table (10 weasel words that signal skipped verification)

**Subagent-Driven Development:**
- Self-contained prompt template (subagent gets full spec, not a reference)
- Status protocol: DONE / DONE\_WITH\_CONCERNS / NEEDS\_CONTEXT / BLOCKED
- Model selection by complexity (opus for design, sonnet for patterns, haiku for trivial)
- Two-stage review: spec compliance first, then code quality
- "Do not trust the report" — spec reviewer verifies by reading code
- Escalation protocol (when to stop and say "too hard")
- Continuous execution (don't pause between tasks)

**TDD (Red-Green-Refactor):**
- No production code without failing test first
- Testing anti-patterns (mock behavior, test-only methods, incomplete mocks)
- 11 common rationalizations table

**Systematic Debugging:**
- 4-phase process: root cause → pattern analysis → hypothesis → implementation
- Defense-in-depth validation (4 layers)
- Condition-based waiting (replace arbitrary timeouts)
- 3-fix limit before questioning architecture

**Bite-Sized Tasks:**
- Every task = one commit, independently verifiable
- No placeholders ever (`pass`, `todo!()`, `raise NotImplementedError` = forbidden)
- Decomposition guide by task type

**Self-Review Checklists:**
- Spec self-review (placeholders, consistency, scope, ambiguity)
- Plan self-review (spec coverage, placeholder scan, type consistency)
- Implementer self-review (completeness, quality, discipline, testing)

**Session Management:**
- Bootstrap gate (9 checks — auto-creates missing harness files)
- Clock-in/out routines
- PROGRESS.md, DECISIONS.md, GRAPH.md state tracking
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
harness-engineering: CLARIFY → EXPLORE → SPEC → PLAN
    ↓
    IMPLEMENT ──→ code-quality: types, SRP, OCP, enums, logging, patterns
                  code-quality: review agent (19-item audit)
    ↓
harness-engineering: VERIFY (Iron Law) → TRACK
    ↓
Done
```

Handoff points:
- `→ apply code-quality` — at workflow steps 6-10 (implement, verify, review)
- `→ follow harness verification` — after implementing, run 3-layer pipeline
