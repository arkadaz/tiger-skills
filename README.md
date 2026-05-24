# tiger-skills

Claude Code skills for code quality and harness engineering. The two skills work as one system: **harness-engineering** is the outer loop (process: what to do, when) and **code-quality** is the inner loop (craft: how to write the code). Each explicitly cross-references the other at handoff points. Follows the [Agent Skills](https://agentskills.io) standard.

## Skills

| Skill | Description |
|-------|-------------|
| `code-quality` | Inner loop — enforces 13 design principles (SRP, OCP, LSP, DRY, etc.) plus language-specific rules for **Python** and **Rust**. Independent review agent, typed boundaries, structured logging, enums over magic strings, no water code. |
| `harness-engineering` | Outer loop — session discipline (clock-in/out), spec-before-code, WIP=1, three-layer verification pipeline, parallel agent dispatch, AGENTS.md as router, PROGRESS.md + DECISIONS.md, GRAPH.md code flow, diagnostic loop. |

## Structure

```
tiger-skills/
├── skills/
│   ├── code-quality/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── design-principles.md    — 13 principles with violation signals
│   │       ├── design-patterns.md      — Pattern selection guide + cheat sheet
│   │       ├── review-agent.md         — Independent code review flow
│   │       ├── python/
│   │       │   ├── rules.md            — Python: Pydantic, logging, enums, structure
│   │       │   └── examples.md         — Python: 13 principles + 13 patterns in code
│   │       └── rust/
│   │           ├── rules.md            — Rust: serde, tracing, enums, cargo
│   │           └── examples.md         — Rust: 13 principles + 13 patterns in code
│   └── harness-engineering/
│       ├── SKILL.md
│       └── references/
│           ├── repo-system.md          — AGENTS.md template, codebase map, cold-start test
│           ├── session-discipline.md   — Clock-in/out routines, PROGRESS.md, DECISIONS.md
│           ├── task-management.md      — WIP=1, feature state machine, parallel agents
│           ├── verification.md         — 3-layer pipeline, definition of done
│           ├── doc-first.md            — Spec-before-code, business docs, GRAPH.md
│           └── workflow.md             — 14-step implementation flow, diagnostic loop
├── .claude-plugin/
│   └── plugin.json
└── README.md
```

## Install

### Method 1: npx (recommended)

```bash
npx skills add arkadaz/tiger-skills
```

### Method 2: Plugin Marketplace

In Claude Code:
```
/plugin marketplace add arkadaz/tiger-skills
/plugin install tiger-skills@arkadaz
```

### Method 3: Manual Install

**macOS/Linux:**
```bash
git clone https://github.com/arkadaz/tiger-skills.git
mkdir -p ~/.claude/skills
cp -r tiger-skills/skills/code-quality ~/.claude/skills/
cp -r tiger-skills/skills/harness-engineering ~/.claude/skills/
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/arkadaz/tiger-skills.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills"
Copy-Item -Recurse tiger-skills\skills\code-quality "$env:USERPROFILE\.claude\skills\"
Copy-Item -Recurse tiger-skills\skills\harness-engineering "$env:USERPROFILE\.claude\skills\"
```

### Method 4: Symlink (dev/contributing)

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
