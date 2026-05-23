# tiger-skills

Claude Code skills for code quality and harness engineering. Follows the [Agent Skills](https://agentskills.io) standard.

## Skills

| Skill | Description |
|-------|-------------|
| `code-quality` | Enforces design principles (SRP, OCP, LSP, DRY, etc.), Pydantic types, logging, enums, and clean code rules |
| `harness-engineering` | Manages agent harness: AGENTS.md as router, PROGRESS.md, session discipline, WIP=1, three-layer verification, spec-before-code, Git discipline |

## Structure

```
tiger-skills/
├── skills/
│   ├── code-quality/
│   │   └── SKILL.md
│   └── harness-engineering/
│       └── SKILL.md
├── .claude-plugin/
│   └── plugin.json
└── README.md
```

## Install

### Method 1: Plugin Marketplace (recommended)

In Claude Code:
```
/plugin marketplace add arkadaz/tiger-skills
/plugin install tiger-skills@arkadaz
```

### Method 2: Manual Install

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

### Method 3: Symlink (dev/contributing)

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
