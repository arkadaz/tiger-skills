# tiger-stage: e2e
# tiger-feature-id: {{FEATURE_ID}}
# ─────────────────────────────────────────────────────────────────────────────
# TIGER e2e executable IMPLEMENTATIONS, in Robot Framework — the runnable HOW for
# the agreed cases in the sibling e2e_testcases.robot. The tiger-e2e stage WRITES
# this file (it is the e2e agent's robot-framework write): Playwright behind the
# scenes via the Browser library for UI cases, Process / OperatingSystem for CLI /
# API / file cases. Grill owns the CASES; the e2e gate owns these IMPLEMENTATIONS —
# one writer per file. e2e may add/rewrite the keyword bodies here freely, but it
# never edits the agreed case definitions next door.
#
# THE IRON LAW STILL HOLDS: each keyword must do REAL work and assert the real Then —
# a body that only logs or `No Operation`s cannot make a case PASS. Drive the real
# artifact (a process, a page, an endpoint) and assert the observed outcome against
# the spec, never the laziest plausibly-wrong implementation.
# ─────────────────────────────────────────────────────────────────────────────

*** Settings ***
Documentation     Executable keyword implementations for {{FEATURE_ID}}, written by tiger-e2e.
Library           Process              # CLI / script cases — real OS processes
Library           OperatingSystem      # file / path / fixture assertions
# Library         Browser              # UI cases — Playwright behind the scenes.
#                                        Install once: pip install robotframework-browser && rfbrowser init

*** Variables ***
${BASE_URL}       http://localhost:8000
${EVIDENCE_DIR}   ${CURDIR}/evidence

*** Keywords ***
# One keyword per Given / When / Then NAME used in e2e_testcases.robot. Replace every
# `No Operation` with the real command. Keep each keyword 3-5 lines; say WHAT, not the
# selector mechanics. Examples shown commented — delete what the feature does not need.

{{the system is in a known state}}
    [Documentation]    Given — arrange the known precondition with a real command.
    No Operation
    # e.g.  Start Process    python3    -m    http.server    8000    alias=server
    #       Wait Until Keyword Succeeds    10x    1s    Healthcheck Responds

{{the one action or event happens}}
    [Documentation]    When — perform exactly ONE real action.
    No Operation
    # e.g. CLI:  ${r}=    Run Process    mycli    export    --format    csv    Set Suite Variable    ${RESULT}    ${r}
    # e.g. UI:   New Browser    chromium    headless=True    New Page    ${BASE_URL}    Click    text=Export

{{the observable outcome holds}}
    [Documentation]    Then — assert actual vs expected against the spec.
    No Operation
    # e.g. CLI:  Should Be Equal As Integers    ${RESULT.rc}    0    Should Contain    ${RESULT.stdout}    orders.csv
    # e.g. UI:   Get Text    h1    ==    Dashboard

{{Result for input equals expected}}
    [Arguments]    ${input}    ${expected}
    [Documentation]    Data-driven body for the E2 outline rows — run the feature with ${input}, assert the result equals ${expected}.
    No Operation
    # e.g.  ${r}=    Run Process    myfeature    --in    ${input}    Should Be Equal    ${r.stdout.strip()}    ${expected}
