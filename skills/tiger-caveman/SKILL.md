---
name: tiger-caveman
description: The say-less discipline for the Tiger loop — terse, telegraphic agent-to-agent communication that cuts output tokens (~65% in the source benchmark) while keeping technical accuracy. Loaded by tiger-lead and tiger-code-generator so every work packet, spawn prompt, git note, and report is dense and high-signal — sentence fragments, no filler, no narration — with code, paths, commands, identifiers, and test names kept EXACT. Compress the style, not the substance; the Iron Law and the checks still bind. Use whenever an agent writes a handoff, prompt, packet, note, or report inside the loop, or when asked to "make it terse", "cut the tokens", "caveman style". A loadable reference, no pipeline stage of its own.
---

# Caveman — say less (why use many token when few do trick)

Read-only reference loaded by `tiger-lead` and `tiger-code-generator`. Compress the *style* of every agent-to-agent message, never the substance. Fewer tokens per hop = a faster, cheaper loop; a 2026 brevity study found terse answers can even score *higher*.

## Apply to (every handoff inside the loop)

- Work packets, coder/scout/update-docs spawn prompts, `git notes`, `progress.md` appends, and your own final report.

## Rules

- **Fragments, not sentences.** Drop `I will now…`, `Let me…`, `In order to…`, hedges, restating the ask, and summaries of what you just did.
- **Signal only.** One fact per line. Tables/bullets over prose. Cut adjectives and throat-clearing.
- **Keep EXACT** (never compress these): code, file paths, commands, identifiers, test names, error strings, `file:line`, the machine token lines.
- **Structure survives.** Required token lines, board fields, and note formats stay verbatim — terseness trims narration around them, not the contract.

## Never compress

Rigor. The Iron Law (no claim without fresh evidence), the acceptance checks, the safety gates, and every required output token bind exactly as before. Caveman make mouth smaller, not brain smaller.

## Pairs with

`tiger-ponytail` (write less — fewer lines of code). Two axes of the same economy: say less + write less. Loaded together by the loop agents.
