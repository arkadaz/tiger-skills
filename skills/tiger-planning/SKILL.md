---
name: tiger-planning
description: How a principal engineer plans a change before any code is written and closes it afterwards. Read the project, map it the first time, draw the decision tree, design the data and the signatures, write a short spec and small tasks that can be built in parallel, and keep the project's docs true - living docs edited in place, one page per version for people, nothing duplicated. Use when planning a feature, a bug fix, a refactor, a performance change or infrastructure, when writing or updating project docs, and when closing a version.
---

# Planning

The plan decides the quality of everything after it. An engineer handed a vague shape writes vague code, so nothing here is left vague.

`templates/` is inside this skill's folder. The rules a plan is built on are in `tiger-decision-tree`, `tiger-grill`, `tiger-code-quality`, `tiger-design-principles`, `tiger-refactoring`, `tiger-hexagonal`, `tiger-verification`, `tiger-performance`, `tiger-configuration` and `tiger-code-map`. Load them if they are not already in your context.

## Jobs

You are handed one of four jobs. Do that job, reply in exactly its form, and stop.

You cannot talk to the user. Whoever handed you the job shows them your reply and brings back their answers. Write the reply in the user's language, and keep the labels, the commands and the paths as they are here.

### understand

You are handed the request, word for word. Change no product code.

1. Read the project. Map it first when this is the first time.
2. Draw the tree.
3. Reply:

````
Type: <type> — <the request in one line>
Version: v<N>

```
<the tree, with every open leaf marked ? OPEN>
```
unchanged: <what stays as it is today>

Questions:
1. <the question> — <answer> (recommended: <why>) / <answer> / <answer>
Decided for you: <each [default] leaf in a few words, or "nothing">
Will be built: <two to four plain lines>
Note: <what the user must know now, such as a missing tool. Leave the line out when there is nothing>
````

`Questions: none` when no leaf is open. A bug you could not reproduce is a question.

### plan

You are handed the request, your `understand` reply, and the user's answers.

1. Put the answers in the tree, marked `[user]`. When an answer opens a leaf that must be asked, write nothing and reply with `Questions:` alone, in the same form.
2. Open the version: cut `vibe/v<N>`, write `spec.md` and `tasks.md` as "Plan: by type" says, and start `docs/human/v<N>.md` with the status `building`.
3. Commit them as `docs: plan v<N>`.
4. Reply with the build sheet:

````
Version: v<N> — <title>
Branch: vibe/v<N>, cut from <branch>
Spec: docs/agent/v<N>/spec.md
Tasks: docs/agent/v<N>/tasks.md

```
<the finished tree: no leaf open>
```

Done when:
- A1 <the criterion in plain words>

Setup: `<installs the dependencies in a fresh checkout>`
Checks: `<the static checks, then the unit and use case tests>`
Map: `<rebuilds the code map and commits it>`
Wave 1
- T1 <name> — `<its verify command>`
- T2 <name> — `<its verify command>`
Wave 2
- T3 <name> — `<its verify command>`
Accept:
- A1 `<command>`
- `<the acceptance run from "What runs when" in tiger-verification>`
- `<the architecture check>`
Range: <the sha of the plan commit>..vibe/v<N>
Drop: `<goes back to the starting branch and deletes vibe/v<N>>`
````

- Every command is complete and can be pasted as it is. Whoever runs it knows nothing about the project.
- `Map` is this line, or `none` with the install line from `tiger-code-map` when the machine has no `codegraph`:

```bash
{ [ -d .codegraph ] || codegraph init -y; } && codegraph sync && node docs/agent/codemap.mjs > docs/agent/codemap.md && git add docs/agent/codemap.md && (git diff --cached --quiet || git commit -m "docs: code map (v<N>)")
```

- No git repository: `Branch: none`, every wave holds one task, `Range` lists the files instead, and `Drop` deletes the two things this job wrote.
- A plan that comes back with a change or a gap: edit the spec and the tasks in place, commit, and reply with the whole sheet again.
- A version that is already open, when the request continues it: write nothing. Reply with its sheet, and put `— done` after each task whose id is in `git log`. Without git, a task is done when its verify command passes now.

### close

You are handed the version, the result (`done` or `blocked`), what each `Accept` command printed, the reviewer's reply, the findings still open and the engineers' reports. Do "Close a version", then reply with this and nothing more:

```
Type: <type> · v<N> · <done | blocked>
Changed: <two to four plain lines>
Verified: <each acceptance criterion: command → result>
Not verified: <what and why, or "nothing">
Next: <findings still open, leftovers and follow-ups worth a version of their own, or "nothing">
Read more: docs/human/v<N>.md
```

### answer

You are handed a question. Answer it from the living docs, the code map and the code, with `file:line` for each claim. Change nothing.

## Read the project first

Read in this order, and trust in this order: the code and its tests, the code map, the living docs.

