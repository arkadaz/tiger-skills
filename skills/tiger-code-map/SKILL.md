---
name: tiger-code-map
description: How to find your way in a codebase and see what a change will touch. You find your way by searching and reading the code. The code map, a plain-text list of every call in the project written by a program, gives what a search cannot give in one go - every caller of what you change, every implementation of a trait, every call that starts a thread, dead code, a skipped layer. The map is rebuilt after every task and never written by hand. Use when you need to understand unfamiliar code, see who calls a function, see what a change will touch, or before changing a function, a type or an interface.
---

# Code map

`docs/agent/codemap.md` lists every call in the project. Each block starts at a route or at a function that nothing else calls, and follows every call until it ends.

```
post_order  [shop/adapters/http.py]
  place_order  [shop/domain/checkout.py]
    apply_coupon  [shop/domain/pricing.py]
    order_total  [shop/domain/pricing.py]
      line_total  [shop/domain/pricing.py]
    OrderStore.save  [shop/domain/checkout.py]
  read_lines  [shop/adapters/http.py]
  export_daily  [shop/adapters/http.py]
    write_report  [shop/adapters/files.py]  (new thread)

## Functions

post_order(store: OrderStore, body: dict) -> dict  [shop/adapters/http.py]
place_order(store: OrderStore, customer: str, lines: list[tuple[Decimal, int]], percent_off: int) -> int  [shop/domain/checkout.py]
```

- Each line is `function  [file]`. A method is written `Owner.name`.
- `## Functions` at the end has one line for every function: its inputs and its output, in the language's own syntax, and its file.
- A line indented under another is called by it, in the order the calls are written.
- A block that starts at a route, such as `PATCH /api/v1/notes/{noteId}`, has the function that answers it on the next line. Routes and `main` come first.
- A trailing `...` means that function's calls are shown earlier in the same block.
- Lines marked `(impl)` under a trait's or an interface's method are its implementations, each named by the type that implements it: `Frames.encode  (impl)` under `Inference.encode` is `encode` in `impl Inference for Frames`. Only one of them runs: the one of the value it is called on. Read the code to see which.
- A line marked `(new thread)` is called inside a closure handed to a spawn, such as `thread::spawn(move || work())`: it runs on another thread, and the caller does not wait for it. A hand-off by a channel or a queue is not marked.
- Tests, a Rust file's `#[cfg(test)]` module, and `docs/` are left out.
- Generated and vendored code is not followed. A call into it is one line marked `(generated)` or `(vendored)`. Generated is what says so in its first lines or what `.gitattributes` marks `linguist-generated`; vendored is what it marks `linguist-vendored`, such as a build tool or a theme copied into the repo.
- A line marked `(guess)` is a call matched by its name alone, such as `x.insert()` on a value whose type the map cannot see. It is not followed, and it may be wrong: read the code before you rely on it.
- It shows that a call exists. It does not show when the call happens or which value is passed. Read the function for that.
- It misses a call it cannot trace to one function, such as a method on a local variable, or a function passed as a value.

## A program writes it

You never write this file, and you never write a call chain anywhere else from memory.

- CodeGraph parses the code. `codemap.mjs`, in this skill's folder, prints its index as the text above.
- Set up once per machine: `npm i -g @colbymchenry/codegraph`.
- Set up once per project: add `.codegraph/` to `.gitignore`, and copy `codemap.mjs` to `docs/agent/codemap.mjs`. When the planner plans a version, it compares the two files and copies the skill's over when they differ, in the plan's commit.
- The index in `.codegraph/` is not in git, so a fresh checkout or worktree has none. The build line makes it when it is missing.
- Build it:

```bash
{ [ -d .codegraph ] || codegraph init -y; } && codegraph sync && node docs/agent/codemap.mjs > docs/agent/codemap.md && node docs/agent/codemap.mjs --human docs/human/flows.html
```

## For people

The same line writes `docs/human/flows.html`, the map drawn for a person. Open it in a browser; it needs nothing else. Pick a starting point, such as a route, a program or a function the app calls, and it shows:

- the areas and then the parts of the code it passes through, in order, such as `backend → domain` and `inbound → note → store → outbound`;
- below, the steps between parts, each with its inputs and its output; any step opens to the steps under it, and "every function" shows them all;
- the marks in plain words: one of these runs, runs on another thread.

Point the user to it when they ask how something works or what a change touches.

## It stays current

- It is rebuilt and committed after every task or wave, by whoever lands the work. Engineers read it and do not rebuild it.
- A stale map is a failing check, at acceptance and in the project's CI: build it, then `git diff --exit-code docs/agent/codemap.md docs/human/flows.html` must show nothing.
- There is one map. It is never copied into another doc. `flows.html` is the same map, written from it by the same program.

## Find your way

1. Search and read the code. That is how you learn what runs: which path is taken, which implementation, on which thread. Do not trace it in the map: the map lists every call that can happen, and a path read from it is often not the one that runs.
2. Where the code picks one of several calls, by a `match`, an `if`, or a trait with several implementations, name each one and what picks it. Do not follow one and leave the others out.
3. A line number you give is one you read in the source file.
4. A link you did not read in the code is a guess: say so.

The map is for lists a search cannot give you in one go: what a change reaches, as "Before a change" says, the implementations of a trait method and the calls that start a thread, to read in the code, and dead code.

## Read it

Search it. Open the whole file only when `wc -l docs/agent/codemap.md` is under 2000 lines.

```bash
sed '/^## Functions/q' docs/agent/codemap.md | grep -n '^[^ ]' | head -100
grep -i '^[A-Za-z_.]*order[A-Za-z_]*(' docs/agent/codemap.md
```

- The first prints every block's first line, routes and `main` first: how the project hangs together.
- The second prints every function whose name holds a word, here `order`, once each, with its inputs, its output and its file. A method is written `Owner.name`, a function by its name alone.

