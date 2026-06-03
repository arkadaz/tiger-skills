---
event: PreToolUse
tool: Agent
permission: allow
---

PRE-AGENT-SPAWN GATE: Before spawning a pipeline agent (explorer, planner, code-architect, generator, executor, healer, reviewer, scribe), confirm the conductor gates are satisfied: (1) GATE 1 — for a build request, an approved spec exists (else run harness-engineering:grill first), (2) GATE 2 — a live phase ledger exists for this task, (3) GATE 4 — exactly one feature is in_progress (WIP=1). If spawning the generator/executor, confirm the planner's task breakdown was persisted into feature_list.json tasks[] by the scribe (GATE 5c). Remember: only the scribe writes feature_list.json and progress.md — other agents emit a Board Update for it to apply. Do not skip gates to reach the pipeline faster.
