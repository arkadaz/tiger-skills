---
name: harness-engineering-grill
description: Requirements discovery — interview the user relentlessly about a new feature or goal until shared understanding is reached, then write a spec for human review. Use when the user wants to build something new, mentions a feature idea, says "I want to add X", or when a feature in feature_list.json has no user_visible_behavior yet. This skill runs BEFORE the Planner — no planning or code until the spec is approved.
---

# Grill — Requirements Discovery (Phase 0)

Based on Matt Pocock's `grill-with-docs` and `grill-me` patterns, adapted for the walkinglabs harness-engineering model.

> The most expensive bug is building the wrong thing. The cheapest time to catch it is before a single line of code is written. — walkinglabs principle, applied here

## Core Thesis

**The Planner cannot plan what it doesn't understand.** Before any agent decomposes a goal into tasks, the shared understanding between human and machine must be deep enough that the plan writes itself. This skill creates that depth.

## When This Skill Triggers

This skill activates when the user:
- Describes a new feature or capability ("add a login page", "let users export data")
- Mentions a goal without a clear spec ("we need search", "make this faster")
- Starts work on a feature that has no `user_visible_behavior` in `feature_list.json`
- Says "I want to build..." or "can we add..."
- Asks "what would it take to..."

**Anti-triggers** — do NOT grill when:
- The feature already has a complete, approved spec in `feature_list.json`
- The user is reporting a bug (diagnose, don't grill)
- The user asks a factual question about the codebase (explore, don't grill)
- The user gives a precise, unambiguous instruction ("rename getCwd to getCurrentWorkingDirectory in file.ts")

## Position in the Harness

```
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 0: GRILL (NEW) — Requirements Discovery                    │
│   → Interview relentlessly → Write spec → Human approves         │
├──────────────────────────────────────────────────────────────────┤
│ PHASE 1: SESSION START — Clock In                                │
│ PHASE 2: SCOPE — Pick ONE Feature                                │
│ PHASE 3: IMPLEMENT — Planner → Generator → Executor → Healer     │
│ PHASE 4: VERIFY — Evidence Before Claims                         │
│ PHASE 5: REVIEW — Independent Check                              │
│ PHASE 6: TRACK — Update State                                    │
│ PHASE 7: SESSION END — Clock Out                                 │
└──────────────────────────────────────────────────────────────────┘
```

Phase 0 is the gatekeeper. No feature enters the pipeline without passing through the grill.

## The Grill Protocol

### Core Pattern

Interview the user relentlessly about every aspect of the goal until shared understanding is reached. Walk down each branch of the decision tree, resolving dependencies one decision at a time.

**Three non-negotiable rules:**

1. **One question at a time.** Never ask multiple questions in one turn. The user must process and answer each before the next arrives.
2. **Explore the codebase first.** If a question can be answered by reading existing code, docs, or state files — read them instead of asking. Every avoidable question is an interruption the user didn't need.
3. **Provide a recommendation with every question.** Don't just ask — suggest the answer. "I think the search should return paginated results (20 per page). Does that match what you had in mind?" This forces you to think, and it's easier for the user to correct a proposal than to invent from scratch.

### The Five Discovery Dimensions

Work through these dimensions in order. Don't skip ahead — each dimension builds on the previous one.

---

#### Dimension 1: Problem Space

**Goal:** Understand who this is for and what problem it solves.

Questions to explore (pick the most relevant, one at a time):

- Who is the primary user? What role do they have?
- What problem are they experiencing right now?
- What can't they do today that they'll be able to do after this?
- Is this replacing an existing workflow or creating a new one?
- What's the trigger? When does the user reach for this feature?

**Exit gate:** You can state the problem in one sentence: "[User role] needs [capability] so that [outcome]."

**At this gate, present structured choices when there are genuine alternatives:**
- "Is this for end-users or internal admins?"
- "Does this replace the existing X flow, or sit alongside it?"

---

#### Dimension 2: Behavior (Happy Path)

**Goal:** Define exactly what happens when everything goes right.

Questions to explore:
- What does the user do first? What do they see?
- What are the steps from start to finish?
- What's the output? What does success look like?
- What data goes in? What data comes out?
- Are there different paths for different user types?

**Sharpen fuzzy language relentlessly:**
- User says "fast" → "Under 200ms? Under 2 seconds? What's the ceiling?"
- User says "nice UI" → "What's the one thing the user must see on this screen?"
- User says "integrate with X" → "Which specific API? What data flows which way?"

**Exit gate:** You can write the happy path as a numbered sequence of user actions and system responses. Every step is concrete — no fuzzy words.

---

#### Dimension 3: Behavior (Edge Cases & Errors)

**Goal:** Define what happens when things go wrong.

For EVERY happy-path step, ask: "What could go wrong here?"

Standard edge cases to cover:
- **Empty state:** What does the user see when there's no data yet?
- **Loading state:** What shows while data is being fetched/computed?
- **Error state:** What happens when the backend is down? When input is invalid?
- **Boundary state:** What happens at the limit? 0 items, 10,000 items, 1 character, 10,000 characters?
- **Permission state:** What if the user doesn't have access?
- **Concurrency:** What if two users act on the same thing at once?

**For each edge case, present the most reasonable default as a proposal:**
- "When the search returns zero results, I'll show 'No results found' with a suggested action. Sound right?"
- "For the first user with an empty dashboard, I'll show a guided setup wizard instead of a blank page. Does that work?"

**Exit gate:** Every user action has a defined error response. No `TODO: handle errors` anywhere.

---

#### Dimension 4: Constraints & Context

**Goal:** Understand what can't change and what must stay working.

Questions to explore:
- What existing behavior must NOT break?
- Are there performance constraints? (request latency, throughput, data size)
- Are there compliance or regulatory requirements?
- What's the deployment environment? (browser, server, mobile, CLI)
- What dependencies exist? (external APIs, databases, other services)
- What's the data model? Does this touch existing tables/collections?
- What patterns already exist in the codebase that this should follow?

**Cross-reference with code:**
- If the user says "users table" — read the schema. Does that table exist? Does it have the fields they're describing?
- If the user says "like the existing export feature" — read the export code. Does the pattern actually fit?
- If the user says "we already have auth" — read the auth module. What's the exact mechanism?

**Surface contradictions immediately:**
- "You mentioned role-based access, but the current auth system only has admin/non-admin. Should this feature introduce roles, or work within the existing binary split?"

**Exit gate:** All constraints are documented. No contradictions remain between what the user described and what the codebase actually supports.

---

#### Dimension 5: Acceptance Criteria

**Goal:** Define how we'll know it's correct.

For each behavior (happy path + edge cases), define:
- **What specific action proves it works?**
- **What's the expected output?**

Convert fuzzy into concrete:
- "It should work" → "Log in as user X, click 'Export', verify a CSV downloads with columns A, B, C containing the last 30 days of data"
- "It should be fast" → "Search for 'widget' returns results in under 200ms p95 with 10,000 products in the database"

**Exit gate:** Every acceptance criterion is a specific, executable step. Someone who's never seen the feature could run the verification and know if it passed.

---

### When to Use Structured Choices

Use `AskUserQuestion` when:
- There are 2-4 genuinely viable alternatives
- The choice materially changes implementation
- You can't infer the answer from the codebase or from what the user has already said

**Good uses:**
- "Should the search be: (A) Client-side filter for small datasets, (B) Server-side full-text search, or (C) Hybrid — client-side until >100 items then server-side?"
- "For the export format, should we do: (A) CSV only, (B) CSV + JSON, or (C) CSV + JSON + Excel?"
- "Which users get this feature: (A) All users immediately, (B) Admin-only at first with a feature flag, or (C) Beta group selected by admin?"

**Bad uses:**
- "Should we use a database?" (the codebase already answers this — explore)
- "What port should the server run on?" (convention answers this — don't interrupt the user)
- "Do you want error handling?" (the answer is always yes — just propose the pattern)

### The Choich Pattern

Named for what the user called it — "chioch" = choices, a menu of structured options the user can pick from.

When you reach a fork in the decision tree where the path matters, present it as a choich:

```
I see [N] ways to handle [decision]. Here are the trade-offs:

Option A: [label] — [what it means] — [cost/benefit]
Option B: [label] — [what it means] — [cost/benefit]
Option C: [label] — [what it means] — [cost/benefit]

My recommendation: [Option X] because [one-sentence reason].

Which path?
```

The user picks one, and you continue down that branch. Every choich eliminates an entire subtree of questions — the ones that only apply to paths not taken. This is how the grill converges instead of expanding forever.

---

## The Spec Document

### When to Write the Spec

Write the spec when ALL FIVE dimensions reach their exit gates. Do NOT write the spec early — premature writing locks in fuzzy thinking. The spec is the output of the grill, not the input to it.

### Where to Write It

```
specs/<feature-id>.md
```

The `specs/` directory holds approved feature specifications. Each file is one feature.

### Spec Template

```markdown
# Spec: <Feature Title>

**Feature ID:** <kebab-case-id>
**Status:** `awaiting_review`
**Grilled on:** YYYY-MM-DD
**Approved by:** [name] on [date] — or — `pending`

## Problem Statement

[One sentence: who needs what and why.]

## User Stories

- As a [role], I want to [action] so that [outcome].
- As a [role], I want to [action] so that [outcome].

## Behavior

### Happy Path

1. [User action] → [System response]
2. [User action] → [System response]
3. [User action] → [System response] → **Success: [outcome]**

### Error Cases

| Trigger | Response |
|----------|----------|
| [Error condition] | [What the user sees] |
| [Error condition] | [What the user sees] |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty state (first use) | [What happens] |
| Boundary (max/min) | [What happens] |
| Permission denied | [What happens] |

## Constraints

- **Must not break:** [Existing behavior that must stay intact]
- **Performance:** [Latency/throughput requirements]
- **Environment:** [Where this runs]
- **Dependencies:** [What this depends on]
- **Patterns to follow:** [Existing codebase patterns this should match]

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| [Topic] | A/B/C | [Choice] | [One-line reason] |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | [Behavior] | [Specific action → expected output] |
| 2 | [Behavior] | [Specific action → expected output] |
| 3 | [Error case] | [Specific action → expected output] |

## Out of Scope (Explicitly)

- [Thing we decided NOT to build in this feature]
- [Thing deferred to a later feature]

## Open Questions

- [Any question still unresolved — must be empty or have a resolution plan before approval]
```

### After Writing the Spec

1. **Present the spec** to the user with a clear summary:
   ```
   I've written the spec based on our conversation. Here's the summary:

   Feature: [title]
   Problem: [one sentence]
   Happy path: [3-5 word summary]
   Edge cases covered: [count]
   Key decisions: [count] made

   The full spec is at specs/<feature-id>.md.

   Please review. Once approved, I'll add this to feature_list.json and we can proceed to planning.
   ```

2. **Wait for approval.** Do NOT proceed to planning. Do NOT add it to `feature_list.json`. The spec is in `awaiting_review` state. Only the human can move it to `approved`.

3. **On approval:** Update the spec status to `approved`, add the feature entry to `feature_list.json` with the spec as `user_visible_behavior`, and proceed to Phase 1 (Session Start).

4. **On rejection/changes:** Return to the relevant dimension and continue grilling. Update the spec. Re-present.

---

## Integration with feature_list.json

When the spec is approved, create a feature entry using the full kanban schema:

```json
{
  "id": "<feature-id>",
  "priority": <next-available>,
  "area": "<domain>",
  "title": "<Feature Title>",
  "user_visible_behavior": "<Happy path + error cases from spec>",
  "spec_file": "specs/<feature-id>.md",
  "status": "not_started",
  "depends_on": ["<features that must be passing first>"],
  "blocks": ["<features this one unblocks>"],
  "acceptance_criteria": [
    {"id": "AC1", "text": "<Acceptance criterion from spec>", "done": false}
  ],
  "tasks": [],
  "verification": [
    "<Acceptance criteria from spec, converted to verification steps>"
  ],
  "evidence": [],
  "notes": "Spec approved by [name] on [date]. See specs/<feature-id>.md for full details."
}
```

- The `spec_file` field links back to the full spec. The `user_visible_behavior` is a condensed version — the full detail lives in the spec file.
- Turn each acceptance criterion from the spec into one `acceptance_criteria` entry (`done: false`).
- Set `depends_on`/`blocks` from the spec's Constraints ("must not break", "depends on") — reciprocal and acyclic.
- Leave `tasks[]` **empty** — it stays empty until the planner runs and the conductor persists the blueprint into it. The grill produces the ticket; the planner fills its checklist.

## Grill Completion Checklist

Before ending the grill and writing the spec, confirm:

```
Grill Exit Checklist:
- [ ] Problem can be stated in one sentence
- [ ] Happy path is a concrete numbered sequence
- [ ] Every user action has a defined error response
- [ ] All constraints are documented, no contradictions with codebase
- [ ] Every acceptance criterion is executable
- [ ] All fuzzy language has been sharpened (no "fast", "nice", "works with")
- [ ] Key decisions have been presented as choices and resolved
- [ ] Spec document written to specs/<feature-id>.md
- [ ] Spec presented to user with explicit request for review
```

## Anti-Patterns

- **Jumping to implementation:** "I know enough, let me start coding" — the grill isn't done until all five dimensions pass.
- **Skipping error cases:** Only defining the happy path and saying "we'll handle errors later." Error handling IS the feature for many users.
- **Accepting fuzzy answers:** User says "make it fast" and you write "The system shall be fast." Ask: "How fast? What's the ceiling?"
- **Not exploring the codebase:** Asking the user questions that the code already answers. Read the files first.
- **Batch questions:** "Here are 5 things I need to know..." One. At. A. Time.
- **Writing the spec too early:** Before you've finished grilling. The spec crystallizes decisions — it doesn't discover them.
- **Proceeding without approval:** Marking the feature `in_progress` before the human says "approved." The grill gate is mechanical, not advisory.

## Hard Constraints

1. **One question at a time** — never multi-question turns
2. **Explore before ask** — read the codebase before asking the user
3. **Recommend with every question** — don't ask open-ended, propose
4. **All five dimensions must pass** — skip one and the spec is incomplete
5. **Spec requires human approval** — the agent cannot self-approve
6. **No implementation until approved** — the grill gate is absolute

---

## Reference

- [Matt Pocock's grill-with-docs](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) — challenger against domain model
- [Matt Pocock's grill-me](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) — relentless interview pattern
- [walkinglabs Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — the 5-subsystem model this plugs into
