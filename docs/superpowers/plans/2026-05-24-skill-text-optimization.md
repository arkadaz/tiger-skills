# Skill Text Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten all 15 skill files across code-quality and harness-engineering for conciseness while keeping load-bearing instructional content, and add explicit cross-references so the two skills work as one system.

**Architecture:** Two skills in a layered relationship — harness-engineering (outer loop: process/workflow) triggers code-quality (inner loop: code craft) at specific handoff points. Each SKILL.md is a router; reference files hold the detail. Optimization is per-file: cuts target genuine waste only (duplicate rationale, obvious "wrong" examples, prose that should be tables). No line targets.

**Tech Stack:** Markdown files only. Git for version control.

---

### Task 1: code-quality SKILL.md — Router optimization + cross-ref

**Files:**
- Modify: `skills/code-quality/SKILL.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/SKILL.md` to confirm current state.

- [ ] **Step 2: Add cross-reference to harness-engineering**

After the description frontmatter line, add a cross-reference section:

```markdown
## Relationship to harness-engineering

This skill is the **inner loop** — applied during implementation. Load [harness-engineering](../harness-engineering/SKILL.md) for the **outer loop** (session discipline, spec-before-code, verification pipeline). The two skills hand off at specific points:
- `→ apply code-quality` — at workflow steps 6-10 (implement, verify, review)
- `→ follow harness verification` — after implementing, run the 3-layer pipeline
```

- [ ] **Step 3: Remove "Why" blurbs from 5 Non-Negotiables**

Remove the explanatory sentences from each non-negotiable. Keep only the imperative rule. Example — change:
```
3. **Lint and type-check every change.** Run the project's linter and type checker after every step. Zero errors tolerated.
```
To:
```
3. **Lint and type-check every change.** Zero errors tolerated.
```

- [ ] **Step 4: Tighten audit checklist**

Remove the 19-item expanded list; replace with a single-line reference to design-principles plus the 6 tooling-only items:

```markdown
## Audit Checklist (Quick Reference)

When reviewing code, check all 13 [design principles](references/design-principles.md) plus these 6 tooling items:

1. Types — Pydantic/serde at boundaries, typed signatures
2. Logging — structured logging, no print()/println!()
3. No bare except — specific exceptions only
4. Lint clean — project linter passes
5. Type check clean — project type checker passes
6. No water — every line earns its place
```

- [ ] **Step 5: Verify file reads correctly**

Read the modified file end to end. Confirm: cross-ref present, non-negotiables are tight, audit checklist is 6 items + link.

- [ ] **Step 6: Commit**

```bash
git add skills/code-quality/SKILL.md
git commit -m "Tighten code-quality SKILL.md + add harness-engineering cross-ref"
```

---

### Task 2: design-principles.md — One tight fix sentence per principle

**Files:**
- Modify: `skills/code-quality/references/design-principles.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/design-principles.md`.

- [ ] **Step 2: Compact each principle's "Fix" to one sentence**

For each of the 13 principles, compress the "Fix:" paragraph to a single imperative sentence. Keep "Violation signals" intact (agents need them to recognize problems). Example for SRP:

Before:
```
**Fix:** Split along responsibility boundaries. The original becomes an orchestrator that delegates.
```
After:
```
**Fix:** Split along responsibility boundaries. Original class becomes orchestrator; each responsibility gets its own class.
```

Apply the same single-sentence treatment to all 13 principles.

- [ ] **Step 3: Verify no principles lost**

Confirm all 13 principles are present with violation signals and one-sentence fix.

- [ ] **Step 4: Commit**

```bash
git add skills/code-quality/references/design-principles.md
git commit -m "Tighten design-principles.md — one fix sentence per principle"
```

---

### Task 3: design-patterns.md — Trim How to Choose

**Files:**
- Modify: `skills/code-quality/references/design-patterns.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/design-patterns.md`.

- [ ] **Step 2: Replace "How to Choose" section**

Replace the 4-step numbered list with a 1-liner:

Before (~6 lines):
```
## How to Choose

1. Identify the problem from the first table
2. Read the one-liner — does it match?
3. Open the language examples file for concrete code
4. Adapt the pattern structure to your domain
```

