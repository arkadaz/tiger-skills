# Review Branch

Review the current branch against all harness quality gates before merging.

## Review Protocol

### 1. Determine Scope
Identify what to review:
- `git diff main...HEAD` — changes relative to main
- `git log main..HEAD --oneline` — commits on this branch

### 2. Run Verification Pipeline
Load `harness-engineering:verify` and run all three layers:
- Layer 1: Static analysis (lint + type-check)
- Layer 2: Unit + integration tests
- Layer 3: E2E / smoke test (if cross-component changes)

### 3. Spawn Code Quality Review
Load `code-quality:review` and spawn an independent review agent to audit the diff against all 16 design principles + tooling rules.

### 4. Check Spec Compliance
If a spec exists for the feature, verify every requirement is implemented:
- Happy path behavior
- Error cases
- Edge cases
- No scope creep (extra behavior not in spec)

### 5. Check Harness State
- `./init.sh` still passes?
- `feature_list.json` updated?
- `progress.md` updated?
- No debug artifacts, print(), TODOs?

### 6. Produce Review Report
```markdown
# Branch Review: [branch name]

## Summary
- Commits: N
- Files changed: N
- Verification: [PASSED/FAILED]
- Code quality: [CLEAN/MINOR/MAJOR/BLOCKING]
- Spec compliance: [PASSED/FAILED]

## Evidence
- Layer 1: [output]
- Layer 2: [output]
- Layer 3: [output]

## Verdict
- [ ] APPROVED — ready to merge
- [ ] APPROVED WITH CHANGES — minor issues, fix before merge
- [ ] CHANGES REQUESTED — must fix before merge
- [ ] REJECTED — do not merge
```

## After Review
- Record review outcome in `progress.md`
- If APPROVED: mark feature `passing` in `feature_list.json` with evidence
- If CHANGES REQUESTED: file issues for each violation, fix before re-review
