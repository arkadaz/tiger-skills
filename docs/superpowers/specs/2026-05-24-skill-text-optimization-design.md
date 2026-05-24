# Skill Text Optimization

Optimize skill files for conciseness and clarity while keeping load-bearing instructional content. The two skills (code-quality and harness-engineering) must work together with explicit handoffs.

## Scope

- **In:** code-quality (8 files, ~2,450 lines), harness-engineering (7 files, ~1,120 lines)
- **Out:** Structural reorganization, new rules, new features

## Optimization Rules

| Rule | Meaning |
|------|---------|
| One right-way example | Keep correct-pattern code snippet; drop separate "wrong" block unless the mistake is non-obvious |
| Why once | Rationale lives in one file; others link to it |
| Prose to table | Comparison paragraphs and signal lists become scannable tables |
| Cross-reference explicitly | Each SKILL.md states when to load the other skill, with one-line reason |

## Two Skills, One System

harness-engineering is the outer loop (process: what to do, when). code-quality is the inner loop (craft: how to write the code).

**harness-engineering triggers code-quality at:**
- Workflow step 6 (Implement) — load code-quality rules
- Workflow steps 7-9 (Verify) — code-quality non-negotiable #3
- Workflow step 10 (Review) — code-quality review-agent.md
- Clock-out — code-quality 19-item audit checklist

**code-quality triggers harness-engineering at:**
- Non-negotiable #1 (Explore before implement) — harness doc-first
- After implementing — harness 3-layer verification pipeline
- New conventions — harness AGENTS.md update rule

Each SKILL.md will have a one-line cross-reference. Handoff points use consistent markers.

## Per-File Targets

### code-quality

| File | What Changes |
|------|-------------|
| SKILL.md | Tighter audit checklist; remove "Why" blurbs (delegate to refs); add cross-ref to harness-engineering |
| design-principles.md | One tight sentence per fix; keep violation signals |
| design-patterns.md | Trim "How to Choose" section |
| python/rules.md | One example per rule; drop "wrong" blocks where obvious; merge repeated rationale |
| python/examples.md | Shrink to pattern skeleton; keep concrete code agents pattern-match on |
| rust/rules.md | Same treatment as Python rules |
| rust/examples.md | Same treatment as Python examples |
| review-agent.md | Collapse repeated 19-item list (link to SKILL.md); trim spawn prompt template |

### harness-engineering

| File | What Changes |
|------|-------------|
| SKILL.md | Add cross-ref to code-quality |
| repo-system.md | Trim AGENTS.md template and codebase-map template to essentials |
| session-discipline.md | Merge repetitive clock-in/out rationale into one paragraph |
| task-management.md | Trim verbose examples; keep decision checklist and state machine |
| verification.md | Remove duplicate rationale (code-quality owns lint/type rules); keep 3-layer sequence |
| doc-first.md | Cut full Mermaid + data flow example; link to template instead |
| workflow.md | Remove overlap with session-discipline; keep diagnostic loop and anti-patterns |

## Principle

Genuine waste only. No line targets. The test: can an agent encountering this for the first time apply the rule correctly? If yes after cutting, cut. If cutting makes the rule ambiguous, keep it.
