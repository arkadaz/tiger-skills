---
name: tiger-decision-tree
description: Find every case of a request before anything is built, and draw it as a tree a person can inspect. List the conditions a rule depends on, branch on every answer each can have including the edges, and follow every path to its result. A path whose result nobody has stated is a question for the user. The drawn tree is shown to the user, becomes the Cases section of the spec, and its leaves become the rows of the tests. Use at the start of every request that changes behavior, when interviewing the user, when writing a spec or tests, and when reviewing whether every case is covered.
---

# Decision tree

Edge cases are not thought up. They are derived. A request names the normal case; the bugs live in the cases nobody mentioned. The tree finds them before any code exists, while a question still costs one sentence.

It is always drawn. A person must be able to look at it and see every case, which ones were decided for them, and which ones are still open.

## Build it

1. **Conditions.** Write what the result depends on: each input, each piece of stored state, who is asking, and what the outside world may do.
2. **Answers.** Under each condition, write every answer it can have, edges included:

| For a | Always include |
|---|---|
| number | below the limit, on the limit, above it, zero, negative |
| text | empty, only spaces, very long, other letters and symbols |
| list | none, one, many, a duplicate |
| value that may be missing | present, missing |
| state | every state it can be in, also the ones the request did not mention |
| who is asking | allowed, not allowed, not signed in |
| outside system | answers, answers slowly, fails, answers twice |
| time | before, exactly at, after |

3. **Draw.** One level per condition, one branch per answer, and every path followed to a leaf.
4. **Results.** At each leaf, write the result and where it came from.
5. **Cut.** Keep only what this request can change. A condition that plays no part in it is left out, not drawn. A single branch that cannot happen stays, marked so, with the reason.

## Keep it easy to inspect

The drawing is for a person to check in a minute. A tree nobody can read finds nothing.

- Draw only what this request changes. Everything that stays as it is today is one closing line under the tree: `unchanged: paging, the empty result, the caller's own list`.
- A leaf fits on one line of about a hundred characters. The result is a few exact words. The full rule, with its example, goes in the spec under Behavior.
- Past about twenty leaves, draw one tree per rule, each with its own heading.
- Under the drawing, list the open leaves as numbered questions, each with the answer you recommend. Then list the `[default]` leaves in one line, so the user sees what was decided for them without hunting.

## How to draw it

Inside a code block, with these lines, so it reads the same in a chat, a terminal and a file:

```
page size?
├─ below 1 ................ refused, the size in the message      [request]
├─ 1 to 100
│  └─ items?
│     ├─ none ............. 0 pages                               [code]
│     ├─ an exact multiple  items divided by size                 [code]
│     └─ not a multiple ... one page more                         [code]
├─ above 100 .............. refused, the size in the message      [request]
└─ not a whole number ..... ? OPEN                                [ask]
```

- A condition is a question and ends with `?`.
- A branch is one answer to it.
- A leaf is the answer, then the exact result, then where the result came from, in brackets.
- The most important condition is at the top.
- When the top condition is itself `? OPEN`, draw the tree under its recommended answer, put a line under the drawing that says so, and redraw it once that answer is in. Never leave the tree without a drawing.
- Non-ASCII labels (Thai, Chinese, emoji) make the dotted leaders drift. Count characters, not bytes, and pad the leader so the result column starts at the same character in every row. Where that is not possible, shorten the label rather than let the columns break.

| Mark | Means |
|---|---|
| `[request]` | the user said so |
| `[code]` `[docs]` | the project already does or says this |
| `[docs v2]` | answered in an earlier version, by the docs or by the user |
| `[user]` | the user answered a question about it |
| `[default]` | you chose it. The user must be able to see every one of these. |
| `? OPEN  [ask]` | nobody has answered. It is a question. |
| `x cannot happen: <why>` | cut, with the reason |

## An open leaf is a question

It is closed in one of three ways, in this order:

1. The living docs, the code or the tests already answer it, including an answer the user gave in an earlier version. Use that, and mark it `[code]`, or `[docs v<N>]` with the version the answer came from. A question the user already answered is never asked again. When this request would change that answer, it is asked once more, with the earlier answer shown.
2. It changes what gets built, or it is on the "Always ask" list of `tiger-grill`. It is a question for the user, asked as that skill says, and marked `[user]` once answered.
3. It is cheap to change later and the user will not notice it. Choose the safe result and mark it `[default]`.

Never close a leaf silently. A tree with no `? OPEN` left is finished.

## Where the tree goes

- **To the user**, in the chat, when it is first drawn and again when it is finished. It is what they look at to say yes.
- **Into the spec**, as its Cases section, exactly as drawn.
- **Into the tests**: each leaf is one row of one table-driven test. A leaf is not a separate test.
- **Into the version's page for people**, when the version closes, so the cases can still be inspected after the spec is gone.
- **Again, from scratch, by the reviewer**, from the request alone. A leaf missing from the spec or from the tests is a finding.
