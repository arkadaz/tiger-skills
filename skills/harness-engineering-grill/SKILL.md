---
name: harness-engineering-grill
description: Requirements discovery — interview the user relentlessly about a new feature or whole backlog until shared understanding is reached, then produce the FIVE feature artifacts (specs.md, adr.md, e2e_testcases.md, business.html, feature_list.json entry with files[]+depends_on) for human approval. Use when the user wants to build something new, mentions a feature idea, says "I want to add X", or when a feature in feature_list.json has no user_visible_behavior yet. Runs BEFORE the build pipeline — no code until the spec is approved. This skill is rigid — its rules must be followed, not negotiated.
---

# Grill — Requirements Discovery (Phase 0)

Based on Matt Pocock's `grill-me` / `grill-with-docs` patterns, adapted for the walkinglabs harness-engineering model and this plugin's parallel-build pipeline.

> The most expensive bug is building the wrong thing. The cheapest time to catch it is before a single line of code is written. — walkinglabs principle, applied here

## Core Thesis

**The architect cannot plan what it doesn't understand, and the generator cannot build a fuzzy spec.** The grill is the keystone of speed, not a tax on it: when the spec, the decisions, and the test cases are sharp *before* code, the build hits a fixed target and the expensive fix/review loops mostly stop firing. A great grill is what makes the rest of the pipeline fast.

## What this grill produces (FIVE artifacts per feature)

The grill is the **only** phase a human drives. Per feature it emits five linked artifacts — each authored through its own doc-skill (the format authority), so the form is consistent and this file stays about the *interview*, not the templates:

| Artifact | Format | Doc-skill (format authority) | What it captures |
|---|---|---|---|
| `specs.md` | `.md` | `tiger-skills:doc-spec` | problem, behavior, constraints, acceptance criteria, scope/deps |
| `adr.md` | `.md` | `tiger-skills:doc-adr` | each hard-to-reverse decision (Nygard), logged as it crystallizes |
| `e2e_testcases.md` | `.md` | `tiger-skills:doc-e2e-cases` | each acceptance criterion as a Given/When/Then case (tests-first) |
| `business.html` | `.html` | `tiger-skills:doc-business` | the human-facing case: who/why/value (for the stakeholder, not agents) |
| `feature_list.json` entry | `.json` | (this skill, on approval) | the kanban ticket **+ `files[]` footprint + `depends_on`** |

`.md` artifacts are **agent-facing** (read on every pipeline run — keep them lean). `business.html` is **human-facing** (agents never read it; they use `specs.md`). When you reach a doc-writing step, **invoke its doc-skill** for the canonical structure + readability gate.

## Batch-grill the backlog (the rhythm that makes parallelism pay)

When the user brings more than one feature (or an epic), **grill the whole backlog up front, in one planning pass, before any build starts.** The build runs WIP=N — independent features build in parallel, unattended — so it needs every feature already specced, with **`depends_on` + a rough `files[]` footprint**, so the scheduler can wave them. Output of a batch grill: a fully-specced, dependency-linked, file-declared backlog ready to build.

- Grill features in priority order; for each, run the dimensions → produce the five artifacts → get approval.
- Capture `depends_on` (which features must be `passing` first) and `files[]` (the rough file footprint) for **every** feature — these two fields are what let the scheduler run features concurrently without collisions. When unsure whether a file is touched, **list it** (over-listing only serializes; under-listing risks a collision).

A single-feature request just runs this once.

## When This Skill Triggers

Activate when the user:
- Describes a new feature or capability ("add a login page", "let users export data")
- Mentions a goal without a clear spec ("we need search", "make this faster")
- Brings a backlog / epic of several features to build
- Starts work on a feature that has no `user_visible_behavior` in `feature_list.json`
- Says "I want to build…", "can we add…", or "what would it take to…"

