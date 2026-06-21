---
name: tiger-docs-adr
description: Focused writer that authors ONE feature's adr.html from the decisions surfaced during grill — applying the three-part test (hard to reverse, surprising without context, a real trade-off), MADR form when ≥2 real options were weighed, the lightweight Nygard form for tactical calls, and a single "no decisions met the bar" entry when none qualify — instantiating tiger/templates/adr.html into tiger/features/<id>/adr.html with the awaiting_review token. Never approves. A self-contained reference skill; invoke it directly or load it as one of grill's skills to record an ADR.
---

# Tiger Docs — ADR Writer

Writes `tiger/features/<id>/adr.html` from decisions surfaced during grill. No owned agent — grill loads this skill and authors the file inline.

## When to use

- Grill loads it automatically to produce `adr.html` after the interview.
- Invoke standalone to record an architecture decision: "record an ADR for `<id>`: we chose X over Y because …".

## Contract

**Three-part bar** — record an ADR entry only when ALL THREE hold: (1) hard to reverse, (2) surprising without context, (3) a real trade-off with genuine alternatives.

| Condition | Form |
|---|---|
| ≥2 real options weighed | **MADR**: status/date/decision-makers · Context & Problem · Decision Drivers · Considered Options · Decision Outcome (Consequences: "Good, because …" + "Bad, because …" required) · Confirmation (cross-link e2e case id when one covers it) · Pros & Cons |
| Tactical / single option | **Nygard**: Title / Status / Context / Decision / Consequences |
| Nothing met the bar | Single entry: `"No decisions met the ADR bar this grill — <one-line reason>"` |

- Carry `<meta name="tiger-status" content="awaiting_review">` — never flip the approval token.
- Follow `docs/tiger-doc-style.md` (self-contained, inline CSS, zero external requests).
- Needs: project dir, feature id, decision content, today (`YYYY-MM-DD`).

## Works with

grill (loads + authors) → **tiger-docs-adr** produces `adr.html` → architect reads it as a PLAN input.

## Git interactions

- **Under grill:** write only; grill's single approval commit owns the file. Do not commit.
- **Standalone:** `git add tiger/features/<id>/adr.html && git commit -m "docs(<id>): adr"`. Never touch the board, other artifacts, code, or notes.

## Standalone use

Invoke with feature id + decision content. Writes `adr.html` as `awaiting_review` and stops. Report the path written. Does not interview, approve, plan, or code.
