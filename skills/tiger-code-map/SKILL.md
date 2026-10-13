---
name: tiger-code-map
description: A plain-text map of the codebase written by a program - for every entry point, the full chain of calls from start to end, each step with its inputs, its output and its file. Agents read it to understand code they have not opened and to see where a call goes, instead of searching. It is rebuilt after every task and never written by hand. Use when you need to understand unfamiliar code, see where a call leads or who calls a function, see what a change will touch, or before changing a function, a type or an interface.
---

# Code map

`docs/agent/codemap.md` shows where every call goes. Each block starts at a function that nothing else calls, and follows every call until it ends.

```
post_order(store: OrderStore, body: dict) -> dict  [shop/adapters/http.py]
  place_order(store: OrderStore, customer: str, lines: list[tuple[Decimal, int]], percent_off: int) -> int  [shop/domain/checkout.py]
    apply_coupon(total: Decimal, percent_off: int) -> Decimal  [shop/domain/pricing.py]
    order_total(lines: list[tuple[Decimal, int]]) -> Decimal  [shop/domain/pricing.py]
      line_total(unit_price: Decimal, quantity: int) -> Decimal  [shop/domain/pricing.py]
    OrderStore.save(self, customer: str, amount: Decimal) -> int  [shop/domain/checkout.py]
  read_lines(body: dict) -> list[tuple[Decimal, int]]  [shop/adapters/http.py]
```

- Each line is `function(inputs) -> output  [file]`, in the language's own syntax.
- A line indented under another is called by it, in the order the calls are written.
- A trailing `...` means that function's calls are shown earlier in the same block.
- Tests and `docs/` are left out.
- It shows that a call exists. It does not show when the call happens or which value is passed. Read the function for that.

## A program writes it

You never write this file, and you never write a call chain anywhere else from memory.

- CodeGraph parses the code. `codemap.mjs`, in this skill's folder, prints its index as the text above.
- Set up once per machine: `npm i -g @colbymchenry/codegraph`.
- Set up once per project: `codegraph init`, add `.codegraph/` to `.gitignore`, and copy `codemap.mjs` to `docs/agent/codemap.mjs`. Copy it again when the skill's copy has changed.
- Build it:

```bash
codegraph sync && node docs/agent/codemap.mjs > docs/agent/codemap.md
```

## It stays current

- It is rebuilt and committed after every task or wave, by whoever lands the work. Engineers read it and do not rebuild it.
- A stale map is a failing check, at acceptance and in the project's CI: build it, then `git diff --exit-code docs/agent/codemap.md` must show nothing.
- There is one map. It is never copied into another doc.

## Read it

- New to the project: read all of it. It is the fastest way to see how the code hangs together.
- Working on a task: find the function you will touch and read every block it appears in, from the top of the block down.
- Where does this call go? Read the lines indented under it, to the end.
- Who calls this? The line it is indented under, in every block where it appears.
- What starts here? A block's first line is an entry point: something from outside calls it.
- The types tell you what flows from one step into the next. A function with no declared types hides that, so declare the input and output types of every function you write or change, in every language that has them.

## Before a change

1. Check that what you rely on exists now: it has a line in the map. What you remember from earlier, from a doc, or from an old version is not evidence.
2. Never build on something marked deprecated. Use its replacement.
3. List every caller of what you will change, from the map.
4. When a signature or a meaning changes, every caller is updated in the same task, and the tests of every caller are run.
5. A caller outside the task's files is a gap. Report it. Do not edit it silently.
6. A function that starts its own block and is not a real entry point is called by nothing: it is dead code. Say so instead of changing it.

In a hexagonal project every block runs inbound adapter, use case, domain, port, outbound adapter. A block that skips a layer or runs backwards is a finding.

## When it is missing

- No `docs/agent/codemap.md`: set it up as above.
- No `codegraph` command on the machine: tell the user the install line, once. Do not install it yourself.
- Until then, read the code itself and follow calls with the language server or a search, and say that you worked without the map. A search misses calls made through an interface or a variable.
