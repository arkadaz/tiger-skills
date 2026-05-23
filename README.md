# tiger-skills

Custom Claude Code skills for code quality and harness engineering.

## Skills

### code-quality
Enforces design principles (SRP, OCP, LSP, DRY, etc.), Pydantic types, logging, enums, and clean code rules during implementation and code review.

### harness-engineering
Manages the agent harness: AGENTS.md as router, PROGRESS.md, session discipline, WIP=1, three-layer verification, spec-before-code, business logic docs, Git discipline.

## Install on a new PC

```bash
# Clone the repo
git clone https://github.com/arkadaz/tiger-skills.git

# Create the Claude skills directory if it doesn't exist
mkdir -p ~/.claude/skills
# On Windows: mkdir %USERPROFILE%\.claude\skills

# Copy the skills
cp -r tiger-skills/code-quality ~/.claude/skills/
cp -r tiger-skills/harness-engineering ~/.claude/skills/
# On Windows:
# xcopy tiger-skills\code-quality %USERPROFILE%\.claude\skills\code-quality\ /E /I
# xcopy tiger-skills\harness-engineering %USERPROFILE%\.claude\skills\harness-engineering\ /E /I

# Restart Claude Code. The skills will appear in your available skills list.
```

## Update on a new PC

```bash
cd tiger-skills
git pull
cp -r code-quality ~/.claude/skills/
cp -r harness-engineering ~/.claude/skills/
```

## Verify Installation

Start Claude Code and type `/code-quality` or `/harness-engineering` — both should appear.
