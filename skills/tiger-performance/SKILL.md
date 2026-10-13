---
name: tiger-performance
description: Performance first, the way a principal engineer does it, in any language. Know how big the data is and how often the code runs, then get the big things right from the first line - the cost of each operation, the number of round trips to the database or network, memory that does not grow without limit - and leave tricks until a measurement asks for them. Each with its smell and its fix. Use when designing or writing anything that loops over data, talks to a database, a network or a disk, renders a list, or has a speed or size requirement, and when reviewing such code.
---

# Performance

Performance is decided in the design, not added afterwards. The big wins are free: the right data structure, one round trip instead of a hundred, not loading what you do not need. They cost nothing in clarity, so they are made from the first line, every time.

Tricks are different. Anything that makes the code harder to read waits for a measurement that proves it is needed.

## Before you write

1. Know the size. How many items today, and how many in a year: ten, ten thousand, ten million? How often does this run: once a day, or on every request?
2. Know the limit. How fast must it answer, and how much memory may it use? A number in the spec is an acceptance criterion. No number means "do not be wasteful", not "do not care".
3. Count the cost. For each step, how does its work grow as the data grows: not at all, in step with it, or with its square? And how many times does it leave the process to reach a database, a network or a disk?

Write the size and the limit in the spec under Design. Code written without knowing the size is a guess.

## Always, from the first line

### The cost of each step

| The smell | The fix |
|---|---|
| a loop inside a loop over the same large collection | build a lookup once, then one pass |
| searching a list for a match inside a loop | a set or a map keyed by what you look up |
| the same value worked out again on every pass | work it out once, before the loop |
| sorting, parsing or compiling the same thing repeatedly | do it once and keep the result |
| building a long text or a list by re-copying it each time | the builder or the join made for it |
| doing all the work when the caller needs the first few | stop early, or produce results as they are asked for |

### Leaving the process

Reaching a database, a network or a disk costs thousands of times more than work in memory. Count the round trips first.

| The smell | The fix |
|---|---|
| a query or a request inside a loop | one query or one batched request for all of them |
| fetching rows and then filtering, sorting, counting or joining them in code | let the database do it, in the query |
| fetching every column and every row | only the columns used, a page at a time |
| a filter or a join on a column with no index | an index for every lookup that runs often |
| paging by skipping rows in a large table | page from the last key seen |
| several independent requests made one after another | start them together and wait for all |
| a new connection for every call | the pool or the shared client |
| a call with no time limit | a timeout on every call that leaves the process |
| the same slow answer fetched again and again | fetch once per request and pass it on. A cache only when a measurement asks for it, with a clear rule for when it goes stale. |

### Memory

| The smell | The fix |
|---|---|
| reading a whole large file or result set into memory | read and handle it in pieces, as a stream |
| building a full list only to loop over it once | produce items one at a time |
| a list, a map, a queue or a cache that only grows | a size limit, and a rule for what leaves |
| copying a large value to pass it along | lend it. Copy only when it must change separately. |

### Screens

| The smell | The fix |
|---|---|
| drawing ten thousand rows | pages, or only the rows on screen |
| redrawing everything when one value changes | redraw only what depends on it |
| a request on every key press | wait until the typing pauses |
| loading every script and image at the start | load what the first screen needs, the rest when asked |
| work on the thread that draws | move it off, so the screen stays live |

## Only with a measurement

Caching, running things in parallel, a hand-made data structure, skipping a safety check, anything clever. For each of these:

1. Write one repeatable command that measures it, and record the number.
2. Find the slow part with a profiler or a timer. Never by guessing: the slow part is rarely where you think.
3. Change one thing. Measure again.
4. Keep the change only if the number moved enough to matter and the tests pass. Otherwise undo it.

## Prove it

- A speed or size limit in the spec has a check that measures it and fails when it is missed.
- Code that reaches a database has a test that counts the queries, so a query in a loop shows as a failure.
- Code that loops over data is run once at a realistic size before it is called done. A step that grows with the square is invisible at ten items and fatal at a million.
- Never trade correctness for speed. A fast wrong answer is a bug.