After (1 line):
```
## How to Choose

Match the problem to the selection table → verify with the one-liner → open [python/examples.md](python/examples.md) or [rust/examples.md](rust/examples.md) for code.
```

- [ ] **Step 3: Verify**

Read the file. Pattern selection table and cheat sheet intact.

- [ ] **Step 4: Commit**

```bash
git add skills/code-quality/references/design-patterns.md
git commit -m "Trim design-patterns.md How to Choose to one line"
```

---

### Task 4: python/rules.md — One example per rule, drop obvious wrong blocks

**Files:**
- Modify: `skills/code-quality/references/python/rules.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/python/rules.md`.

- [ ] **Step 2: Pydantic section — drop "Wrong" block, keep one "Correct" example**

The "Wrong" block (dict-based code) is obvious after seeing the Pydantic version. Remove lines 75-87 (the `def create_order(data: dict)` wrong example). Keep the Pydantic model definitions and the `process_order` function.

- [ ] **Step 3: No Magic Try/Except — drop redundant "Forbidden" blocks**

Keep the "Allowed" examples and the "Alternatives to try/except" list. Remove the "Forbidden" code blocks — the "Allowed" examples make the point.

- [ ] **Step 4: Logging — collapse to one example**

Keep one `process_order` example with all log levels. Drop the separate "Never" block (already covered by the rule statement).

- [ ] **Step 5: Enums — drop "Wrong" block**

Remove the `def categorize_age(age: int) -> str:` wrong example. The correct `AgeCategory` enum example is self-explanatory.

- [ ] **Step 6: Project Structure — trim directory trees to key paths only**

For each project type template, cut to the essential directories. Show `src/{api,services,repositories,models,core,utils}` rather than the full tree with every file listed.

- [ ] **Step 7: Config Management — keep one "Correct" example, drop "Wrong"**

Remove the "Wrong (scattered config)" block. The pydantic-settings example is sufficient.

- [ ] **Step 8: Verify**

Read the file. Confirm: each section has one clear example, no wrong blocks, rules are scannable.

- [ ] **Step 9: Commit**

```bash
git add skills/code-quality/references/python/rules.md
git commit -m "Tighten python/rules.md — one example per rule, drop obvious wrong blocks"
```

---

### Task 5: python/examples.md — Shrink to pattern skeleton

**Files:**
- Modify: `skills/code-quality/references/python/examples.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/python/examples.md`.

- [ ] **Step 2: Trim each pattern to essential lines**

For each pattern, keep the structure that shows the pattern mechanism. Drop verbose "VIOLATION" comments where the pattern name is self-explanatory. Example for Observer:

Before (~9 lines with full class bodies):
```python
class Subject:
    def __init__(self): self._observers: list[Observer] = []
    def attach(self, obs): self._observers.append(obs)
    def _notify(self, data):
        for obs in self._observers: obs.update(data)

class Observer(ABC):
    @abstractmethod
    def update(self, data): ...
```

After (~7 lines — same structure, condensed):
```python
class Subject:
    def __init__(self): self._observers: list[Observer] = []
    def attach(self, obs: Observer) -> None: self._observers.append(obs)
    def _notify(self, data) -> None:
        for obs in self._observers: obs.update(data)

class Observer(ABC):
    @abstractmethod
    def update(self, data) -> None: ...
```

Apply same treatment to all 13 patterns. Keep concrete code; remove redundant comments and filler.

- [ ] **Step 3: Verify**

Confirm all 13 patterns present with runnable skeleton code.

- [ ] **Step 4: Commit**

```bash
git add skills/code-quality/references/python/examples.md
git commit -m "Tighten python/examples.md — shrink to pattern skeleton"
```

---

### Task 6: rust/rules.md — Same treatment as Python rules

**Files:**
- Modify: `skills/code-quality/references/rust/rules.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/rust/rules.md`.

- [ ] **Step 2: Apply same optimization pattern as Task 4**