1. `docs/agent/memory.md`, `docs/agent/behavior.md`, `docs/agent/architecture.md`.
2. `docs/agent/codemap.md`, for the part the request touches.
3. That code and its tests.

A version page in `docs/human/` is history, not a description of the system. Something you remember, or read in an old page, is a lead to check, never a fact. Before you build on a function, a rule or a feature, confirm it exists now.

Note what already exists that can be reused, and what calls the code that will change.

### The first time in a project

When the project has code but no `docs/agent/architecture.md`, map it once, before anything else:

1. Set up and build the code map as `tiger-code-map` says, then read it.
2. Write `architecture.md` from what is really there: which folders play which layer, the ports, what the project needs to run, the setup, check and test commands that actually work, the words the code uses. Run each command before you write it down.
3. Seed `behavior.md` from the existing tests only: one line per rule a test proves. Never a rule no test proves. List what no test covers under Not proven.
4. Put in `memory.md` only what you had to find out the hard way.
5. Commit as `docs: map the project`.

An empty project has nothing to map. Its `architecture.md` is written with the first version.

## Draw the tree

Draw the decision tree for each rule in the request, as `tiger-decision-tree` says, and mark every leaf with where its result came from. Close each open leaf the way that skill says. `tiger-grill` lists what must be closed before anything is built, and what is always asked and never defaulted.

When the request names another skill, load it and use it for the part it covers. Whatever that skill needs to ask the user becomes an open question here, and each task it applies to names it. It works inside the plan. It never replaces the tree, the spec or the tasks.

A mixed request is split into one version per type, in this order: bugfix, refactor, feature. Plan the first, and say on the `Type` line what follows.

## Plan: by type

### Feature

1. Open the next version and write `spec.md`: the exact behavior with real values, one worked example per rule, the drawn tree as Cases, and the acceptance criteria. Each criterion carries the command that proves it. As few criteria as prove the request.
2. Design it in the spec, as `tiger-code-quality` rule 1 and `tiger-design-principles` say. How big the data is and how fast it must be. Which settings it needs. Then data first: every new or changed type with its fields, a named type and never a loose record. Then every new or changed function and port with its exact signature.
3. Write `tasks.md`: small tasks from the inside out — domain, ports, use cases, adapters, wiring. Each names its layer, its files, what it reuses, which tasks it waits for, a skill the user named for it, and its verification. A verification is one command and what it must print. Breaking the code to watch a test fail is the engineer's work and the reviewer's, not a step of the task.

### Bug fix

1. Reproduce it with the smallest input and keep the command. If you cannot, say what you tried and ask for the missing fact. Never plan a fix from a guess.
2. Find the cause: the line where the wrong decision is made, not where the symptom shows. The tree here is built around the bug: which other inputs take the same wrong path, and which sibling code makes the same mistake.
3. The spec is the Bug section, the Cases tree, the acceptance criteria and any decision. Nothing more.
4. Tasks: a test that fails because of the bug, then the smallest fix at the cause, then the same for each sibling. No unrelated cleanup.

### Refactor

1. Plan it with `tiger-refactoring`: each task is one named move for one smell.
2. The first task adds tests for what the code does today, wherever coverage is missing, in its own commit.
3. The same tests pass, unchanged, after every task. No behavior change and no changed public interface, unless that is the request.

### Performance

1. Measure first, as `tiger-performance` says. One repeatable command and its baseline number go in the spec. The target number is the acceptance criterion.
2. Find the slow part with a profiler or a timer. Each task changes one thing.

### Infra

1. All infrastructure is Terraform, as `tiger-terraform` says. The spec lists every resource to add, change or remove, and what the program gets back as settings.
2. Each task is verified by the format check, the validation and a plan. The acceptance criterion is the plan's summary line, with nothing destroyed that holds data.
3. Nobody applies. The plan is handed to the user.

## Tasks that can be built at the same time

- Fix every signature in the spec first. Then the code on both sides of a port can be built at once.
- Two tasks that share no file and do not wait for each other go in the same wave.
- A task that shares a file with another, or needs its result, goes in a later wave.
- A wave of one is normal. Do not split a task only to make a wave wider.

## The docs

```
docs/
  human/              for people: short, plain words
    README.md         what it does today, then the list of versions
    v1.md             one page per version: what changed
  agent/              for agents: exact detail
    behavior.md       what the system does today: one line per rule, with its test
    architecture.md   layers, ports, settings, commands, words
    memory.md         what was learned: conventions, decisions, traps
    codemap.md        every entry point traced call by call to the end. Written by a program
    codemap.mjs       the program that writes it
    v7/               exists only while version 7 is being built
      spec.md         the change: behavior, design, cases, acceptance
      tasks.md        the tasks and their verification
```

### Living docs and history

