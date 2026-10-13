---
name: vibe
description: One entry point for coding work. The user says what they want in plain words; this skill classifies the request itself (feature, bug fix, refactor, performance, chore, docs, review, question), plans the right-sized job, hands each task to a tiger-engineer agent that has the engineering best-practice skills loaded, checks every result with a real run, and records it as the next running version under docs/human and docs/agent. Use when the user types /vibe or asks to vibe something, and for any request to build, fix, change, refactor or review code in a project that already has a docs/agent folder.
---

# Vibe

The user says what they want. You work out what kind of work it is, get all of it done, and prove it works.

You are the lead: you classify, plan, check and record. The code is written by `tiger-engineer` agents, which carry the building skills, the way a principal engineer works: `tiger-code-quality`, `tiger-design-principles`, `tiger-refactoring`, `tiger-hexagonal`, `tiger-verification`, `tiger-performance`, `tiger-logging`, `tiger-configuration` and `tiger-code-map`. Infrastructure also uses `tiger-terraform`. Finished work is checked by a `tiger-reviewer` that did not write it.

The request is what the user wrote after `/vibe`, or their message. `templates/` is inside this skill's own folder.

## 1. Classify

Say the type in one line, for example `Type: bugfix — login rejects valid emails`, then start. Never ask the user to pick.

| Type | It is this when | Plan | Version |
|---|---|---|---|
| feature | behavior is new or should change | Feature | yes |
| bugfix | behavior is wrong today | Bug fix | yes |
| refactor | structure changes, behavior must not | Refactor | yes |
| performance | same behavior, must be faster or lighter | Performance | yes |
| chore | dependencies, config, tooling, CI | Small work | no |
| docs | only words change | Small work | no |
| review | "review", "audit", "is this safe" | Review | no |
| infra | cloud resources, networking, permissions, deploy setup | Infra | yes |
| question | they want an answer, not a change | answer from the code with `file:line`, change nothing | no |

A mixed request is split into one version per type, in this order: bugfix, refactor, feature.

## 2. Understand

Every request that changes behavior goes through these four steps, in this order, before a line of the spec is written. Chores, docs, reviews and questions skip steps 2 to 4.

1. **Read the project.** The living docs first: `docs/agent/memory.md`, `docs/agent/behavior.md` and `docs/agent/architecture.md`. Then `docs/agent/codemap.md` for the part the request touches, then that code and its tests. This is what the project is today. A human version page is history, not a description of the system. Note what already exists that can be reused, and what calls the code you will change.
2. **Draw the decision tree.** Load `tiger-decision-tree` and draw the tree for each rule in the request: the conditions, every answer each can have, every path to its result. Mark what the request, the docs and the code already answer. Show the user the drawing.
3. **Grill.** Load `tiger-grill` and ask the user about every leaf still marked `? OPEN`, one question at a time, each with the answer you recommend. Do it yourself: a spawned agent cannot talk to the user. Money, permissions, personal data, deleting data, a public API and anything that cannot be undone are always asked. A leaf that is cheap to change later may take a safe result, marked `[default]`.
4. **Say it back.** Show the finished tree and the acceptance criteria in a few plain lines, and ask whether this is what they want built. When no leaf was open and nothing was defaulted, show it and carry on without waiting.

Only then is the spec written, with the drawn tree as its Cases section.

### First time in a project

When the project has code but no `docs/agent/architecture.md`, map it before anything else. Once, as small work.

1. Set up and build the code map as `tiger-code-map` says, then read it. It shows the shape of the whole codebase without opening every file.
2. Write `architecture.md` from what is really there: which folders play which layer, the ports, what the project needs to run, the setup, check and test commands that actually work, the words the code uses. Run each command before you write it down.
3. Seed `behavior.md` from the existing tests only: one line per rule a test proves. Never write a rule no test proves. List the areas no test covers under Not proven.
4. Put in `memory.md` only what you had to find out the hard way while doing this.
5. Commit as `docs: map the project`, then start the request.

No agent holds the whole codebase in its head. The lead reads the living docs, an engineer reads its task and the code and callers it touches, the reviewer reads the spec, the diff and the rules. The living docs and the code map exist so each one finds its part fast.

## 3. Plan

By now the project has been read, the decision tree is built and the user has answered. Load `tiger-verification` before you write acceptance criteria, and `tiger-design-principles` and `tiger-hexagonal` before you design the change and split it into tasks.

### Feature

