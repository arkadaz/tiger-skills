---
name: tiger-code-quality
description: The standard a principal engineer writes code to, as concrete rules with examples. Think and design the data before writing, reuse before building, never rebuild infrastructure, plain steps instead of dense expressions, small single-purpose functions, named types that say what the data is, plain names, no comments, loud errors, small scope, and nothing left behind - no duplicates, no dead or legacy code. Use whenever you design, write, change, simplify, clean up or review code in any language.
---

# Code quality

Write code the next person can change safely without asking you. That is the whole standard. Everything below is how.

When two rules pull apart, the reader wins: choose the version a new teammate understands fastest.

This skill is about how the lines read. `tiger-design-principles` is about the shape they sit in. `tiger-refactoring` is about changing code that already exists. `tiger-performance`, `tiger-logging` and `tiger-configuration` cover speed, logs and settings. A principal engineer uses all of them, in any language.

## 1. Think before you write

1. Say the change in one sentence. If you cannot, you do not understand it yet.
2. Read the code it touches and what calls it, in the code map.
3. Design the data first: the types and their fields. Then the functions and their signatures. Code written before the data is designed gets rewritten.
4. Choose the shape with `tiger-design-principles`: the fewest parts, each with one reason to change. Between two that are equal, choose the one that is easier to delete.
5. If the code is hard to change, first make the change easy with `tiger-refactoring`, in its own commit with the tests green. Then make the easy change.

## 2. Reuse before you write

Stop at the first that works:

1. no code — the need goes away, or something already meets it
2. code already in this repo
3. the language and its standard library
4. the platform already running — the database, the framework, the operating system
5. a dependency already installed
6. a well-known, maintained library
7. new code, as little as possible

Search the repo before you write a function. Writing again what the repo already has is a defect even when the tests pass. Say what you reused when you report.

## 3. Do not rebuild infrastructure

No home-made database, queue, cache, scheduler, auth, crypto, parser, retry loop or date math. Let the database be the database.

| About to write | Use |
|---|---|
| a loop that checks for duplicates before saving | a unique constraint |
| code that sums, groups or joins rows in memory | one query |
| a query inside a loop | one query for all of them |
| a retry loop with a sleep | the client's or the platform's retry setting |
| a dictionary with expiry times | the cache you already run, or the standard one |
| a parser for dates, money, CSV, JSON, URLs or command line arguments | the standard library |
| a background loop that runs jobs | the platform's scheduler or queue |
| password hashing, tokens, sessions | the framework's auth and a vetted library |

## 4. Plain steps

- The best solution is often one easy line that calls something proven.
- One step per line. A loop is written as a loop: the `for`, then the `if`, then what happens, each on its own line.
- A loop squeezed into one expression, a chain of calls or a nested expression is allowed only when it is one short step that fits on one line. If the formatter has to wrap it, it was too much: write the plain loop.
- Give a middle value a short name instead of nesting one call inside another.
- Say what you mean with a named function, not a trick.
- No options, layers, base classes, patterns or abstractions that nobody asked for. Plain functions and plain data first. A class exists only when there is state with rules to protect.
- Deleting code is progress. The smallest change that solves the request is the target.
- Performance is decided in the design: the right data structure and the fewest round trips, from the first line. See `tiger-performance`. A trick that makes code harder to read waits for a measurement.
- What differs between environments is a setting, not a value in the code. See `tiger-configuration`.

## 5. Functions

- One job. If you need "and" to say what it does, it is two functions.
- At most four inputs. More means they belong together in a named type.
- No yes-or-no input that switches what the function does. Write two functions.
- It returns its answer. It does not change what was passed in.
- No hidden work. It does not read the clock, the environment, a file, the network or shared state unless that is its one job. Those arrive as inputs.
- It fits on one screen, with at most two levels of indentation. Check what is wrong first and leave early, so the normal path runs flat down the left. No `else` after a `return`.

## 6. Data and types

