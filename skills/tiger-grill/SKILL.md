---
name: tiger-grill
description: Interview the user until a request is clear enough to build and test. One question at a time, each with a recommended answer. The questions are the open leaves of the decision tree, found after reading the code, never guessed. Ends with exact rules, exact error cases and acceptance criteria the user confirmed. Use when a request is vague, large or risky, when the user says "grill me" or asks to clarify or think something through, and before building anything where a wrong guess is expensive.
---

# Grill

A vague request builds the wrong thing. Ask until every answer is exact enough to test, then stop.

Two jobs are in here. Finding the questions is done by whoever plans: in `/vibe` that is the planner, and it hands over numbered questions with the answer it recommends. Asking them is done by the session that talks to the user: a spawned agent cannot.

## How to ask

- Handed questions by a planner: ask exactly those. Do not read the code to look for more. A new question that comes up goes back to the planner.
- One question at a time. Never a list.
- Give two to four answers to pick from, the recommended one first, with why.
- Use your agent's question tool when it has one. Otherwise ask in the chat, end your turn, and wait.
- Take the answer in the user's own words. Do not improve it.
- Push back: on a contradiction, show the two things that disagree; on scope growing, offer to split it into another version.
- A quick "just build it" is not an answer to a question that is still open. Take the recommended answer, say so, and record it as decided for them. Never for something under "Always ask".

## What to ask

- Read first. Whatever the living docs, the code map, the code or the tests can answer is not a question. Nor is what a skill's rule already decides, such as moving the code into its layers.
- Draw the tree with `tiger-decision-tree` for each rule in the request, before the first question. Every leaf whose result nobody has stated is a question. This finds the cases the user did not think of, which are the ones that go wrong.
- Ask only what changes what gets built. If every answer leads to the same code, do not ask.
- Order them by how much they change what gets built.

Go down this list. An item is closed when its answer is a number, a name or an exact sentence, not an adjective. An item that does not apply is `n/a` with the reason.

| Item | Closed when you can say |
|---|---|
| goal | who needs what, and what they can do afterwards that they cannot do now |
| happy path | each step: what the user does, what the system answers |
| rules | each rule with its real values: the formula, the limit, the rounding, what wins on a conflict |
| cases | the result of every leaf of the decision tree |
| what is seen | for anything with a screen: what is on it, what moves, and what it should look like, as a reference the user named or picked |
| data and outside systems | what is stored, who owns it, what happens when the other system is down |
| who is allowed | who can do it and who cannot |
| limits | what must not change, what is out of scope |
| acceptance | how we will see that it works, as given, when, then with real data |

## Always ask

Never choose a default for these. They are questions, even when the user is in a hurry:

- money: prices, rounding, refunds
- who is allowed: login, roles, reaching other people's data
- personal data
- deleting or overwriting data
- a public API or a file format other people depend on
- a change that cannot be undone
- a new product or screen with nothing to go on: who it is for, what they do there, and how it should look and feel

## Finish

1. The answers go into the spec: Behavior, Design, Cases, Acceptance, Decisions. Each leaf of the Cases tree says where its result came from.
2. Show the finished tree and the acceptance criteria in plain words, in ten lines at most.
3. Ask one last question: "Build this?" Build only after a yes. A change of mind reopens the item it touches.

If the user only wants to think it through, do the interview and write nothing.