What a change to a function reaches, here `OrderStore.save`: every entry point above it, such as a route, a function the app calls through the bridge, or `main`, and how many functions lie between. It leaves out calls marked `(guess)`; the next command shows them with their mark.

```bash
awk -v name='OrderStore.save' '
function up(key,   names, count, at) {
  if (key in done) return
  done[key]; reached++
  count = split(callers[key], names, SUBSEP)
  if (count < 2) { tops[key]; return }
  for (at = 2; at <= count; at++) up(names[at])
}
/^## Functions/ { exit }
/^$/ || /\(guess\)$/ { next }
{
  match($0, /^ */); depth = RLENGTH / 2
  key = substr($0, RLENGTH + 1); sub(/\].*/, "]", key)
  chain[depth] = key
  if (depth > 0 && !((chain[depth - 1], key) in seen)) { seen[chain[depth - 1], key]; callers[key] = callers[key] SUBSEP chain[depth - 1] }
  if (index(key, name "  [") == 1) wanted[key]
}
END { for (key in wanted) up(key); for (key in tops) print key; print reached - 1 " functions can reach it" }' docs/agent/codemap.md | sort
```

Who calls a function, and who calls them, up to the entry points: every way in, as a tree that grows upward. A caller is printed under what it calls, with the mark of that call. A line ending in `...` is shown in full above. `deep=1` prints only the direct callers.

```bash
awk -v name='OrderStore.save' -v deep=99 '
function up(key, mark, depth,   names, notes, count, at) {
  print sprintf("%" (2 * depth) "s", "") key mark (key in done ? "  ..." : "")
  if (key in done || depth >= deep) return
  done[key]
  count = split(callers[key], names, SUBSEP)
  split(marks[key], notes, SUBSEP)
  for (at = 2; at <= count; at++) up(names[at], notes[at], depth + 1)
}
/^## Functions/ { exit }
/^$/ { next }
{
  match($0, /^ */); depth = RLENGTH / 2
  key = substr($0, RLENGTH + 1); mark = key
  sub(/\].*/, "]", key); sub(/^[^\]]*\]/, "", mark); sub(/  \.\.\.$/, "", mark)
  chain[depth] = key
  if (depth > 0 && !((chain[depth - 1], key) in seen)) {
    seen[chain[depth - 1], key]
    callers[key] = callers[key] SUBSEP chain[depth - 1]
    marks[key] = marks[key] SUBSEP mark
  }
  if (index(key, name "  [") == 1) wanted[key]
}
END { for (key in wanted) up(key, "", 0) }' docs/agent/codemap.md
```

Everything a function calls, here `place_order`, `below` levels deep:

```bash
awk -v name='place_order' -v below=3 '
{ match($0, /^ */); depth = RLENGTH / 2 }
open && (depth <= top || $0 == "") { exit }
!open && index(substr($0, RLENGTH + 1), name "  [") == 1 && !/\.\.\.$/ && !/\(guess\)$/ { open = 1; top = depth }
open && depth <= top + below' docs/agent/codemap.md
```

- Who calls this? The first one, with `deep=1`.
- Which implementations does a trait or interface method have? The second one with `below=1`: its `(impl)` lines.
- What runs on another thread, and who starts it?

```bash
awk '/^## Functions/ { exit } { match($0, /^ */); depth = RLENGTH / 2; line[depth] = substr($0, RLENGTH + 1) } /\].*\(new thread\)/ { print line[depth - 1] "  starts  " line[depth] }' docs/agent/codemap.md | sort -u
```

- Where does this call go? The second one. Raise `below` to see further. A line ending in `...` has its calls shown elsewhere: ask for it by name.
- What does it take and give? `grep '^OrderStore.save(' docs/agent/codemap.md`.
- What starts here? A block's first line is an entry point: something from outside calls it.
- The types tell you what flows from one step into the next. A function with no declared types hides that, so declare the input and output types of every function you write or change, in every language that has them.

## Before a change

1. Check that what you rely on exists now: it has a line in the map. What you remember from earlier, from a doc, or from an old version is not evidence.
2. Never build on something marked deprecated. Use its replacement.
3. Find what your change affects, before you write it:
   - The callers you must edit: search the code for the name; that finds the tests too, which the map leaves out. A hit on another type's method of the same name is not a caller. When a signature changes, the compiler lists every caller that breaks: `cargo check`, `dart analyze`, the type checker.
   - What a change in behavior reaches: run the reach command in "Read it", the first `awk`, with the name of every function you change. Do not read it off the map by eye: a block shows one way down, not every way in. Each entry point it prints, a route, a function the app calls, a `main`, is a feature the change can break. A top that is none of these, such as a `drop` or a closure, is a call the map cannot see: search for its name and follow it up in the code.
4. When a signature or a meaning changes, every caller is updated in the same task, and the tests of every caller and of every entry point it reaches are run. Name those entry points in your report.
5. A caller outside the task's files is a gap. Report it. Do not edit it silently.
6. A function that starts its own block and is not a real entry point is called by nothing: it is dead code. Say so instead of changing it. First search for its name: the map does not see a function that is only passed as a value, such as a sort key, a callback or a handler.

In a hexagonal project every block runs inbound adapter, use case, domain, port, outbound adapter. A block that skips a layer or runs backwards is a finding.

## When it is missing

- No `docs/agent/codemap.md`: set it up as above.
- No `codegraph` command on the machine: tell the user the install line, once. Do not install it yourself.
- Until then, list callers with a search or the language server, then the callers of each caller, until you reach the routes, app functions and `main`s, and say that you worked without the map. A search misses calls made through an interface or a variable: where a caller is a trait's or an interface's method, search for calls to that method.