- Declare the input and output types of every function you write or change, in every language that has them.
- A type says what the thing is. No bare dictionary, map, list, tuple or catch-all type for data the code reaches into. Give the data a named type with its fields, and use that name in the signature.
- Make wrong states impossible. A fixed set of choices is an enum, not a string and not two booleans. A value that must be there is not optional.
- Data is not changed after it is built, unless changing it is that type's job. Frozen, read-only or constant by default.
- Turn outside input into typed values once, at the edge. Inside, trust the types and do not check again. The function that does the turning is the one place a loose type is right: it takes the raw input as it comes.
- "Nothing" has one honest shape. No items is an empty list. A single thing that may be missing says so in its type. Never a magic `-1`, `""` or `None` that the caller has to know about.
- Put the unit in the name: `timeout_seconds`, `size_bytes`, `price_cents`. Money is whole units of the smallest coin, or a decimal type. Never a float.
- A number or a string that carries a meaning gets a name. It never appears bare in the code.

## 7. Names

- Use words a teammate would say out loud: `invoice_total`, `send_reminder`.
- A function is named for what it does or returns. A yes-or-no value reads as a question: `is_paid`, `has_stock`.
- One word for one thing, everywhere. If the project says "customer", nothing says "client" or "user" for the same thing.
- Say it the positive way: `is_active`, not `is_not_disabled`.
- No leading-underscore helpers such as `_process` or `_helper2`. No abbreviations. No made-up tokens.
- No `utils`, `helpers`, `manager`, `handler`, `data`, `info` or `tmp`.
- Do not cut logic into single-use helper functions. A function exists because two places call it, or because it names one real idea.
- Names a language or framework requires are fine.

## 8. No comments

- No `#`, no `//`, no block comments, no docstrings that narrate.
- If code needs explaining, rename or restructure it until it does not.
- Only what a tool requires stays: a shebang, a lint or type pragma, a license header.
- Leave existing comments alone on lines you are not changing.
- A trade-off worth recording goes in the spec or your report, not in the code.

## 9. Errors

- Check input where it enters the program, and stop there with a clear error.
- Refuse bad input with the least machinery: a schema or validation library the project has, or the typed value's own constructor. Not a checking function for every field.
- Do not guard against what cannot happen in this program. How hard to check depends on who can send the input: anyone on the internet, or the user's own file.
- An error says what was wrong and shows the value: `page_size must be between 1 and 100, got 0`.
- Raise the most exact error type there is. Catch only the one error you can do something about, and let every other error stop the program.
- Handle an error in one place: where the program can do something about it, which is usually the edge. Do not catch an error in the middle only to raise a different one.
- No bare or broad catch, no silent fallback, no swallowed error, no error code hidden in a normal return value.
- What you open, you close, with the language's own construct for it.
- No print or debug output left in. Logs are written at the edge, one structured event per thing that happened, and never contain a secret or personal data. See `tiger-logging`.
- Nothing ships as a TODO, placeholder, stub or mock.

## 10. Stay in scope

- Change what the request needs and nothing else. No drive-by rewrites.
- Do not invent requirements. No limit, field, option, check or error the spec does not name. If you think one is needed, say so in your report instead of building it.
- Stop when the request is met. More code than the request needs is not more quality.
- The project's way wins over yours: its style, formatter, linter, folder layout and the way it already solves the same kind of problem. One codebase has one way to do one thing.
- A change that restructures and a change that alters behavior are never in the same commit.

## 11. Leave nothing behind

When a change replaces something, the old thing is deleted in the same task. There is never a second way to do one job.

- Delete what your change made unused: the old function, its tests, its fixtures, its imports, its config, its end-to-end journey.
- Delete what your change duplicated: two functions, two tests or two journeys that do or prove the same thing become one.
- Keep nothing "just in case": no commented-out code, no old version beside the new one, no flag that keeps the old path alive, no wrapper that only forwards to a new name. Git keeps the history.
- The one exception is something other people depend on, when the spec gives it a date to go. It carries the language's deprecation marker until then, and nothing new uses it.
- This covers product code, unit tests, end-to-end journeys, fixtures and test helpers alike.
- Dead or duplicated code that your change did not cause is not fixed silently. List it in your report so it becomes its own task.

