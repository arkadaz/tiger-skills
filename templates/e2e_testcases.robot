# tiger-status: awaiting_review
# tiger-feature-id: {{FEATURE_ID}}
# tiger-stage: grill
# ─────────────────────────────────────────────────────────────────────────────
# TIGER e2e CASES for ONE feature, in Robot Framework — the human-readable e2e
# contract. Two-file split, one writer per file:
#
#   • THIS file  e2e_testcases.robot   — the agreed CASES. The grill skill writes
#     them (the cases the human signed off on during the interview) and commits this
#     file with the sibling HTML artifacts on approval. Grill owns it; nobody else
#     edits the case definitions.
#   • sibling    e2e_keywords.resource — the executable IMPLEMENTATIONS of the
#     Given / When / Then keywords below. The tiger-e2e stage WRITES that resource:
#     Playwright behind the scenes (Browser library) for UI cases, Process /
#     OperatingSystem for CLI / API / file cases. e2e owns it.
#
# WHY the split: humans own the WHAT (case names + Given/When/Then a human can read
# in seconds); the e2e agent owns the HOW (the real Robot Framework / Playwright
# steps that make each case execute). The tiger-e2e stage runs the suite verbatim
# with `robot`; Robot's own output.xml / log.html / report.html (written to
# tiger/features/{{FEATURE_ID}}/evidence/) are the durable Verdict + Evidence.
#
# Approval: grill flips the `# tiger-status:` header from `awaiting_review` to
# `approved`, together with the three sibling HTML artifacts, on the human's explicit
# yes. spec.html's <meta tiger-status> stays the build's canonical gate; stamping
# this header keeps the approval visible on the e2e contract too.
# ─────────────────────────────────────────────────────────────────────────────

*** Settings ***
Documentation     E2E cases for {{FEATURE_TITLE}} ({{FEATURE_ID}}). Agreed with the human
...               during grill on {{DATE}}; executed verbatim by the tiger-e2e stage.
...               Non-degenerate inputs are mandatory: across the suite include at least
...               one boundary case (empty / zero / min / max / off-by-one), one typical
...               case, and one adversarial case (unicode, oversized, negative, duplicate,
...               traversal / injection where input is untrusted).
Resource          e2e_keywords.resource    # implementations written by the tiger-e2e stage
Force Tags        {{FEATURE_ID}}

*** Test Cases ***
# ── PRIORITY TAGGING — every case MUST carry exactly one priority tag:
#      priority:high   — failing this BLOCKS the e2e gate from passing (must fix)
#      priority:medium — failing this also BLOCKS (must fix, ordered after high)
#      priority:low    — failing this is LOGGED as a known issue; does not block PASS
#
#    Grill assigns each case a priority together with the human.  The tiger-e2e gate
#    reads a failing case's [Tags] and maps it to defect priority: HIGH and MEDIUM
#    defects generate a priority-ordered fix list back to the code generator; LOW
#    defects are recorded but do not block the gate.  PASS = zero HIGH + zero MEDIUM
#    defects with all tasks done.  The happy-path / smoke case is at least priority:high.
#    An adversarial / security row is also priority:high.
# ────────────────────────────────────────────────────────────────────────────────────

# ── E1 — happy path. @smoke. The Given/When/Then keyword NAMES read as English; their
#       runnable bodies live in e2e_keywords.resource (e2e writes them). ──
E1 Happy Path - {{happy path title}}
    [Tags]    smoke    critical    priority:high
    [Documentation]    The primary success scenario the human signed off on.
    Given {{the system is in a known state}}
    When {{the one action or event happens}}
    Then {{the observable outcome holds}}

# ── E2 — data-driven outline. [Template] runs the SAME body keyword once per row
#       below (the Robot Framework equivalent of a Gherkin Scenario Outline) — one
#       verdict per row in Robot's report. Keep the boundary / typical / adversarial
#       trio so the table is not degenerate (every row hitting the same path proves
#       nothing and must be rejected at grill time).
#       Adversarial / security rows are priority:high; boundary / typical rows are
#       priority:medium unless grill and the human agree otherwise. ──
E2 Boundary And Adversarial - {{outline title}}
    [Tags]    regression    priority:medium
    [Template]    {{Result for input equals expected}}
    # input                          expected
    ${EMPTY}                         {{boundary outcome}}      # boundary: empty / zero / min / max
    {{representative value}}         {{typical outcome}}       # typical
    {{unicode / very long / -1}}     {{adversarial outcome}}   # adversarial — promote to priority:high if security-relevant

# ── Example UI case — DELETE if the feature has no browser surface. The Loads … keyword
#    is implemented in e2e_keywords.resource with the Browser library (Playwright).
#    UI-only / cosmetic cases default to priority:low unless the human decides otherwise. ──
# E3 Loads Within Budget - dashboard
#     [Tags]    smoke    ui    priority:low
#     Given the dashboard server is running
#     When the user opens the dashboard
#     Then the dashboard renders within budget