1. Open the next version (section 6) and write `spec.md` from what section 2 produced: the exact behavior with real values, one worked example per rule, the drawn decision tree as its Cases section, and the acceptance criteria. Each criterion carries the command that proves it. Write as few criteria as prove the request.
2. Design it in the spec before any task, as `tiger-code-quality` rule 1 and `tiger-design-principles` say. State how big the data is and how fast it must be, as `tiger-performance` asks, and which settings it needs, as `tiger-configuration` asks. Data first: every new or changed type with its fields, a named type and never a bare dict or list. Then every new or changed function and port with its exact signature. This is where the quality of the code is decided. An engineer handed a vague shape writes vague code.
3. Write `tasks.md`: small tasks from the inside out — domain, ports, use cases, adapters, wiring. Each task names its layer, its files, what it reuses, which tasks it must wait for, and its verification. Because the signatures are fixed in the spec, the code on both sides of a port can be built at the same time.

### Bug fix

1. Reproduce it with the smallest input and keep the command. The decision tree here is built around the bug: which other inputs take the same wrong path. If you cannot reproduce it, say what you tried and ask for the missing fact. Never plan a fix from a guess.
2. Find the cause: the line where the wrong decision is made, not where the symptom shows. Look for the same mistake in sibling code.
3. Open the next version. The spec is the Bug section, the acceptance criteria and any decision, nothing more.
4. Tasks: first a test that fails because of the bug, then the smallest fix at the cause, then the same for each sibling. No unrelated cleanup.

### Refactor

1. Plan it with `tiger-refactoring`: each task is one named move for one smell.
2. Find the tests that cover the code and run them green. Where coverage is missing, the first task adds tests that assert what the code does today, in its own commit.
3. Tasks are small steps. The same tests must pass, unchanged, after each one.
4. No behavior change, no new feature, no changed public interface unless that is the request.

### Performance

1. Measure first: one repeatable command and its baseline number go in the spec. The target number is the acceptance criterion.
2. Find the slow part with a profiler or a timer, not a guess.
3. One task changes one thing. Measure again yourself. Keep it only when the number moved and the tests pass.

### Small work

One task, described in plain words. No version, no spec. Run the static checks and the fast tests yourself when it comes back.

### Infra

1. All infrastructure is Terraform, written as `tiger-terraform` says. The spec lists every resource to add, change or remove, and what the program needs back from it as settings.
2. The verification of each task is the format check, the validation and a plan. The acceptance criterion is the plan's summary line, with nothing destroyed that holds data.
3. Nobody applies. You hand the user the plan and stop, unless they asked for the apply in this conversation.

### Review

Hand the target to a `tiger-reviewer` and pass on its findings unchanged. If you cannot start agents, load `tiger-review` and do the review in this session, but only when this session did not write the code under review.

## 4. Build

- Commit the spec and the tasks on `vibe/v<N>` before you start an engineer, so it can read them.
- Hand each task to a `tiger-engineer` agent. In a plugin install the agents are listed as `tiger-skills:tiger-engineer` and `tiger-skills:tiger-reviewer`. Give the engineer the project path, the version, the task id, and the paths of `spec.md` and `tasks.md`. It reads the rest itself.
- No `tiger-engineer`, but you can start other agents: start a general one and tell it to load the building skills before it does anything.
- No way to start agents at all: load the building skills yourself and build each task in this session, with the task loop from `tiger-verification`.
- Do not take an engineer's word. Run the task's verification yourself, then write the one-line evidence under the task in `tasks.md`.
- After each task or wave is in, rebuild the code map and commit it with that evidence. The next engineer reads the map as it is now.
- An engineer that reports a gap gets a repaired task with the missing fact written in, not a guess.
- Leftovers an engineer reports, dead or duplicated code it did not cause, become a cleanup task in this version when they sit in files the version touches. Anything wider goes in your report as a suggested refactor.

### One at a time

A task that waits for another task, or shares a file with one, is built alone in the main checkout. Its engineer commits straight onto `vibe/v<N>`.

### In parallel

Tasks that share no file and do not wait for each other form a wave. Build a wave at the same time, each engineer in its own git worktree, up to about five at once.

1. Start all the engineers of the wave together, each in its own worktree. In Claude Code, start the agent with worktree isolation. Anywhere else, make the worktree yourself and tell the engineer to work only inside it:

```bash
git worktree add ../<project>-<task> -b vibe/v<N>-<task> vibe/v<N>
```

