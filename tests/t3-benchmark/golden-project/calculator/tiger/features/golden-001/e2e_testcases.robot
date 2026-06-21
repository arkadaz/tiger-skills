# tiger-status: approved
# tiger-feature-id: golden-001
# tiger-stage: grill

*** Settings ***
Documentation     E2E cases for Four-operation calculator module (golden-001).
...               Agreed during grill 2026-06-18; executed verbatim by the tiger-e2e stage.
Resource          e2e_keywords.resource
Force Tags        golden-001

*** Test Cases ***
E1 Add Returns Correct Sum
    [Tags]    smoke    critical
    [Documentation]    Typical addition case.
    Given the calculator module is importable
    When I call add with 2 and 3
    Then the result is 5

E2 Subtract Returns Correct Difference
    [Tags]    smoke
    [Documentation]    Typical subtraction case.
    Given the calculator module is importable
    When I call subtract with 10 and 4
    Then the result is 6

E3 Multiply Returns Correct Product
    [Tags]    smoke
    [Documentation]    Typical multiplication case.
    Given the calculator module is importable
    When I call multiply with 3 and 4
    Then the result is 12

E4 Divide Returns Correct Quotient
    [Tags]    smoke
    [Documentation]    Typical division case.
    Given the calculator module is importable
    When I call divide with 10 and 2
    Then the result is 5.0

E5 Divide By Zero Raises ZeroDivisionError
    [Tags]    boundary    critical
    [Documentation]    Boundary case: divisor is zero.
    Given the calculator module is importable
    When I call divide with 1 and 0
    Then a ZeroDivisionError is raised

E6 Numpad Calculator UI Loads
    [Tags]    smoke    ui    critical
    [Documentation]    The numpad calculator renders in a browser with digit buttons 0-9, operators, display, and equals. A screenshot is captured as evidence.
    Given the Flask calculator server is running on port 5000
    When the user opens the calculator in a browser
    Then the page title contains "Calculator"
    And the numpad has digit buttons 0 through 9
    And the numpad has operator buttons for add subtract multiply and divide
    And a screenshot of the calculator UI is saved as evidence

E7 Numpad UI Computes Addition Via Button Clicks
    [Tags]    smoke    ui    critical
    [Documentation]    User clicks 7, +, 3, = on the numpad and the display shows 10.
    Given the Flask calculator server is running on port 5000
    When the user clicks the digit button 7
    And the user clicks the operator button plus
    And the user clicks the digit button 3
    And the user clicks the equals button
    Then the display shows 10
    And a screenshot of the result is saved as evidence

E8 Numpad UI Shows Error On Divide By Zero
    [Tags]    boundary    ui
    [Documentation]    User clicks 1, ÷, 0, = and the display shows an error message (not a crash).
    Given the Flask calculator server is running on port 5000
    When the user clicks the digit button 1
    And the user clicks the operator button divide
    And the user clicks the digit button 0
    And the user clicks the equals button
    Then the display shows an error message
    And a screenshot of the error state is saved as evidence