- Strong Types at Boundaries: drop "Wrong" block (raw serde_json::Value), keep newtype example
- Logging with Tracing: drop "Never" block, keep one `#[instrument]` example
- Enums: drop "Wrong" magic-strings block, keep exhaustive match example
- Trait-Based Abstraction: drop "Wrong" concrete-dependency block
- No Water Code: keep checklist, drop verbose wrong examples
- Error Handling: drop boxed-dyn-Error block, keep thiserror example
- Config Management: keep figment example, drop "scattered config" warning (already in Python rules)

- [ ] **Step 3: Verify**

Confirm each section has one clear correct example.

- [ ] **Step 4: Commit**

```bash
git add skills/code-quality/references/rust/rules.md
git commit -m "Tighten rust/rules.md — one example per rule, drop obvious wrong blocks"
```

---

### Task 7: rust/examples.md — Same treatment as Python examples

**Files:**
- Modify: `skills/code-quality/references/rust/examples.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/rust/examples.md`.

- [ ] **Step 2: Apply same optimization pattern as Task 5**

Trim each pattern to essential lines. Keep the Rust pattern mechanism visible. Drop verbose comments. Keep concrete types and trait impls.

- [ ] **Step 3: Verify**

Confirm all 13 patterns present.

- [ ] **Step 4: Commit**

```bash
git add skills/code-quality/references/rust/examples.md
git commit -m "Tighten rust/examples.md — shrink to pattern skeleton"
```

---

### Task 8: review-agent.md — Collapse repeated checklist, link to source

**Files:**
- Modify: `skills/code-quality/references/review-agent.md`

- [ ] **Step 1: Read current file**

Read `skills/code-quality/references/review-agent.md`.

- [ ] **Step 2: Replace the 19-item "What the Review Agent Checks" section**

Replace the full numbered list (lines 103-122, ~20 lines) with a link:

```markdown
## What the Review Agent Checks

The review agent must check all items from the [audit checklist](../SKILL.md#audit-checklist-quick-reference):
13 design principles + 6 tooling items = 19 checks total.
```

- [ ] **Step 3: Trim the spawn prompt template**

Cut the verbose prompt template (lines 44-61) to the essential instruction:

```markdown
## How to Spawn the Review Agent

Use the Agent tool with this prompt:

> You are a code review agent. Read code-quality/SKILL.md and its references/ directory.
> Audit the following files against the 19-item audit checklist:
> - [list files]
> For each violation: cite file:line, name the audit item, explain what's wrong, suggest a fix.
> Save findings to `docs/reviews/YYYY-MM-DD-<topic>-review.md`. Do NOT modify code.
```

- [ ] **Step 4: Verify**

Read file. Confirm: checklist links to SKILL.md, spawn prompt is compact, review flow and report template intact.

- [ ] **Step 5: Commit**

```bash
git add skills/code-quality/references/review-agent.md
git commit -m "Tighten review-agent.md — link checklist to SKILL.md, trim spawn prompt"
```

---

### Task 9: harness-engineering SKILL.md — Add code-quality cross-ref

**Files:**
- Modify: `skills/harness-engineering/SKILL.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/SKILL.md`.

- [ ] **Step 2: Add cross-reference to code-quality**

After the Core Philosophy table, add:

```markdown
## Relationship to code-quality

This skill is the **outer loop** — process and workflow. Load [code-quality](../code-quality/SKILL.md) for the **inner loop** — how to write the code itself. The two skills hand off at specific points:
- `→ apply code-quality` — at workflow step 6 (implement) and step 10 (review)
- `→ follow harness verification` — after implementing, run the 3-layer verification pipeline
```

- [ ] **Step 3: Verify**

Read the file. Cross-ref present and accurate.

- [ ] **Step 4: Commit**

```bash
git add skills/harness-engineering/SKILL.md
git commit -m "Add code-quality cross-ref to harness-engineering SKILL.md"
```

---

### Task 10: repo-system.md — Trim templates to essentials

**Files:**
- Modify: `skills/harness-engineering/references/repo-system.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/repo-system.md`.

- [ ] **Step 2: Trim AGENTS.md template**

Cut the full AGENTS.md template (~65 lines) to a compact example showing structure only:

```markdown
### Minimal Template

```markdown
# AGENTS.md

