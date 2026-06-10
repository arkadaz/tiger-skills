---
name: doc-release
description: Author or append to release_docs.html — the HUMAN-facing release notes / changelog (self-contained HTML, opens in a browser). Owns the changelog structure (per-release: what's new, changed, fixed, breaking, upgrade notes) and a readability gate. Invoked by the update-docs step at ship time, once per wave/release. Human-facing .html — written for you, not the agents. This skill is rigid — follow the form exactly.
---

# doc-release — the `release_docs.html` format authority

`release_docs.html` is the **human-facing changelog**: what shipped, in user language, newest release on top. **HTML** (self-contained, opens in a browser) because the audience is **you and your users**, not the pipeline agents. Written **once per wave/release** by the update-docs step (Phase G), after the wave has passed verify + review.

One file, appended over time: `release_docs.html`.

## Cheat sheet — canonical structure (self-contained HTML, newest first)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Release Notes — {Project}</title>
<style>
  body{font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#1a1a1a}
  h1{font-size:1.6rem} h2{font-size:1.2rem;margin-top:2rem;border-bottom:2px solid #eee;padding-bottom:.3rem}
  h3{font-size:1rem;margin:1rem 0 .3rem} .date{color:#666;font-size:.9rem;font-weight:400}
  ul{margin:.3rem 0} .breaking{color:#b00;font-weight:600}
</style>
</head>
<body>
  <h1>Release Notes — {Project}</h1>

  <!-- newest release block; prepend a new <section> for each wave/release -->
  <section>
    <h2>{version or wave id} <span class="date">— {YYYY-MM-DD}</span></h2>

    <h3>New</h3>
    <ul><li><strong>{Feature title}</strong> — {what the user can now do, in plain language}.</li></ul>

    <h3>Changed</h3>
    <ul><li>{user-visible change}</li></ul>

    <h3>Fixed</h3>
    <ul><li>{user-visible fix}</li></ul>

    <h3 class="breaking">Breaking changes</h3>
    <ul><li class="breaking">{what breaks} — {what the user must do}.</li></ul>

    <h3>Upgrade notes</h3>
    <ul><li>{migration step, if any}</li></ul>
  </section>
</body>
</html>
```

## Rules
- **User language, not commit messages.** "You can now export to CSV" — not "added CsvExporter".
- **Newest on top** — prepend each release's `<section>`; never rewrite shipped history.
- **Breaking changes are loud** — if a section is empty (no breaking changes), omit it rather than leaving a blank heading.
- **Self-contained** — inline CSS, no external assets.
- **Derived from the wave** — one entry per feature that reached `passing` in the wave; pull titles from `feature_list.json` and user-visible outcomes from each `specs.md`.

## Readability gate — test the form before calling it done
- [ ] Opens in a browser and renders cleanly.
- [ ] Every shipped feature in the wave appears once, in user language.
- [ ] Breaking changes (if any) are visually distinct and say what the user must do.
- [ ] Newest release is on top; prior history is untouched.
- [ ] No internal jargon, file names, or commit hashes in the user-facing text.