- Living docs say what is true now, and are edited in place: `behavior.md`, `architecture.md`, `memory.md`, and the "today" part of the human `README.md`. A line that stops being true is changed or deleted. It is never left beside its replacement.
- History says what changed: the version pages and the list of versions. It is not edited after a version closes.
- `docs/agent/v<N>/` is working paper. When the version closes, what lasts moves into the living docs and the folder is deleted in the same commit. Git keeps it. An old spec that is not there cannot be mistaken for the truth.

### Writing them

- The next version is the highest number in `docs/human/` plus one, starting at `v1`. Numbers only.
- Start each file from its twin in `templates/human/` or `templates/agent/` (`version.md` is the page for one version). Delete sections that do not apply. Do not add sections.
- `docs/human/` is written in the language the user writes in, in plain words, for someone who will not read the code. About 30 lines a page.
- `docs/agent/` is written in English and is exact: real values, real commands, real paths.
- Size follows the job. A small bug fix is a spec of about 20 lines. No spec passes 60: a bigger request is split into versions.
- `behavior.md` past about 150 lines is split by area into `docs/agent/behavior/<area>.md`.
- Dates come from the system clock (`date +%F`), never from memory.
- Status is `building`, `done` or `blocked`.
- Who calls what is written by a program, in `codemap.md`, and nowhere else.

### One fact, one place

- Each file has one job and no file repeats another. Point to another file by its path or by an id such as `A1` or `T2`. Never copy from it.
- One of each. Update in place. Never a second list, behavior file, architecture file, page or row for the same thing.

### Memory

`memory.md` holds what the next session needs and cannot see in the code, the architecture file or the code map.

- A line goes in when all three are true: it will matter again, the code does not show it, and it was decided on purpose or learned the hard way.
- Three kinds: a convention, a decision that outlives its version with its reason, a trap with the way round it.
- One line each, with the version it came from. About 40 lines at most.
- A line that became false is deleted. A wrong memory is worse than none.
- So that every session loads it, the project's `CLAUDE.md` has the line `@docs/agent/memory.md` and its `AGENTS.md` has the line "Read docs/agent/memory.md before working here". Add each once, and create the file when it is missing.

### Removed and deprecated

- **Removed.** A version that removes or replaces something takes out every trace in the same version: the code, its tests, its lines in `behavior.md` and `memory.md`, and its line under "today". Add one line at the top of each earlier version page that described it: `Changed later by v<N>.`
- **Deprecated.** Something kept for a while gets the language's own deprecation marker in the code. Its line in `behavior.md` says `deprecated`, names the replacement and the version it goes in. Nothing new is built on it.

## Close a version

After the checks and the review are green, in one commit on `vibe/v<N>`:

1. Rebuild the code map. `git diff --exit-code docs/agent/codemap.md` must show it was already current. In it, everything this version added sits inside a block or is a real entry point, and nothing it replaced still has a line.
2. Fold the spec into `behavior.md`: change the lines this version changed, delete the lines it replaced, add the new ones. Each names the test that proves it.
3. Update `architecture.md` when the structure, a setting or a command changed, and `memory.md` with what the engineers and the reviewer reported as learned. A doc line the reviewer found still describing something this version removed is changed here.
4. Finish `docs/human/v<N>.md`: move the drawn tree from the spec into its Cases section, and write what was checked from the results you were given. Add its line to the list in `docs/human/README.md`, and update the "today" part there.
5. Delete `docs/agent/v<N>/` and set the status.
6. Run the docs check. The first line prints the same number twice. The other three print nothing.

```bash
ls docs/human | grep -c '^v[0-9][0-9]*\.md$'; grep -c '^| \[v[0-9][0-9]*\]' docs/human/README.md
grep '^| \[v' docs/human/README.md | cut -d'|' -f2 | sort | uniq -d
ls docs/agent | grep '^v[0-9]'
grep -o 'test: `[^`]*`' docs/agent/behavior.md | cut -d'`' -f2 | while read -r name; do git grep -q -- "$name" -- ':!docs' || echo "no such test: $name"; done
```

7. Land it: fast-forward the branch the version started from with `git merge --ff-only vibe/v<N>`, then delete `vibe/v<N>`. If it will not fast-forward, leave the branch and say so.

A blocked version is not folded and not landed. Its folder and its branch stay, its status says `blocked`, and its page says what was tried and what is still red.

## Git

- The project's own git rules win when it has them: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING`, or the pattern in `git log`.
- Otherwise a version is built on its own branch `vibe/v<N>`, cut from the branch you are on, so a shared branch never holds half-done work.
- The spec and the tasks are committed on that branch before any engineer starts.
- One commit per task, made by the engineer, ending with the version and the task: `feat(search): find products by name (v3 T2)`. Git then shows which tasks are done.
- Never push, force, rebase or rewrite history unless the user asks. Never commit a secret.
- No git repository: work without one. The docs are still written.
