# tiger-skills

Coding with an AI agent, through one command: **`/vibe`**.

You say what you want. The agent works out what kind of job it is, plans it, hands the coding to an engineer agent that works the way a principal engineer does, has a separate reviewer check the result, and writes down what changed.

## Install

Install it once, for your whole machine. There is nothing to install per project.

### Claude Code

```bash
claude plugin marketplace add arkadaz/tiger-skills
claude plugin install tiger-skills@arkadaz
```

This brings the skills and the two agents. Update with `claude plugin update tiger-skills@arkadaz`, remove with `claude plugin uninstall tiger-skills@arkadaz`.

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

pi and other agents get the skills. Where an agent cannot start sub-agents, it does the engineer's and the reviewer's work itself, with the same skills loaded.

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

- **It asks only when it must.** A small, clear request is just built. A vague, large or risky one is grilled first: one question at a time, each with the answer it recommends. Money, permissions, personal data and anything that cannot be undone are always asked. You can start that yourself with `/vibe grill me on ...`.
- **The first time in a project that already has code**, it maps the project once before doing anything else.
- **It works on its own branch**, `vibe/v<N>`, one commit per task, and fast-forwards the branch you started from when everything passes. It never pushes.
- **It ends with a short report**: what changed, what was checked and the result, and what it could not check.

### Picking up later

Everything it needs is in the project's `docs/` folder and in git. Run `/vibe` again with the same request, or `/vibe continue`, and it resumes at the first task that is not done.

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
      spec.md         the change: behavior, design, edges, acceptance
      tasks.md        tasks, each with its check and the result
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

Two agents:

| Agent | Model | Job |
|---|---|---|
| `tiger-engineer` | Sonnet | writes the code, one task at a time, with the building skills loaded |
| `tiger-reviewer` | Opus | checks finished work it did not write, in a fresh context, and proves every finding |

Planning runs on whatever model your session uses, so start `/vibe` in an Opus session when the plan matters. Tasks that share no file are built at the same time, each engineer in its own git worktree.

The skills are how a principal engineer works, in any language:

| Skill | What it decides |
|---|---|
| `vibe` | the entry point: classifies the request, plans, checks, records |
| `tiger-grill` | asking you until the request is exact |
| `tiger-code-quality` | how the lines read: think first, reuse, plain steps, small functions, named types, plain names, no comments, nothing left behind |
| `tiger-design-principles` | the shape of the code: one reason to change, one home for every rule, low coupling, small interfaces, no surprises |
| `tiger-refactoring` | changing existing code safely: one named move per smell, tests green throughout |
| `tiger-hexagonal` | where code lives: business rules in the middle, I/O at the edge |
| `tiger-verification` | proof: test first, a decision tree for edge cases, lint and type checks every time, few and fast tests, Playwright for screens |
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
