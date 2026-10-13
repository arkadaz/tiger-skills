---
name: tiger-grill
description: Interview the user until a request is clear enough to build and test. One question at a time, each with a recommended answer, reading the code first and using a decision tree to find the cases nobody has answered yet. Ends with exact rules, exact error cases and acceptance criteria the user confirmed. Use when a request is vague, large or risky, when the user says "grill me" or asks to clarify or think something through, and before building anything where a wrong guess is expensive.
---

# Grill

A vague request builds the wrong thing. Ask until every answer is exact enough to test, then stop.

Only the session that talks to the user can do this. Never hand it to a spawned agent.

## How to ask

- Read first. Whatever the code, the docs or `docs/agent/memory.md` can answer is not a question.
- One question at a time. Never a list.
- Give two to four answers to pick from, and say which one you recommend and why.
- Use your agent's question tool when it has one. Otherwise ask in chat and wait.
- Ask only what changes what gets built. If every answer leads to the same code, do not ask.
- Push back: on a contradiction, show the two things that disagree; on scope growing, offer to split it into another version.
- A quick "just build it" is not an answer to a question that is still open. Choose the safe default, say so, and write it under Decisions.

## What must be closed

Go down the list. An item is closed when its answer is a number, a name or an exact sentence, not an adjective. Mark an item that does not apply as `n/a` with the reason.

| Item | Closed when you can say |
|---|---|
| goal | who needs what, and what they can do afterwards that they cannot do now |
| happy path | each step: what the user does, what the system answers |
| rules | each rule with its real values: the formula, the limit, the rounding, what wins on a conflict |
| errors and edges | the result of every path of the decision tree |
| data and outside systems | what is stored, who owns it, what happens when the other system is down |
| who is allowed | who can do it and who cannot |
| limits | what must not change, what is out of scope |
| acceptance | how we will see that it works, as given, when, then with real data |

## Find the questions with a decision tree

Build the decision tree from `tiger-verification` for each rule. Every path whose result nobody has stated is your next question. This finds the cases the user did not think of, which are the ones that go wrong.

## Always ask

Never choose a default for these. Stop and ask, even when the user is in a hurry:

- money: prices, rounding, refunds
- who is allowed: login, roles, reaching other people's data
- personal data
- deleting or overwriting data
- a public API or a file format other people depend on
- a change that cannot be undone

## Finish

1. Write the answers into the spec as you go: Behavior, Errors and edges, Acceptance, Decisions.
2. Read the acceptance criteria back in plain words, in ten lines at most.
3. Ask one last question: "Is this what you want built?" Build only after a yes. A change of mind reopens the item it touches.

If the user only wants to think it through, do the interview and write nothing.
