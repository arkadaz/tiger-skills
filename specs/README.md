# Specs Directory

Approved feature specifications live here. One file per feature: `specs/<feature-id>.md`.

## Lifecycle

```
grill interview → spec written → status: awaiting_review → human approves → status: approved → feature added to feature_list.json
```

## File Naming

```
specs/<feature-id>.md
```

Where `<feature-id>` matches the `id` field in `feature_list.json`.

## Spec Template

See `skills/harness-engineering-grill/SKILL.md` for the full spec template and the grill protocol that produces it.

## Rules

- Specs are written by the grill skill (`harness-engineering-grill`)
- Specs are read by the `code-architect` during planning (and `e2e_testcases.md` by the `executor` at the e2e step)
- No spec = no planning = no code (the grill gate)
- Only the human can move a spec from `awaiting_review` to `approved`
- Once approved, the feature gets added to `feature_list.json` with a `spec_file` link
