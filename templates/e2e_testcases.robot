*** Settings ***
Documentation     E2E cases for {{FEATURE_TITLE}} ({{FEATURE_ID}}).
...               grill writes the agreed cases (a BROAD suite: several boundary, several typical,
...               several adversarial — one per acceptance criterion and business rule, not one each).
...               The tiger-e2e gate writes the keyword bodies in e2e_keywords.resource, runs the
...               suite verbatim, and may APPEND new cases (tagged source:e2e) — it never edits the
...               agreed cases here. Every case carries exactly one priority tag:
...               priority:high and priority:medium BLOCK the gate; priority:low is logged.
Metadata          tiger-status        awaiting_review
Metadata          tiger-feature-id    {{FEATURE_ID}}
Metadata          tiger-stage         grill
Resource          e2e_keywords.resource
Force Tags        {{FEATURE_ID}}

*** Test Cases ***
E1 Happy Path - {{title}}
    [Tags]    smoke    priority:high
    Given {{the system is in a known state}}
    When {{the one action happens}}
    Then {{the observable outcome holds}}

E2 Typical - {{title}}
    [Tags]    priority:high
    Given {{a representative state}}
    When {{a typical action}}
    Then {{the expected result}}

E3 Boundary - {{title}}
    [Tags]    priority:medium
    [Template]    {{Result for input equals expected}}
    ${EMPTY}                      {{empty/zero outcome}}
    {{min value}}                 {{min outcome}}
    {{max value}}                 {{max outcome}}
    {{off-by-one value}}          {{off-by-one outcome}}

E4 Adversarial - {{title}}
    [Tags]    priority:high
    [Template]    {{Result for input equals expected}}
    {{unicode / very long}}       {{handled outcome}}
    {{negative / duplicate}}      {{rejected outcome}}
    {{traversal / injection}}     {{rejected outcome}}