## Project Overview
[2-3 sentences: what, tech stack]

## Quick Start
- make setup / make dev / make test / make check

## Directory Map
src/{api,services,repositories,models,core,utils}

## Hard Constraints
- [ ] Rule 1
- [ ] Rule 2

## Verification Commands
- Lint / Type check / Tests / E2E

## Topic Docs
- [link](path) — When to load
```

Keep the rules for maintaining AGENTS.md (when to add/remove rules, placement matters).

- [ ] **Step 3: Trim codebase-map template**

Cut to the essential sections. Keep "Directory Overview" and "Key Files by domain." Drop the verbose example with every field listed (External Dependencies, Environment Variables — those belong in .env.example and AGENTS.md).

- [ ] **Step 4: Verify**

Cold-start test section intact. Template shows structure, not a full example.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/repo-system.md
git commit -m "Tighten repo-system.md — trim templates to essential structure"
```

---

### Task 11: session-discipline.md — Merge repetitive rationale

**Files:**
- Modify: `skills/harness-engineering/references/session-discipline.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/session-discipline.md`.

- [ ] **Step 2: Merge "Why This Matters" into one paragraph**

The current "Without session discipline / With session discipline" two-column comparison is 11 lines. Compress to:

```markdown
## Why This Matters

Without session discipline, a fresh session spends 30-50% of time re-discovering state. With it, a new session is productive within 3 minutes — PROGRESS.md is machine-verifiable, DECISIONS.md preserves rationale, and AGENTS.md keeps conventions consistent.
```

- [ ] **Step 3: Clock-in — merge verification step with code-quality reference**

In Step 3 of Clock-In, replace the separate lint/type-check instructions with:

```markdown
### Step 3: Run make check

Confirm the repo is in a consistent state. See [verification.md](verification.md) for the 3-layer pipeline. The same checks that code-quality's [non-negotiable #3](../../code-quality/SKILL.md#five-non-negotiables-language-agnostic) enforces.
```

- [ ] **Step 4: Verify**

Clock-in/out checklists intact. Rationale concise. Cross-refs present.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/session-discipline.md
git commit -m "Tighten session-discipline.md — merge rationale, cross-ref code-quality"
```

---

### Task 12: task-management.md — Trim verbose examples

**Files:**
- Modify: `skills/harness-engineering/references/task-management.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/task-management.md`.

- [ ] **Step 2: Trim WIP=1 session examples**

Keep the WIP=1 rule statement and the enforcement check. Drop the "Session start/middle/end" narrative example (lines 10-24) — the enforcement check says the same thing.

- [ ] **Step 3: Collapse parallel agent checklist to table**

Keep the 5-item decision checklist. Drop the verbose valid/invalid parallel group examples — the checklist is self-explanatory.

- [ ] **Step 4: Verify**

Triple structure feature format intact. State machine intact. WIP=1 rule clear.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/task-management.md
git commit -m "Tighten task-management.md — trim examples, keep decision logic"
```

---

### Task 13: verification.md — Remove duplicate rationale

**Files:**
- Modify: `skills/harness-engineering/references/verification.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/verification.md`.

- [ ] **Step 2: Replace "Why" per layer with cross-ref to code-quality**

The "Why first/second" paragraphs for Layers 1 and 2 duplicate code-quality's non-negotiables. Replace with:

```markdown
### Layer 1: Static Analysis

Lint + type check. Every change. See code-quality [non-negotiable #3](../../code-quality/SKILL.md#five-non-negotiables-language-agnostic) for the standard.

### Layer 2: Runtime Tests

Unit + integration tests. Every change. See code-quality [review-agent.md](../../code-quality/references/review-agent.md) for independent verification.

### Layer 3: System Tests

E2E tests. Cross-component changes only.
```

- [ ] **Step 3: Keep the sequence rule and error message guide**

The "Sequence Is Mandatory" section and "Error Messages That Help" are unique to harness-engineering — keep them.

- [ ] **Step 4: Verify**