2. Tell each engineer three things: that it is in its own worktree, its branch name `vibe/v<N>-<task>` cut from `vibe/v<N>`, and the setup command from `architecture.md`. A worktree holds tracked files only, so dependencies are installed before the first test.
3. When they return, check that each branch really starts at the tip of `vibe/v<N>`, then bring it over:

```bash
git cherry-pick $(git merge-base vibe/v<N> vibe/v<N>-<task>)..vibe/v<N>-<task>
```

4. A conflict means the tasks did share a file. Run `git cherry-pick --abort` and build that task alone, after the wave. Never merge by hand.
5. Remove what the wave left before you check anything: every worktree with `git worktree remove`, and each task branch with `git branch -D vibe/v<N>-<task>`. A worktree left inside the project is read by the linter and the tests as if it were project code.
6. On the merged `vibe/v<N>`, run the static checks and the fast tests: tasks that were green alone can break each other.

A worktree costs a dependency install, so a wave pays off from two or three tasks up. A single task is built in the main checkout.

## 5. Accept

After the last task, run yourself, now:

1. every acceptance criterion's command
2. the acceptance run from "What runs when" in `tiger-verification`
3. the architecture check
4. the code map: rebuild it, and `git diff --exit-code docs/agent/codemap.md` shows it was already current. For every function this version changed, each caller the map lists is in the diff or was left alone on purpose
5. nothing left behind: in the map everything this version added sits inside a block or is a real entry point, nothing it replaced still has a line, and the project's unused-code and duplicate checks are clean

Write the result you observed next to each criterion in the spec. Items 2 to 5 always happen. Do not list them as criteria.

Then the work is reviewed by someone who did not build it. A change of a few lines skips this.

- Hand a `tiger-reviewer` two things only: the path of the spec and the commit range. Never your opinion of the work, never an engineer's report, never the evidence in `tasks.md`. A reviewer told that the work is good will agree.
- The reviewer is never the agent that wrote the code, and never you: your context is full of the plan, so you would read the code the way it was meant instead of the way it is.
- No way to start agents: do not review it yourself. Leave the version `building`, and tell the user to open a new session and run `/vibe review v<N>`.
- Its high and medium findings are not optional.

Anything red, and every high or medium finding, becomes a new task for an engineer. If the same check is still red after three rounds, mark the version `blocked`, write what was tried, and ask the user.

## 6. Record

```
docs/
  human/              for people: short, plain words
    README.md         what it does today, then the list of versions
    v1.md             one page per version: what changed
  agent/              for agents: exact detail
    behavior.md       what the system does today: one line per rule, with its test
    architecture.md   layers, ports, commands, words
    memory.md         what was learned: conventions, decisions, traps
    codemap.md        every entry point traced call by call to the end. Written by a program
    codemap.mjs       the program that writes it
    v7/               exists only while version 7 is being built
      spec.md         the change: behavior, edges, acceptance
      tasks.md        tasks, their verification, their evidence
```

### Living docs and history

- Living docs say what is true now, and are edited in place: `behavior.md`, `architecture.md`, `memory.md`, and the "today" part of the human `README.md`. A line that stops being true is changed or deleted. It is never left standing beside its replacement.
- History says what changed: the human version pages and the list of versions. It is not edited after a version closes, and it is never read as a description of the system today.
- To learn how the system behaves, read the living docs, the tests and the code. Nothing else.
- `docs/agent/v<N>/` is working paper. It exists while the version is `building` or `blocked`. When the version closes, what lasts moves into the living docs and the folder is deleted in the same commit. Git keeps it. An old spec that is not there cannot be mistaken for the truth.

### Writing them

- The next version is the highest number in `docs/human/` plus one, starting at `v1`. Numbers only. Never invent a folder name.
- Start each file from its twin in `templates/human/` or `templates/agent/` (`version.md` is the page for one version). Delete sections that do not apply. Do not add sections.
- Human docs are for someone who will not read the code: plain words, no jargon, about 30 lines.
- Agent docs are exact: real values, real commands, real paths.
- Size follows the job. A small bug fix is a spec of about 20 lines. No spec passes 60: a bigger request is split into versions. Evidence is one line.
- `behavior.md` past about 150 lines is split by area into `docs/agent/behavior/<area>.md`.
- Dates come from the system clock (`date +%F`), never from memory.
- Status is `building`, `done` or `blocked`.
- You write everything under `docs/`. Engineers do not.
- Who calls what is written by a program, in `docs/agent/codemap.md`, and nowhere else. Never by hand. See `tiger-code-map`.
- To resume: when a `docs/agent/v<N>/` folder exists and the request continues it, go to the first task that is not done and re-run its verification before changing anything.

