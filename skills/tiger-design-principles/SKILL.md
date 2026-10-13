---
name: tiger-design-principles
description: The design principles a principal engineer shapes code with, in any language - start simple, one reason to change, one home for every rule, low coupling, hide what varies, small interfaces owned by the caller, composition over inheritance, no surprises, contracts and invariants, and choosing what is easy to undo. Each with the smell that shows it is broken and the fix. Use when designing a change, deciding where something belongs or how to split it, and when reviewing the structure of code.
---

# Design principles

How a principal engineer decides the shape of code: what goes together, what stays apart, and what depends on what. `tiger-code-quality` is about how the lines read. This is about the structure they sit in.

A principle is a tool, not a law. Reach for one when its smell is in front of you. Applying a principle where nothing smells adds parts nobody needs, and that is a defect too.

## Start simple

| Principle | The smell | The fix |
|---|---|---|
| Keep it simple | a reader needs a diagram to follow one request | fewer parts. Remove the layer that only passes things along. |
| You are not going to need it | code for a case nobody asked for: a plug-in point with one plug-in, a setting with one value, an input always given the same value | delete it. Add it the day the second case arrives. |
| Work, then right, then tuned | tricks for speed before it is correct, polishing before it works | make the test pass with plain code on the right data structure, then clean it. Speed that needs a trick waits for a measurement: see `tiger-performance`. |
| Wait for the third | a shared abstraction built from one or two cases | let two cases stay separate. Extract when the third shows what really differs. |

## What goes together

| Principle | The smell | The fix |
|---|---|---|
| One reason to change | you need "and" to say what it does. A change to the tax rule and a change to the file format land in the same function. | split by reason to change: reading, deciding and saving are three things |
| Things that change together live together | one small change means editing five files | move those pieces into one place |
| One home for every rule | the same rule, limit or formula written in two places that must be edited together | one function or constant owns it and the rest call it. Two pieces of code that only look alike are not this: leave them. |
| A module is about one thing | a module called "common" or "misc", whose functions share no data and no purpose | move each function next to the data it works on |

## What stays apart

| Principle | The smell | The fix |
|---|---|---|
| Low coupling | changing one module forces edits in many others | pass in what is needed instead of reaching out for it |
| Hide what varies | the same ladder of `if kind is ...` in several places, or callers reaching into another module's fields | put that decision in one place, behind one function |
| Talk only to close neighbours | a chain that walks through three objects to reach a value | ask the nearest one for what you need, by a name that says the intent |
| Depend only on what you use | a function takes a whole record to read one field, or an interface has ten operations and each caller uses two | take the value itself, or a small interface with just those operations |
| The inside owns the interface | a business rule imports the database, the network or the framework | the rule states the small interface it needs and the outside implements it. This is a port: see `tiger-hexagonal`. |
| Ask or act, not both | a function named like a question changes something, or one that changes something also returns unrelated data | a function either answers or acts |

## How parts relate

| Principle | The smell | The fix |
|---|---|---|
| Compose, do not inherit | a type extends another to reuse one operation, or a tree of subtypes three deep | hold the other thing and call it |
| A subtype keeps every promise | a subtype that answers "not supported", or call sites that check which subtype they got | it honours everything the parent promised, or it is not a subtype |
| Add a case without editing the others | every new kind means editing the same long branch in several places | once a third kind exists, give each kind its own piece behind one interface. Not before. |

## Promises

| Principle | The smell | The fix |
|---|---|---|
| Say what you need | a function quietly misbehaves on input it was never meant for | refuse it at the top, or make the bad input impossible to build |
| Keep what you promise | callers check the result again because they do not trust it | the function guarantees it, and a test proves it |
| No impossible states | a value can be put in a state that should not exist, such as a paid order with no payment | the one way to build it sets it right, and every change keeps it right |
| No surprises | a function that does more than its name says, a "get" that writes, a default that deletes | the name says everything it does. Nothing happens on the side. |

## Choosing between designs

- Prefer what is easy to undo. A data format, a public interface and a dependency that many modules import are hard to undo: keep each behind one seam and write the reason in the spec under Decisions.
- Every design gives something up. Write, in one line, what you chose and what you gave up.
- Code that is hard to test has the wrong shape, not the wrong test. It does too much or reaches too far.
- Put a seam where the code has already had to change twice, not where it might.
- The boring, well-known way the project already uses beats a clever new one.

## When principles pull apart

Simple beats reusable. Clear beats short. Working today beats flexible tomorrow. The reader's time beats the writer's.
