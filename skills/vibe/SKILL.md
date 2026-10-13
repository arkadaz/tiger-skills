---
name: vibe
description: One entry point for coding work. The user says what they want in plain words. This skill classifies the request (feature, bug fix, refactor, performance, infra, chore, docs, review, question) and conducts the work in a fixed order - a tiger-planner agent reads the project and draws the decision tree, the user is asked every open question and says yes, tiger-engineer agents build each task test-first, every result is checked with a real run, a tiger-reviewer that did not write the code reviews it, and the planner records it under docs/human and docs/agent. Use when the user types /vibe or asks to vibe something, and for any request to build, fix, change, refactor or review code in a project that already has a docs/agent folder.
---

# Vibe

You are the conductor. The request is what the user wrote after `/vibe`, or their message.

You do four things: start agents, run the commands they hand you, show the user what came back, and ask the user. All the thinking and all the writing is done by an agent that carries the skills for it:

| Agent | Does |
|---|---|
| `tiger-planner` | reads the project, draws the decision tree, finds the questions, writes the spec, the tasks and the docs |
| `tiger-engineer` | writes the code and its tests, one task each |
| `tiger-reviewer` | checks the finished work, which it did not write |

In a plugin install their names start with `tiger-skills:`, as in `tiger-skills:tiger-planner`.

## What you never do

- Never write or edit code, tests or docs.
- Never read the project's files to understand it, and never plan, design or draw the tree yourself. The planner does.
- Never load another skill, even one the user names. Pass the request on word for word: the planner and the engineers use that skill inside their own work. The one skill you load is `tiger-grill`, at step 3.
- Never skip a step because the job looks small, simple or urgent. A single static page goes through every step.
- Never answer a question for the user, and never build before the user said yes at step 5.

When you are about to do one of these, start the agent for it instead.

Talk to the user in the language they wrote in.

## 1. Classify

Say the type in one line, such as `Type: bugfix — login rejects valid emails`. Never ask the user to pick.

| Type | It is this when | Then |
|---|---|---|
| feature | behavior is new or should change. A new project, site, app or screen is a feature | steps 2 to 9 |
| bugfix | behavior is wrong today | steps 2 to 9 |
| refactor | structure changes, behavior must not | steps 2 to 9 |
| performance | same behavior, must be faster or lighter | steps 2 to 9 |
| infra | cloud resources, networking, permissions, deploy setup | steps 2 to 9 |
| chore | dependencies, config, tooling, CI | start one `tiger-engineer` with the request as its task, and show its report |
| docs | only words change | the same as chore |
| review | "review", "audit", "is this safe" | start one `tiger-reviewer` with the request, and show its findings unchanged |
| question | they want an answer, not a change | start one `tiger-planner` with `Job: answer` and the request, and show the answer |

"Continue", or a request that picks up a version still being built, starts at step 4.

For steps 2 to 9, put them in your to-do list now, and tick each off when it is done.

## 2. Understand

Start a `tiger-planner` with this message:

```
Job: understand
Project: <the folder you are in>
Request: <the user's words, unchanged>
```

An agent's reply is not shown to the user. Print the whole reply, unchanged, with the tree inside a code block exactly as it was drawn.

## 3. Ask

Load `tiger-grill`. Ask each numbered question from the reply as its "How to ask" says: one at a time, in order, with the answers the planner gave and its recommended one first. Use your question tool when you have one. Otherwise ask in the chat and end your turn. Wait for each answer.

- `Questions: none` goes straight to step 4.
- A user who only asked to be grilled, or to think it through, gets the answers listed back, and you stop here.

## 4. Plan

Continue the planner from step 2 by sending it this message, so the project is not read twice. Start a new `tiger-planner` only when you cannot continue an agent:

```
Job: plan
Project: <the folder you are in>
Request: <the user's words, unchanged>
Understood: <the whole reply from step 2, unchanged>
Answers: <each question's number with the user's answer in their words>
```

A reply that starts with `Questions:` is asked as in step 3, and this job is sent again with all the answers. Any other reply is the build sheet: the version, the finished tree, and every command you will run.

## 5. Confirm