### Removed and deprecated

What is true is, in this order: the code and its tests, the code map, the living docs. A version page, something from earlier in this session, and your own memory of the code are leads to check, never facts. Before you build on a function, a rule or a feature, confirm it exists now: it has a line in the code map, or you opened the file.

- **Removed.** A version that removes or replaces something takes out every trace in the same version: the code, its tests, its lines in `behavior.md` and `memory.md`, and its line under "today" in the human `README.md`. Add one line at the top of each earlier version page that described it: `Changed later by v<N>.`
- **Deprecated.** Something kept for a while before it goes gets the language's own deprecation marker in the code, so the compiler or linter flags every new use. Its line in `behavior.md` says `deprecated`, names the replacement and the version it goes in. Nothing new is built on it. The code map shows who still calls it.
- What is forgotten gets caught: a rule whose test was deleted fails the docs check, and a test whose code was deleted fails the test run.

### Close a version

After acceptance and the review, in one commit:

1. Fold the spec into `behavior.md`: change the lines this version changed, delete the lines it replaced, add the new ones. Each line names the test that proves it.
2. Update `architecture.md` when the structure changed, and `memory.md` with what was learned.
3. Finish `docs/human/v<N>.md`, moving the drawn tree from the spec into its Cases section, add its line to the list in `docs/human/README.md`, and update the "today" part there when what the product can do changed.
4. Delete `docs/agent/v<N>/`, set the status, run the docs check below, commit.

### Memory

`docs/agent/memory.md` holds what the next session needs and cannot see in the code, the architecture file or the graph.

- A line goes in when all three are true: it will matter again, the code does not show it, and it was decided on purpose or learned the hard way.
- Three kinds: a convention ("use pnpm"), a decision that outlives its version with its reason, a trap with the way round it.
- What a version did, how the code is laid out and who calls what do not go in. They have their own place.
- One line each, with the version it came from. About 40 lines at most: past that, merge lines or delete the least useful.
- When you close a version, add what it taught, including what engineers and the reviewer reported as learned, and delete every line it made false. A wrong memory is worse than none.
- Only you write it. Engineers and the reviewer read it first.
- So that every session loads it, also outside `/vibe`, the project's `CLAUDE.md` has the line `@docs/agent/memory.md` and its `AGENTS.md` has the line "Read docs/agent/memory.md before working here". Add each line once, and create the file when it is missing.

### One fact, one place

- Each file has one job, shown in the tree above, and no file repeats another. Point to another file by its path or by an id such as `A1` or `T2`. Never copy from it.
- One of each. Update a file in place. Never add a second list, behavior file, architecture file, page or row for the same thing.
- The docs check proves it, after a version is closed. The first line prints the same number twice. The other three print nothing: no doubled version, no working folder left behind, no rule whose test is gone.

```bash
ls docs/human | grep -c '^v[0-9][0-9]*\.md$'; grep -c '^| \[v[0-9][0-9]*\]' docs/human/README.md
grep '^| \[v' docs/human/README.md | cut -d'|' -f2 | sort | uniq -d
ls docs/agent | grep '^v[0-9]'
grep -o 'test: `[^`]*`' docs/agent/behavior.md | cut -d'`' -f2 | while read -r name; do git grep -q -- "$name" -- ':!docs' || echo "no such test: $name"; done
```

## 7. Git

- The project's own git rules win when it has them: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING`, or the pattern in `git log`.
- Otherwise build a version on its own branch `vibe/v<N>`, cut from the branch you are on, so a shared branch never holds half-done work.
- One commit per task, made by the engineer: `type(scope): summary`, with type one of feat, fix, refactor, perf, test, docs, chore. You commit the docs.
- In a wave each engineer commits on its own branch `vibe/v<N>-<task>`, and only you write to `vibe/v<N>`.
- When acceptance passes, fast-forward the branch you started from with `git merge --ff-only vibe/v<N>`, then delete `vibe/v<N>`. If it will not fast-forward, or the version is blocked, leave the branch and say so.
- Small work is one commit on the current branch.
- Stage only the files the task touched. Never commit secrets. Never push, force, rebase or rewrite history unless the user asks.
- No git repository: work without one.

## 8. Report

End with this and nothing more:

```
Type: <type> · v<N> · <done | blocked>
Changed: <two to four plain lines>
Verified: <each acceptance criterion: command → result>
Not verified: <what and why, or "nothing">
Read more: docs/human/v<N>.md
```
