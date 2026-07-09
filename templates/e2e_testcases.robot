*** Settings ***
Documentation     E2E cases for {{FEATURE_TITLE}} ({{FEATURE_ID}}).
...               The LEAD authors this suite from spec.md at plan time — a BROAD suite covering
...               everything that might happen (several boundary, several typical, several
...               adversarial, error paths — at least one case per acceptance criterion and per
...               business rule), and extends it on every verify round as new risks surface.
...               The lead also writes the keyword bodies in e2e_keywords.resource and runs the
...               WHOLE tiger/features/ folder as a regression. Every case carries exactly one
...               priority tag: priority:high and priority:medium BLOCK the gate; priority:low
...               is logged. A case of an already-shipped feature that regresses is HIGH.
Metadata          tiger-feature-id    {{FEATURE_ID}}
Metadata          tiger-stage         lead
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

E5 Error Path - {{title}}
    [Tags]    priority:medium
    Given {{a dependency is down / input is missing}}
    When {{the action happens}}
    Then {{the exact error behavior from spec.md holds}}