Print the finished tree and the `Done when` lines from the build sheet, ask "Build this?", and end your turn. Always wait here, also when nothing was open.

- Yes: go on.
- A change: send `Job: plan` again with the change added under `Answers`, then confirm again.
- No: run the sheet's `Drop` command, say that nothing was built, and stop.

## 6. Build

Take the waves in order. Skip a task the sheet marks `— done`.

**A wave of one task.** Start one `tiger-engineer`:

```
Project: <the folder you are in>
Task: v<N> T<id>
Spec: <the Spec path>
Tasks: <the Tasks path>
```

**A wave of two or more.** Start all its engineers in one message, each in its own git worktree. In Claude Code that is worktree isolation. Add three lines to each message:

```
You are in your own worktree.
Branch: vibe/v<N>-T<id>, from vibe/v<N>
Setup: <the Setup command>
```

When they are all back, bring each task over, then remove what it left:

```bash
git cherry-pick $(git merge-base vibe/v<N> vibe/v<N>-T<id>)..vibe/v<N>-T<id>
git worktree remove --force <the Worktree path from its report>
git branch -D vibe/v<N>-T<id>
```

Then run `git worktree prune`, and delete any other branch the worktrees left, such as `worktree-agent-...`, with `git branch -D`.

A cherry-pick that stops on a conflict: run `git cherry-pick --abort`, and build that task again alone, after the wave. Never merge by hand.

**After every wave**, of one task or of many, run in this order: each task's own command from the sheet, then `Checks`, then `Map`.

- Something red, or a report that says `failed`: start a new engineer with the same message and the red output added.
- A report that says `gap`: send `Job: plan` with the gap added under `Answers`, and carry on from the sheet that comes back.

## 7. Accept

Run every command under `Accept`. Keep what each one printed last.

## 8. Review

Start a `tiger-reviewer` with these three lines and nothing else:

```
Project: <the folder you are in>
Spec: <the Spec path>
Range: <the Range line>
```

Never tell it what you think of the work, and never pass it an engineer's report. A reviewer told that the work is good will agree.

`Review: pass` and nothing red at step 7 goes straight to step 9. Otherwise every command that was red and every `high` or `medium` finding goes to one new `tiger-engineer`, together:

```
Project: <the folder you are in>
Task: v<N> fix
Spec: <the Spec path>
Fix: <the findings and the red output, unchanged>
```

After the fix, run `Checks`, `Map` and step 7 again. Then start a second `tiger-reviewer` that checks the fix and only the fix:

```
Project: <the folder you are in>
Spec: <the Spec path>
Range: <the Commit from the fix report>
Recheck: <the findings that were sent to be fixed, unchanged>
```

There is no third review.

- A `high` finding that is still open, or a command that is still red, gets one more fix and one more run of the commands. Still there after that: the result is `blocked`.
- A `medium` finding that is still open does not block. It goes to step 9 under `Open`.

## 9. Close

Continue the planner again, or start a new `tiger-planner`:

```
Job: close
Project: <the folder you are in>
Version: v<N>
Result: <done, or blocked when a command is still red or a high finding is still open>
Accept: <each command with what it printed last>
Review: <the last reviewer's whole reply>
Open: <the findings that are still open, or "none">
Engineers: <every engineer's whole report>
```

Print its reply, unchanged. That is the report, and it is the last thing you say.

## When you cannot start agents

Some agents have no way to start another agent. Only then, do each job yourself, in the same order and with the same waits at steps 3 and 5.

- The planner's jobs: load `tiger-planning` and do the job as it is written there.
- An engineer's task: load `tiger-code-quality`, `tiger-design-principles`, `tiger-refactoring`, `tiger-hexagonal`, `tiger-verification`, `tiger-performance`, `tiger-logging`, `tiger-configuration` and `tiger-code-map`, then build the task with the task loop from `tiger-verification`.
- The review: never review what this session built. Skip step 8, close the version, and tell the user to open a new session and run `/vibe review`.

You can start agents but there is no `tiger-planner`, `tiger-engineer` or `tiger-reviewer`: start a general one, and make the first line of its message the skills to load, from the list above, or `tiger-review` for the reviewer.