3-layer sequence clear. Code-quality cross-refs present. Done definition intact.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/verification.md
git commit -m "Tighten verification.md — cross-ref code-quality, keep 3-layer sequence"
```

---

### Task 14: doc-first.md — Cut full example, link to template

**Files:**
- Modify: `skills/harness-engineering/references/doc-first.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/doc-first.md`.

- [ ] **Step 2: Trim the GRAPH.md example to structural skeleton**

Lines 92-207 (~115 lines) are a full narrative example of an order-creation flow. Trim to show the section structure without the full story. Keep: one Mermaid diagram stub, one entry in each section (one data field detail, one decision point, one error), drop the rest. The agent needs the format pattern, not the full narrative.

After trimming, the GRAPH.md template section should be ~50 lines showing: Mermaid stub → Data Fields stub → Decision Points stub → Data Transformations stub → Error Propagation stub. Each stub has one example entry showing the format.

- [ ] **Step 3: Keep core rules for GRAPH.md**

The rules list (lines 209-221) stays — it's instructional. Fix the duplicate rule numbering (3-4-5 appears twice).

- [ ] **Step 4: Verify**

Core principles intact. Example replaced with link + summary. Rule numbering fixed.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/doc-first.md
git commit -m "Tighten doc-first.md — replace full example with template link"
```

---

### Task 15: workflow.md — Remove session-discipline overlap

**Files:**
- Modify: `skills/harness-engineering/references/workflow.md`

- [ ] **Step 1: Read current file**

Read `skills/harness-engineering/references/workflow.md`.

- [ ] **Step 2: Replace verbose "What to Read/Update" tables with one-line references**

The two tables (lines 22-51, ~30 lines) duplicate session-discipline.md's clock-in sequence and doc-first.md's update list. Replace with:

```markdown
## What to Read Before Implementing

See [session-discipline.md](session-discipline.md) clock-in sequence. Minimum: PROGRESS.md → DECISIONS.md → codebase-map.md → GRAPH.md → business docs → AGENTS.md.

## What to Update After Implementing

See [doc-first.md](doc-first.md) after-implementation checklist. Minimum: GRAPH.md → codebase-map.md → PROGRESS.md → AGENTS.md.
```

- [ ] **Step 3: Add code-quality trigger to workflow step 6**

In the 14-step flow, add the cross-ref marker at step 6:

```markdown
6. **Implement** — write the code. `→ apply code-quality`: load [code-quality](../../code-quality/SKILL.md) and follow all rules (Pydantic, logging, enums, types, no water, SRP, etc.).
```

- [ ] **Step 4: Verify**

14-step flow intact. Cross-refs present. Anti-patterns and diagnostic loop intact.

- [ ] **Step 5: Commit**

```bash
git add skills/harness-engineering/references/workflow.md
git commit -m "Tighten workflow.md — remove session/doc overlap, add code-quality trigger"
```

---

### Task 16: Final cross-ref audit + consistency check

**Files:**
- Read only: all 15 modified files

- [ ] **Step 1: Verify cross-references resolve**

Check every cross-reference link:
- [ ] code-quality SKILL.md → harness-engineering SKILL.md
- [ ] harness-engineering SKILL.md → code-quality SKILL.md
- [ ] verification.md → code-quality SKILL.md
- [ ] session-discipline.md → verification.md → code-quality
- [ ] workflow.md → session-discipline.md, doc-first.md, code-quality
- [ ] review-agent.md → code-quality SKILL.md

- [ ] **Step 2: Verify handoff markers are consistent**

Grep for `→ apply code-quality` and `→ follow harness verification` — confirm they appear at the right handoff points.

- [ ] **Step 3: Verify no duplicate "Why" sections remain**

Scan each file for rationale that also appears in another file. If found, pick the better home and link from the other.

- [ ] **Step 4: Verify no broken relative links**

Check every `[text](path.md)` and `[text](../path.md)` resolves to an existing file.

- [ ] **Step 5: Final read of both SKILL.md files**

Read `skills/code-quality/SKILL.md` and `skills/harness-engineering/SKILL.md` end to end. They should feel like two parts of one system.

- [ ] **Step 6: Commit**

```bash
git add skills/code-quality/ skills/harness-engineering/
git commit -m "Final cross-ref audit — verify all links resolve and handoffs are consistent"
```
