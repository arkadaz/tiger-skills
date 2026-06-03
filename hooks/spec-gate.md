---
event: UserPromptSubmit
---

SPEC GATE: If this request is a BUILD request — add / build / implement / create a feature, "I want…", "can we…", or any change to user-visible behavior — and no approved spec covers it (no specs/<feature-id>.md with Status: approved, and no matching feature in feature_list.json), invoke harness-engineering:grill FIRST. Interview the user, write the spec, get human approval, then plan. Do NOT plan or write code without an approved spec. Skip this gate for bug fixes, factual questions, and precise one-line edits.