Prove it. In the code map, everything you added sits inside a block, or starts one because it is a real entry point, and nothing you replaced still has a line. The project's unused-code and duplicate checks stay clean: knip, vulture, `deadcode`, clippy, jscpd, whichever it has.

## 12. Never cut safety to be short

Input validation, permissions, guards against data loss, accessibility, and anything the spec requires all stay.

## Instead of this, write that

| Instead of | Write |
|---|---|
| a filter squeezed into one expression that wraps over three lines | a loop, a condition and an add, each on its own line |
| a function that takes a list of loose records and returns a loose record | one that takes a list of `Product` and returns a `ProductPage` |
| `(total + size - 1) / size` with whole-number division | the named round-up function |
| three conditions nested inside each other before the work | each wrong case refused first, then the work, flat |
| `send(order, true, false)` | `send_receipt(order)` and `send_reminder(order)` |
| `if status == 3` or `if status == "shipped"` | `if status == OrderStatus.SHIPPED` |
| a function that changes the order it was given | one that returns a new order |
| `-1` or an empty value returned when nothing was found | an empty list, or a return type that says it may be missing |
| `timeout = 30` and `price = 19.99` | `timeout_seconds = 30` and `price_cents = 1999` |
| a catch for every error that does nothing | catch the one error you can handle, and let the rest stop the program |
| a raw input field read and converted deep inside the logic | the input turned into an `Order` once at the edge, then `order.price_cents` |
| the clock read inside a business rule | `today` passed in as an input |
| `print(apply_coupon(order_total(order), percent))` | `total = order_total(order)`, then `discounted = apply_coupon(total, percent)`, then `print(discounted)` |
| arguments picked out of the command line by position | the standard argument parser, or the language's well-known one where the standard library has none. Options work in any position, as in every other tool. |
| a checking function for every field of the input | one schema, or the typed value's own constructor |
| `MAX_QUANTITY = 1_000_000` when the spec names no limit | no limit, and a line in your report asking whether one is wanted |
| `data`, `tmp`, `handle_stuff`, `_process2` | the real names |

## In every language

Each language has its own way to break these rules. The rule is the same everywhere:

- Do not crash on purpose. No forcing open a value that may be missing, no assertion used as error handling. Return the error to the caller.
- An error is a named kind of failure, with the values that explain it. Never a bare string, never the catch-all error type.
- Do not copy data to dodge the question of who owns it or who may change it. Decide the owner, and lend it to the rest.
- Do not switch the type checker off: no cast, no "any" type, no ignore marker.
- Do not silence the linter or the compiler. Fix what it points at. When one of them asks for a form, use that form.
- Do not start work that nobody waits for. Whoever starts a background task owns it and sees it end.
- Follow the language's own official style and its standard tools for formatting, linting and testing. Idioms of the language win over habits brought from another one.

## Before you commit

Read your whole diff from top to bottom, the way the reviewer will. Fix every yes. The tests must still be green after.

- Can a line go? Can a block become one call to something that exists?
- Is a loop hidden inside one wrapped expression or a chain?
- Is anything nested more than two levels, or longer than one screen?
- Does a function do two jobs, take more than four inputs, take a flag, or change what it was given?
- Does a signature use a loose dictionary, list or catch-all type where a named type belongs? Is any type missing?
- Is a state written as a bare string, number or pair of booleans?
- Is there a bare number or string that carries a meaning?
- Is any name unclear, shortened, negative, or prefixed with an underscore?
- Is there a comment, a print, a TODO, a broad catch?
- Is there a helper used once, or an option nobody asked for?
- Does a smell from `tiger-design-principles` show: two reasons to change in one place, a rule with two homes, a reach through three objects, a part nobody needs yet?
- Did I build a limit, a check or a rule the request never named? Is there more code here than the request needs?
- Is there a query or a request inside a loop, a search inside a loop, or data loaded that is never used?
- Is an address, a credential or a limit written in the code instead of read as a setting?
- Is an error logged and then passed on, or a log line that holds a secret or a whole record?
- Did this change leave anything unused or doubled, in the code, the tests, the fixtures or the journeys?
