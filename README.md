# tiger-skills

Coding with an AI agent, through one command: **`/vibe`**.

You say what you want. It works out what kind of job it is, has a planner read the project and draw every case as a tree, asks you what is still open, hands the coding to engineer agents that work the way a principal engineer does, has a separate reviewer check the result, and writes down what changed.

## Install

Install it once, for your whole machine. There is nothing to install per project.

### Claude Code

```bash
claude plugin marketplace add arkadaz/tiger-skills
claude plugin install tiger-skills@arkadaz
```

This brings the skills and the three agents. Update with `claude plugin update tiger-skills@arkadaz`, remove with `claude plugin uninstall tiger-skills@arkadaz`.

### pi

```bash
pi install git:github.com/arkadaz/tiger-skills
```

Update with `pi update`, remove with `pi remove git:github.com/arkadaz/tiger-skills`.

### Any other agent

```bash
npx skills add arkadaz/tiger-skills -g
```

Update with `npx skills update -g`, remove with `npx skills remove -g`.

pi and other agents get the skills. Where an agent cannot start sub-agents, it does the planner's and the engineer's work itself, in the same order, with the same skills loaded.

To get the three agents in pi, copy `pi/agents/*.md` into `.pi/agents/` in your project, or into `~/.pi/agent/agents/` for all projects. They need a pi subagent package that reads that folder. Those packages name their fields differently, so check yours; these files use `description`, `skills` and `thinking: xhigh`, and leave the model to whatever pi has active.

### The code map tool

```bash
npm i -g @colbymchenry/codegraph
```

The agents read a text map of your code that a program writes. This is the program. Without it they read the code directly and tell you they worked without the map. It sends anonymous usage stats unless you run `codegraph telemetry off`.

## Use

Open your project in the agent and type `/vibe` followed by what you want, in your own words.

```text
/vibe add CSV export to the orders page
/vibe the checkout total is wrong when a coupon is applied
/vibe split the billing module, it is too big
/vibe the product list takes four seconds to load
/vibe add a queue for outgoing emails
/vibe review this branch
/vibe how does the discount get applied?
```

In Claude Code the command's full name is `/tiger-skills:vibe`, and `/vibe` finds it. In pi it is `/vibe`. In other agents it is `/vibe` or `/skill:vibe`.

### What happens

You never pick a mode. It classifies the request and tells you in one line, such as `Type: bugfix — checkout total ignores the coupon`.

Your session is only the conductor: it starts the agents, runs the commands they hand it, shows you what came back, and asks you. It writes no code and makes no plan, so it works the same on a small model as on a large one. For anything that changes behavior, the order is fixed:

1. **Understand.** The planner reads the project: the living docs, the code map, then the code and tests the request touches. It draws a decision tree of the request: every condition, every answer it can have, every path. This is how it finds the cases you did not mention. You are shown the tree.
2. **Ask.** You are asked about every leaf still marked open, one question at a time, each with the answer it recommends.
3. **Plan.** The planner writes the spec, with the finished tree in it, and splits the work into tasks.
4. **Confirm.** You see the finished tree and what "done" means, and it asks "Build this?". Nothing is built before you say yes.
5. **Build.** One engineer per task, test first. Tasks that share no file are built at the same time.
6. **Check.** After every task: its own check, the static checks, the tests. At the end: every acceptance command.
7. **Review.** A reviewer that did not write the code runs it, probes it, and proves every finding. Findings go back to an engineer once, and a second reviewer checks the fix.
8. **Close.** The planner edits the living docs to match, adds a page for the version, and lands the branch.

| It decides this is a | So it |
|---|---|
| feature | writes a short spec with the design and the acceptance criteria, splits it into tasks, has each built test-first, checks every criterion |
| bug fix | reproduces the bug, finds the real cause, has it fixed there with a test that failed first |
| refactor | pins today's behavior with tests, then has the structure changed in small named moves with the tests staying green |
| performance | measures first, changes one thing, measures again |
| infra | writes it in Terraform and hands you the plan. It never applies unless you ask. |
| chore or docs | has it done, runs the checks and tests |
| review | has a separate reviewer run the tests and checks, and reports problems with their proof |
| question | answers from the code and changes nothing |

- **It asks about what is open, not about everything.** What the docs and the code already answer is not asked, and neither is anything you answered in an earlier version. Money, permissions, personal data, anything that cannot be undone, and what a new screen should look like are always asked. You can start an interview yourself with `/vibe grill me on ...`.
- **Name a skill and it is used inside the work.** `/vibe build the landing page, use skill <name>` hands that skill to the planner and the engineers. It does not replace the steps.
- **The first time in a project that already has code**, it maps the project once before doing anything else.
- **It works on its own branch**, `vibe/v<N>`, one commit per task, and fast-forwards the branch you started from when everything passes. It never pushes.
- **You can inspect the cases.** The tree is drawn in the chat, kept in the spec while the work is going on, and moved to the version's page in `docs/human/` when it is done:

```
page size?
├─ below 1 ................ refused, the size in the message      [request]
├─ 1 to 100
│  └─ items?
│     ├─ none ............. 0 pages                               [code]
│     └─ not a multiple ... one page more                         [code]
├─ above 100 .............. refused, the size in the message      [request]
└─ not a whole number ..... ? OPEN                                [ask]
```

- **It ends with a short report**: what changed, what was checked and the result, and what it could not check.

### Picking up later

Everything it needs is in the project's `docs/` folder and in git: every task's commit ends with its version and task, such as `(v3 T2)`. Run `/vibe continue` and it resumes at the first task that is not done.

## What your project gets

```
docs/
  human/              for you: short, plain words
    README.md         what it does today, then the list of versions
    v1.md             one page per version: what changed
  agent/              for the agent: exact detail
    behavior.md       what the system does today: one line per rule, with its test
    architecture.md   layers, ports, settings, commands, words
    memory.md         what was learned: conventions, decisions, traps
    codemap.md        every entry point traced call by call to the end. Written by a program
    codemap.mjs       the program that writes it
    v7/               exists only while version 7 is being built
      spec.md         the change: behavior, design, cases, acceptance
      tasks.md        the tasks and their verification
```

Versions run `v1`, `v2`, `v3`. Start with `docs/human/README.md`: it says what the project does today and lists every version.

**Living docs are the truth; versions are history.** `behavior.md`, `architecture.md` and `memory.md` are edited in place, so they always describe the system as it is now. The version pages only record what changed. The spec and tasks are working paper: when a version closes, what lasts is folded into the living docs and the folder is deleted, so no agent can read an old spec as if it were current. Git keeps it.

The code map looks like this. Each block starts where something is called from outside and follows every call until it ends:

```
post_order(store: OrderStore, body: dict) -> dict  [shop/adapters/http.py]
  place_order(store: OrderStore, customer: str, lines: list[tuple[Decimal, int]], percent_off: int) -> int  [shop/domain/checkout.py]
    order_total(lines: list[tuple[Decimal, int]]) -> Decimal  [shop/domain/pricing.py]
      line_total(unit_price: Decimal, quantity: int) -> Decimal  [shop/domain/pricing.py]
    OrderStore.save(self, customer: str, amount: Decimal) -> int  [shop/domain/checkout.py]
  read_lines(body: dict) -> list[tuple[Decimal, int]]  [shop/adapters/http.py]
```

## What is in the box

Three agents, each pinned to its own model and its own level of thinking, whatever your session is on:

| Agent | Model | Thinking | Job |
|---|---|---|---|
| `tiger-planner` | Sonnet | xhigh | reads the project, draws the decision tree, finds the questions, writes the spec, the tasks and the docs |
| `tiger-engineer` | Haiku | xhigh | writes the code, one task at a time, with the building skills loaded |
| `tiger-reviewer` | Opus | xhigh | checks finished work it did not write, in a fresh context, and proves every finding |

To change one, edit two lines at the top of its file in `agents/`:

```yaml
model: sonnet     # haiku, sonnet or opus
effort: high      # low, medium, high, xhigh or max
```

A bigger model and more thinking find more and take longer. The reviewer is where they pay most, and the engineer where they pay least, because it builds from a spec that already fixes the types and the signatures.

Tasks that share no file are built at the same time, each engineer in its own git worktree.

The skills are how a principal engineer works, in any language:

| Skill | What it decides |
|---|---|
| `vibe` | the entry point: classifies the request and conducts the agents in a fixed order |
| `tiger-planning` | the plan: reading the project, the spec, the tasks, and docs that stay true |
| `tiger-decision-tree` | finding every case before anything is built, and drawing it as a tree you can inspect. An open leaf is a question to you. |
| `tiger-grill` | asking you until the request is exact, one question at a time |
| `tiger-code-quality` | how the lines read: think first, reuse, plain steps, small functions, named types, plain names, no comments, nothing left behind |
| `tiger-design-principles` | the shape of the code: one reason to change, one home for every rule, low coupling, small interfaces, no surprises |
| `tiger-refactoring` | changing existing code safely: one named move per smell, tests green throughout |
| `tiger-hexagonal` | where code lives: business rules in the middle, I/O at the edge |
| `tiger-verification` | proof: test first, one test row per case, lint and type checks every time, few and fast tests, Playwright for screens |
| `tiger-performance` | performance first: know the size, the right data structure and the fewest round trips from the first line |
| `tiger-logging` | logs for whoever has to find the fault: structured, at the edge, never a secret |
| `tiger-configuration` | settings outside the code, read once, checked at startup, no secrets in the repository |
| `tiger-terraform` | infrastructure as Terraform, verified by a reviewed plan |
| `tiger-code-map` | the generated text map of the code, and how to read it |
| `tiger-review` | a review made of proof: runs, checks and quoted rules |

## Check this repo

```bash
claude plugin validate .
```
