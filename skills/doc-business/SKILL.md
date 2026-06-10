---
name: doc-business
description: Author or refresh business.html — the HUMAN-facing business case for a feature (self-contained HTML, opens in a browser). Owns the section structure (problem in business terms, who benefits, value/impact, success metrics, scope summary) and a readability gate. Invoked by harness-engineering-grill up front, and refreshed by the update-docs step at ship. Human-facing .html — agents do NOT read it (they use specs.md); it exists for the stakeholder. This skill is rigid — follow the form exactly.
---

# doc-business — the `business.html` format authority

`business.html` is the **stakeholder-facing** case for a feature: *why it's worth building*, in business language, with no code. It is **HTML** (self-contained, opens in a browser) precisely because its audience is **you / the stakeholder**, not the agents — pipeline agents read the lean `specs.md` instead, so business context never bloats their context window.

One file per feature: `business.html` (or `docs/business/<feature-id>.html` in a multi-feature repo).

## Cheat sheet — canonical structure (self-contained HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Business Case — {Feature Title}</title>
<style>
  body{font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
  h1{font-size:1.6rem;margin-bottom:.2rem} h2{font-size:1.05rem;margin-top:1.8rem;border-bottom:1px solid #eee;padding-bottom:.25rem}
  .meta{color:#666;font-size:.9rem;margin-top:0} table{border-collapse:collapse;width:100%;margin:.5rem 0}
  th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left} .target{font-weight:600}
</style>
</head>
<body>
  <h1>{Feature Title}</h1>
  <p class="meta">Feature {feature-id} · {YYYY-MM-DD} · audience: stakeholders</p>

  <h2>The problem (in business terms)</h2>
  <p>{Who is hurting today and how — described in outcomes, not code or tables.}</p>

  <h2>Who benefits</h2>
  <p>{Primary user/role and the concrete outcome they gain.}</p>

  <h2>Value &amp; impact</h2>
  <ul>
    <li>{Value 1 — tied to a business outcome}</li>
    <li>{Value 2}</li>
  </ul>

  <h2>Success metrics</h2>
  <table>
    <tr><th>Metric</th><th>Today</th><th>Target</th></tr>
    <tr><td>{metric}</td><td>{baseline}</td><td class="target">{target}</td></tr>
  </table>

  <h2>Scope summary</h2>
  <p>{One paragraph: what's in, and what's explicitly out (so expectations are set).}</p>
</body>
</html>
```

## Rules
- **No implementation detail.** No file names, no function names, no schemas. If a sentence only means something to an engineer, it belongs in `specs.md`/`adr.md`, not here.
- **Self-contained** — inline CSS only, no external assets, so double-clicking the file just works.
- **Refreshed at ship** — the update-docs step updates the metrics/scope to reflect what actually shipped.

## Readability gate — test the form before calling it done
- [ ] Opens in a browser and renders cleanly (valid HTML, inline styles).
- [ ] A non-technical stakeholder understands it end to end — no jargon, no code.
- [ ] Every section is present and non-empty.
- [ ] Success metrics have a baseline and a concrete target (no "improve performance").
- [ ] Scope summary states what's explicitly out.