**Anti-triggers** — do NOT grill when:
- The feature already has a **human-approved** spec — one the user explicitly said "yes" to in an earlier turn. A spec file marked `Status: approved` that you or bootstrap wrote this session is NOT approved; it's a draft, and you still grill.
- The user is reporting a bug (diagnose, don't grill).
- The user asks a factual question about the codebase (explore, don't grill).
- The user gives a precise, unambiguous instruction ("rename getCwd to getCurrentWorkingDirectory in file.ts").

**Starting from a pasted or pre-written spec (common — don't let it skip you):** a pasted spec is a strong _draft_ and your starting point, not an approved one. Read it, confirm the parts that are clear (don't re-ask what the draft answers), drive its **own open questions to closure**, and finish with an explicit human "yes" before you set `Status: approved`. A complete-looking paste makes grill _fast_, not skippable.

## The Grill Protocol

### Three non-negotiable rules

1. **One question at a time.** Never ask multiple questions in one turn. The user must process and answer each before the next arrives.
2. **Explore the codebase first.** If a question can be answered by reading code, docs, `CODEBASE_MAP.md`, or state files — read them instead of asking. Every avoidable question is an interruption the user didn't need.
3. **Provide a recommendation with every question.** Don't just ask — propose the answer. "I think search should return paginated results (20/page). Match what you had in mind?" It's easier to correct a proposal than invent from scratch.

### grill-with-docs moves (graft from Pocock)

- **Sharpen terminology against the domain.** When a term is fuzzy or collides with an existing one, surface it: "Your code cancels whole Orders, but you said partial cancellation — which is right?" Propose the precise canonical term and use it from then on.
- **Capture decisions to `adr.md` the moment they crystallize** — don't batch them at the end. The instant a hard-to-reverse choice is made, append the ADR (via `doc-adr`).
- **ADR only when it earns it** — a decision goes in `adr.md` only if it is **hard to reverse ∧ surprising without context ∧ the result of a trade-off**. If any is missing, record it as a one-line row in the spec's Key Decisions table instead.
- **Write files lazily** — create an artifact only when you have something real to write in it.

### The Discovery Dimensions

Work through these in order — each builds on the previous. Don't skip ahead. (Pick the most relevant questions per dimension; one at a time.)

#### Dimension 1 — Problem Space
Who is this for and what problem does it solve? Primary user/role · the problem today · what they can't do yet · replace or add to an existing flow · the trigger that makes them reach for it.
**Exit:** you can state it in one sentence — "[role] needs [capability] so that [outcome]."

#### Dimension 2 — Behavior (Happy Path)
Exactly what happens when everything goes right. First action / first thing seen · the steps start to finish · the output / what success looks like · data in, data out · different paths for different user types.
**Sharpen fuzzy language relentlessly:** "fast" → "under 200ms? under 2s? the ceiling?"; "nice UI" → "the one thing the user must see?"; "integrate with X" → "which API, which data, which direction?".
**Exit:** the happy path is a numbered sequence of user actions and system responses, every step concrete.

#### Dimension 3 — Behavior (Edge Cases & Errors)
For EVERY happy-path step: "what could go wrong here?" Cover empty/first-use, loading, error (backend down, invalid input), boundary (0, max, 1 char, 10k chars), permission denied, concurrency (two users at once). Propose the most reasonable default for each.
**Exit:** every user action has a defined error response. No `TODO: handle errors`.

#### Dimension 4 — Data Model & Schema  *(deeper grilling)*
What data does this touch or create? New tables/collections/fields vs existing · types and constraints · relationships and ownership · migrations · what reads vs writes it. **Cross-reference the code:** if they say "users table", read the schema — does it exist, with those fields?
**Exit:** the data shape is explicit; any new/changed schema is named, with its migration path.

#### Dimension 5 — Constraints & Context
What can't change and what must keep working. Existing behavior that must NOT break · deployment environment (browser/server/mobile/CLI) · dependencies (APIs, DBs, services) · patterns the codebase already uses that this should follow. **Surface contradictions immediately** ("you said role-based access, but auth is only admin/non-admin — introduce roles, or work within the binary split?").
**Exit:** all constraints documented, no contradictions with what the codebase actually supports.

#### Dimension 6 — Non-Functional Requirements  *(deeper grilling)*
The "-ilities", made concrete. Performance (latency/throughput, with numbers) · scale (data volume, concurrent users) · security/privacy (authn/authz, sensitive data, compliance) · reliability (failure modes, retries, idempotency). Each as a number or a rule, never "fast"/"secure".
**Exit:** every NFR is a measurable target or an explicit rule.

#### Dimension 7 — Rollout & Flags  *(deeper grilling)*
How it reaches users. Feature flag or ship to everyone · beta group vs all · gradual ramp vs big bang · how it's turned off if it misbehaves · backward compatibility during rollout.
**Exit:** the rollout path and the kill-switch are defined (or explicitly "ship to all, no flag").

#### Dimension 8 — Observability  *(deeper grilling)*
How you'll know it works in production. What to log · which metrics/events to emit · what "healthy" looks like on a dashboard · what alerts on failure.
**Exit:** the signals that prove the feature is alive and healthy are named (or explicitly "none for v1").

#### Dimension 9 — Acceptance Criteria → tests-first
For each behavior (happy + edge + error), define the specific action that proves it works and the expected output. Convert fuzzy to concrete ("it works" → "log in as user X, click Export, verify a CSV downloads with columns A,B,C of the last 30 days"). **As each AC is agreed, write it straight into `e2e_testcases.md` as a Given/When/Then case** (via `doc-e2e-cases`) — tests-first, so the build aims at a fixed target.
**Exit:** every AC is a specific, executable step, and each has a matching case in `e2e_testcases.md`.

#### Dimension 10 — Scope & Dependencies  *(powers parallel build)*
What's explicitly out · which **features must be `passing` first** (`depends_on`) · the **rough file footprint** this feature will create/edit (`files[]`). These two fields go into `feature_list.json` and decide whether this feature can run in the same wave as another.
**Exit:** `depends_on` and a `files[]` footprint are captured; out-of-scope is listed.

### The Choich Pattern

When you reach a fork where the path matters, present a menu (named "choich" for what the user called it):

```
I see [N] ways to handle [decision]:

Option A: [label] — [what it means] — [cost/benefit]
Option B: [label] — [what it means] — [cost/benefit]
Option C: [label] — [what it means] — [cost/benefit]

My recommendation: [Option X] because [one-sentence reason].
Which path?
```

Each choich eliminates an entire subtree of questions — the ones that only apply to paths not taken — so the grill converges instead of expanding forever. **If the chosen option is hard-to-reverse ∧ surprising ∧ a trade-off, log it to `adr.md` right there** (via `doc-adr`).

Use structured `AskUserQuestion` choices when there are 2–4 genuinely viable alternatives that materially change implementation and can't be inferred from the codebase. Don't use them for things the codebase already answers ("should we use a database?") or conventions ("what port?").

## Writing the artifacts

Write them only when the relevant dimensions have closed — premature writing locks in fuzzy thinking. Then, for each, **invoke its doc-skill** (the single source of truth for structure + the readability gate):

1. `specs.md` → `tiger-skills:doc-spec` — the full feature contract. Its **Scope & Dependencies** section mirrors `files[]`/`depends_on`. Each Key Decision links to its ADR; each AC links to its e2e case.
2. `adr.md` → `tiger-skills:doc-adr` — already being appended as decisions crystallized; confirm it's complete.
3. `e2e_testcases.md` → `tiger-skills:doc-e2e-cases` — already seeded during Dimension 9; confirm one case per AC.
4. `business.html` → `tiger-skills:doc-business` — the stakeholder case, in business language, no code.

Files live at `specs/<feature-id>.md`, `specs/<feature-id>.adr.md`, `specs/<feature-id>.e2e.md` (or a per-feature folder), and `business.html` where the project keeps human docs.

## The Adversarial Gap Pass (before you ask for approval)

Before presenting anything, **attack your own spec** — assume it's incomplete and prove it:

```
Gap pass:
- [ ] Any Open Question in specs.md still unresolved?
- [ ] Any contradiction between the spec and what the codebase actually supports?
- [ ] Any happy-path step with no defined error/edge response?
- [ ] Any fuzzy word left ("fast", "nice", "secure", "works with")?
- [ ] Any acceptance criterion without a Given/When/Then case in e2e_testcases.md?
- [ ] Any hard-to-reverse decision not recorded in adr.md?
- [ ] data model / NFRs / rollout / observability — each closed or explicitly "n/a for v1"?
- [ ] files[] footprint and depends_on captured?
```

Every box that isn't ticked is a question you take **back to the user**, one at a time, before approval. The gap pass is mechanical — you don't present a spec with open gaps.

## Approval (the self-approval ban is absolute)

1. **Present** each feature's artifacts with a short summary (problem in one sentence · happy-path summary · #edge cases · #decisions · #e2e cases · files[]/depends_on). Point to the files.
2. **Wait for an explicit human "yes."** Do NOT proceed to planning. Do NOT add it to `feature_list.json`. Do NOT write `Status: approved` yourself — only a human's "yes" in the conversation authorizes it.
3. **On approval:** set the spec's `Status: approved`, add the feature to `feature_list.json` (schema below), and (in a batch grill) move to the next feature.
4. **On changes:** return to the relevant dimension, re-grill, update the artifacts, re-present.

## feature_list.json integration (note the `files[]` field)

On approval, add the feature with the full kanban schema **plus a feature-level `files[]` footprint** (new — the scheduler reads it):

```json
{
  "id": "<feature-id>",
  "priority": <next-available>,
  "area": "<domain>",
  "title": "<Feature Title>",
  "user_visible_behavior": "<condensed happy path + error cases; full detail in specs.md>",
  "spec_file": "specs/<feature-id>.md",
  "adr_file": "specs/<feature-id>.adr.md",
  "e2e_cases_file": "specs/<feature-id>.e2e.md",
  "business_file": "business.html",
  "status": "not_started",
  "files": ["<rough file footprint — every file this feature will create/edit>"],
  "depends_on": ["<features that must be passing first>"],
  "blocks": ["<features this one unblocks>"],
  "acceptance_criteria": [
    {"id": "AC1", "text": "<criterion from spec>", "done": false}
  ],
  "tasks": [],
  "verification": ["<acceptance criteria turned into verification steps>"],
  "evidence": [],
  "notes": "Spec approved by [name] on [date]. See specs/<feature-id>.md."
}
```

- **`files[]` (a hint):** the rough footprint from Dimension 10. The architect refines it into per-task `files`. Over-list when unsure.
- `depends_on`/`blocks` from Dimension 10 — reciprocal and acyclic.
- One `acceptance_criteria` entry per AC; `tasks[]` stays **empty** until the architect runs.

## Grill Completion Checklist

```
Grill Exit Checklist (per feature):
- [ ] Problem stated in one sentence
- [ ] Happy path is a concrete numbered sequence
- [ ] Every user action has a defined error/edge response
- [ ] Data model, NFRs, rollout, observability each closed or explicitly n/a
- [ ] Every acceptance criterion is executable AND has a Given/When/Then case in e2e_testcases.md
- [ ] All fuzzy language sharpened (no "fast"/"nice"/"secure")
- [ ] Hard-to-reverse decisions recorded in adr.md (via doc-adr)
- [ ] files[] footprint + depends_on captured
- [ ] All five artifacts written via their doc-skills, each passing its readability gate
- [ ] Adversarial gap pass run — no open gaps
- [ ] Artifacts presented; explicit HUMAN approval received before Status: approved
```

## Anti-Patterns

- **Jumping to implementation** — "I know enough, let me code." The grill isn't done until every dimension closes and the gap pass is clean.
- **Skipping the new dimensions** — data model / NFRs / rollout / observability are where the expensive surprises hide.
- **Skipping error cases** — error handling IS the feature for many users.
- **Accepting fuzzy answers** — "make it fast" → "how fast? the ceiling?".
- **Batch questions** — one at a time.
- **Writing artifacts too early** — they crystallize decisions; they don't discover them.
- **Proceeding without approval** — marking a feature `in_progress` before the human says "yes." The grill gate is mechanical.
- **Grilling one feature at a time when the user brought a backlog** — batch-grill so the parallel build can actually parallelize.

## Hard Constraints

1. **One question at a time** — never multi-question turns.
2. **Explore before ask** — read the codebase/map before asking the user.
3. **Recommend with every question** — propose, don't interrogate.
4. **All dimensions must close** — or be explicitly marked n/a.
5. **Five artifacts, via their doc-skills** — specs.md, adr.md, e2e_testcases.md, business.html, feature_list.json entry; each doc through its format authority.
6. **Tests-first** — every acceptance criterion becomes a Given/When/Then case before code.
7. **Adversarial gap pass before approval** — no open gaps presented.
8. **Human approval required** — the agent cannot self-approve; you never write `Status: approved` yourself.
9. **Capture files[] + depends_on** — the parallel scheduler depends on them.

---

## Reference

- [Matt Pocock's grill-with-docs](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) — challenge the plan against the domain model, update docs inline
- [Matt Pocock's grill-me](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) — the relentless interview pattern
- [walkinglabs Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — the 5-subsystem model this plugs into
- Doc-skills (format authorities): `tiger-skills:doc-spec`, `tiger-skills:doc-adr`, `tiger-skills:doc-e2e-cases`, `tiger-skills:doc-business`
