"""E2E tests for Workbench UI flows."""
from __future__ import annotations

# This module contains E2E test specifications.
# These tests require a running Next.js application and would be run with Playwright.
#
# Test scenarios based on Spec.md acceptance criteria:
# - SC-011: E2E tests for workbench load, row click → drawer, approval modal, blocked no-approve, amber acknowledge then approve

# ─── E2E Test Specifications ────────────────────────────────────────────────────
#
# The following are Playwright E2E test specifications. They document the
# expected behavior but require a running application to execute.
#
# To run these tests:
# 1. Start the Next.js dev server: npm run dev
# 2. Run Playwright: npx playwright test
#
# See: https://playwright.dev/docs/intro

E2E_TEST_SPECIFICATIONS = """
# E2E Test: Workbench Load
Given the Workbench is loaded with a valid optimization result
When the user views the page
Then the Decision Bar shows status, recommended_route, feasible_count/total_count
And the Context Rail shows Shipment Summary
And the Compare Canvas shows route options

# E2E Test: Route Row Click → Evidence Drawer (User Story 5, FR-068)
Given the Workbench is loaded
When the user clicks on a route row
Then the Evidence Drawer opens
And the default tab is "Overview"
And focus is trapped in the drawer

# E2E Test: Esc Closes Drawer (FR-068)
Given the Evidence Drawer is open
When the user presses Esc
Then the drawer closes
And focus returns to the route row

# E2E Test: Approval Modal for OK Status
Given status = OK
When the user clicks Approve
Then the Approval Modal opens
And shows execution summary
And shows risk/reversibility
And shows approve/cancel buttons

# E2E Test: BLOCKED Status — Approve Disabled (FR-070)
Given status = BLOCKED
When the user views the Decision Rail
Then the Approve button is disabled
And no execution CTA is shown

# E2E Test: ZERO Status — Approve Disabled (FR-070)
Given status = ZERO
When the user views the Decision Rail
Then all approval buttons are disabled
And only Re-evaluate is available

# E2E Test: AMBER Status — Acknowledgement Required (FR-069)
Given status = AMBER
When the user clicks Approve
Then the acknowledgement checkbox is shown
And without checking it, approval is not submitted

# E2E Test: View Mode Toggle (FR-060)
Given the Workbench is loaded
When the user switches to Audit mode
Then ranking reason, evidence_ref, decision timeline are shown first

# E2E Test: Scenario Toggle (FR-061)
Given the Workbench is loaded
When the user selects "Fastest" scenario
Then routes are sorted by transit_days ascending
And the recommended route updates accordingly
"""


# ─── Accessibility Tests ────────────────────────────────────────────────────────

ACCESSIBILITY_SPECIFICATIONS = """
# Accessibility: Keyboard Navigation (NFR-008, SC-013)
Given the Workbench is loaded
When the user navigates via Tab key
Then focus moves logically through: Header → Decision Bar → Context Rail → Compare Canvas → Decision Rail
And route rows are focusable and selectable via Enter

# Accessibility: Esc Closes Drawer/Modal (FR-068)
Given the Evidence Drawer is open
When the user presses Esc
Then the drawer closes

# Accessibility: Screen Reader Status Readout (SC-013)
Given the Workbench is loaded
When a screen reader is used
Then the current status is announced
And reason codes are announced
And assumptions are announced
"""


# ─── Test Data ────────────────────────────────────────────────────────────────

# Sample ShipmentRequest for testing
SAMPLE_SHIPMENT_REQUEST = {
    "request_id": "E2E-TEST-001",
    "pol_code": "Jebel Ali",
    "pod_code": "Rotterdam",
    "cargo_type": "GENERAL",
    "container_type": "40GP",
    "quantity": 1,
    "dims_cm": {"length": 120.0, "width": 100.0, "height": 250.0},
    "gross_weight_kg": 15000.0,
    "etd_target": "2026-05-01T10:00:00Z",
    "required_delivery_date": "2026-05-30",
    "incoterm": "CIF",
    "priority": "NORMAL",
    "hs_code": "847130",
    "destination_site": "AMS",
}

# Expected status values
EXPECTED_STATUS_VALUES = ["OK", "REVIEW", "AMBER", "BLOCKED", "ZERO"]

# Expected route codes
EXPECTED_ROUTE_CODES = ["SEA_DIRECT", "SEA_TRANSSHIP", "SEA_LAND"]
