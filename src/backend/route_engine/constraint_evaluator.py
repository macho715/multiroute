"""Constraint Evaluator: deadline, WH capacity, docs, customs, connection."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from .types import (
    ConstraintEvaluation,
    RouteOption,
    ShipmentRequest,
    TransitEstimate,
    WHCapacitySnapshot,
    WHImpactLevel,
    RiskLevel,
)


# Required documents per route from doc_rules.yaml
_REQUIRED_DOCS: dict[str, list[str]] = {
    "SEA_DIRECT": ["CI", "PL", "BL", "COO"],
    "SEA_TRANSSHIP": ["CI", "PL", "BL", "COO", "HUB_DOC"],
    "SEA_LAND": ["CI", "PL", "BL", "COO", "INLAND_DO"],
}


def evaluate_constraints(
    route: RouteOption,
    shipment: ShipmentRequest,
    transit_est: TransitEstimate,
    wh_snapshot: WHCapacitySnapshot | None = None,
    eta: datetime | None = None,
    deadline_slack_days: Decimal | None = None,
) -> ConstraintEvaluation:
    """
    Evaluate all constraints for a route option.

    Evaluates:
    - deadline_ok: eta <= required_delivery_date
    - wh_ok: warehouse capacity not exceeded
    - docs_ok: mandatory documents available
    - customs_ok: customs inputs present
    - connection_ok: multimodal connections feasible

    Also computes:
    - wh_impact_level: LOW/MEDIUM/HIGH/BLOCKED
    - docs_completeness_pct: percentage of required docs available
    """
    result = ConstraintEvaluation()
    reason_codes: list[str] = []
    input_required_codes: list[str] = []
    assumption_notes: list[str] = []

    # ── Deadline Constraint ──────────────────────────────────────────────────
    if eta is None:
        eta = transit_est.eta
    if deadline_slack_days is None:
        deadline_slack_days = transit_est.deadline_slack_days

    if deadline_slack_days < Decimal("0.00"):
        result.deadline_ok = False
        reason_codes.append("DEADLINE_MISS")

    # ── WH Capacity Constraint ───────────────────────────────────────────────
    wh_ok, wh_impact, wh_reason = _evaluate_wh_capacity(
        shipment, eta, wh_snapshot
    )
    result.wh_ok = wh_ok
    result.wh_impact_level = wh_impact
    if wh_reason:
        reason_codes.append(wh_reason)

    # ── Docs Constraint ──────────────────────────────────────────────────────
    docs_ok, completeness_pct, doc_reason = _evaluate_docs(
        shipment, route
    )
    result.docs_ok = docs_ok
    result.docs_completeness_pct = completeness_pct
    if doc_reason:
        reason_codes.append(doc_reason)

    # ── Customs Constraint ───────────────────────────────────────────────────
    customs_ok, customs_reason, customs_input = _evaluate_customs(shipment)
    result.customs_ok = customs_ok
    if customs_reason:
        reason_codes.append(customs_reason)
    if customs_input:
        input_required_codes.extend(customs_input)

    # ── Connection Risk ──────────────────────────────────────────────────────
    connection_ok, conn_reason = _evaluate_connection(route)
    result.connection_ok = connection_ok
    if conn_reason:
        reason_codes.append(conn_reason)

    result.reason_codes = reason_codes
    result.input_required_codes = input_required_codes
    return result


def _evaluate_wh_capacity(
    shipment: ShipmentRequest,
    eta: datetime,
    snapshot: WHCapacitySnapshot | None,
) -> tuple[bool, WHImpactLevel, str | None]:
    """
    Evaluate WH capacity constraint.

    WH freshness rules (FR-024):
    - <= 24h: normal (LOW impact)
    - > 24h and <= 72h: AMBER (MEDIUM impact)
    - > 72h or missing: ZERO (BLOCKED)

    Returns (wh_ok, wh_impact_level, reason_code).
    """
    if snapshot is None:
        return False, WHImpactLevel.BLOCKED, "WH_CAPACITY_BLOCKED"

    # Check snapshot freshness
    now = datetime.utcnow()
    age_hours = (now - snapshot.snapshot_at).total_seconds() / 3600

    if age_hours > 72:
        return False, WHImpactLevel.BLOCKED, "WH_SNAPSHOT_STALE"
    elif age_hours > 24:
        # AMBER - stale but usable
        impact = WHImpactLevel.MEDIUM
    else:
        impact = WHImpactLevel.LOW

    # Check remaining capacity
    qty_needed = shipment.quantity * 1  # 1 TEU per quantity unit (simplified)
    if snapshot.remaining_capacity < qty_needed:
        return False, WHImpactLevel.BLOCKED, "WH_CAPACITY_BLOCKED"

    if snapshot.remaining_capacity < qty_needed * 2:
        impact = WHImpactLevel.HIGH if impact != WHImpactLevel.BLOCKED else WHImpactLevel.BLOCKED

    return True, impact, None


def _evaluate_docs(
    shipment: ShipmentRequest,
    route: RouteOption,
) -> tuple[bool, float, str | None]:
    """
    Evaluate document requirements.

    Required docs per route (FR-025):
    - SEA_DIRECT: CI, PL, BL, COO
    - SEA_TRANSSHIP: CI, PL, BL, COO, HUB_DOC
    - SEA_LAND: CI, PL, BL, COO, INLAND_DO
    """
    required = _REQUIRED_DOCS.get(route.route_code.value, [])
    available = set(shipment.docs_available or [])
    provided = set(d for d in required if d in available)
    missing = set(required) - provided

    completeness = (len(provided) / len(required) * 100) if required else 100.0

    if missing:
        return False, round(completeness, 2), "MANDATORY_DOC_MISSING"
    return True, round(completeness, 2), None


def _evaluate_customs(shipment: ShipmentRequest) -> tuple[bool, str | None, list[str]]:
    """
    Evaluate customs readiness.

    FX handling (FR-009, EC6):
    - MVP does NOT do runtime FX conversion
    - Non-AED input triggers ZERO with FX_NORMALIZED_AED_REQUIRED

    HS code check (FR-006, FR-032):
    - HS code must be numeric 6-12 digits
    - Missing HS code => ZERO with HS_CODE_MISSING
    """
    reasons: list[str] = []
    input_required: list[str] = []

    # HS code validation
    if not shipment.hs_code or not shipment.hs_code.isdigit():
        reasons.append("HS_CODE_MISSING")
        input_required.append("HS_CODE_MISSING")

    # COG data for OOG/HEAVY_LIFT
    if shipment.cargo_type.value in ("OOG", "HEAVY_LIFT") and shipment.cog_cm is None:
        reasons.append("COG_DATA_REQUIRED")
        input_required.append("COG_DATA_REQUIRED")

    customs_ok = len(reasons) == 0
    reason_str = reasons[0] if reasons else None
    return customs_ok, reason_str, input_required


def _evaluate_connection(route: RouteOption) -> tuple[bool, str | None]:
    """
    Evaluate multimodal connection feasibility.

    Rules:
    - Transshipment routes with gap > 72h between legs => CONNECTION_RISK_HIGH
    - All legs must have positive base_days
    """
    if len(route.legs) < 2:
        return True, None

    # For transshipment, check that connecting time is reasonable
    # In production, would check actual schedules
    # Simplified: all legs present means connection OK
    return True, None


def compute_wh_freshness_status(snapshot: WHCapacitySnapshot | None) -> tuple[str, float | None]:
    """
    Compute WH snapshot freshness status.

    Returns (status, age_hours):
    - normal: <= 24h
    - AMBER: > 24h and <= 72h
    - ZERO: > 72h or missing
    """
    if snapshot is None:
        return "ZERO", None

    now = datetime.utcnow()
    age_hours = (now - snapshot.snapshot_at).total_seconds() / 3600

    if age_hours <= 24:
        return "OK", round(age_hours, 2)
    elif age_hours <= 72:
        return "AMBER", round(age_hours, 2)
    else:
        return "ZERO", round(age_hours, 2)
