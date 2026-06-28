*** Settings ***
Documentation     Executable keyword bodies for {{FEATURE_ID}}, written by the tiger-e2e gate.
...               One keyword per Given/When/Then name used in e2e_testcases.robot. Each does REAL
...               work and asserts the real Then against feature.md — never No Operation, never the
...               laziest plausibly-wrong body. NO comments in the bodies (names carry meaning):
...               Process/OperatingSystem for CLI/API/file cases, Browser (Playwright) for UI cases.
Library           Process
Library           OperatingSystem

*** Variables ***
${BASE_URL}       http://localhost:8000
${EVIDENCE_DIR}   ${CURDIR}/evidence

*** Keywords ***
{{the system is in a known state}}
    No Operation

{{the one action happens}}
    No Operation

{{the observable outcome holds}}
    No Operation

{{Result for input equals expected}}
    [Arguments]    ${input}    ${expected}
    No Operation
