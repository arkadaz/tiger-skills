---
name: tiger-refactoring
description: How a principal engineer changes the shape of existing code without changing what it does - tests green first, one small named move at a time, a structure change never mixed with a behavior change, and the right move for each smell such as extract, inline, rename, move, split, guard, introduce a named type, remove what is dead. Use when cleaning up code, when a change is hard to make, when a function or module has grown too large, and in every refactor.
---

# Refactoring

Changing the shape of code without changing what it does. It is how code stays easy to change, and it is done in small safe moves, never as a rewrite.

## The discipline

1. The tests are green before you start. Code with no tests gets tests for what it does today first, in their own commit.
2. One small move at a time, and run the tests after each. A red test means undo that move. Do not debug forwards.
3. A commit that changes structure changes no behavior. A commit that changes behavior changes no structure. Never both.
4. When a change is hard to make, first make it easy with a refactor, then make the easy change.
5. Refactor what the task touches. The rest of the file is a leftover to report, not yours to rewrite.
6. Stop when the code is clear. A refactor that adds parts has gone the wrong way.

## The smell and the move

| You see | Do |
|---|---|
| a function too long to hold in your head | extract each step into a function named for what it does |
| a function that reads, decides and saves | split it into those phases, one function each |
| a function used once that hides nothing | inline it |
| a name that lies or says nothing | rename it |
| a function more interested in another module's data than its own | move it to that module |
| values that always travel together, or a long list of inputs | introduce a named type that holds them |
| a bare string or number that carries a meaning | replace it with a named type, an enum or a named constant |
| conditions nested three deep | refuse the wrong cases first and leave early, so the normal path is flat |
| a condition nobody can read | extract it into a yes-or-no function with a clear name |
| a yes-or-no input that switches what a function does | split it into two functions |
| the same rule written in two places | give it one owner and call that |
| the same ladder of cases in several places | one piece per case behind one interface, once there are three cases |
| one variable reused for two things | split it into two, each with its own name |
| one loop doing two jobs | split it into two loops |
| data changed from many places | return new values, and narrow who may change it |
| a comment explaining a block | extract the block into a function with that name, and delete the comment |
| a layer that only forwards calls | remove it and call the real thing |
| an interface with one implementation, an option with one value | collapse it |
| code, an input or a field nothing uses | delete it |
| one change that means editing many files | bring that rule into one home |

## Prove nothing changed

- The same tests pass after every move, unchanged. A test is edited in a refactor only to follow a rename.
- The entry points in the code map are the same before and after.
- What the program prints, returns and stores for the same input is the same.
