"""Constraint Evaluator: WH capacity, deadline, docs, customs constraints."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from .types import (
    RouteOption,
    ShipmentRequest,
    ConstraintEvaluation,
    WHImpactLevel,
    RouteLeg,
    RouteCode,
)


# Reason codes used by constraint evaluator
REASON_LANE_UNSUPPORTED = "LANE_UNSUPPORTED"
REASON_MANDATORY_DOC_MISSING = "MANDATORY_DOC_MISSING"
REASON_WH_CAPACITY_BLOCKED = "WH_CAPACITY_BLOCKED"
REASON_DEADLINE_MISS = "DEADLINE_MISS"
REASON_HS_CODE_MISSING = "HS_CODE_MISSING"
REASON_CUSTOMS_INPUT_MISSING = "CUSTOMS_INPUT_MISSING"
REASON_FX_NORMALIZED_AED_REQUIRED = "FX_NORMALIZED_AED_REQUIRED"
REASON_WH_SNAPSHOT_STALE = "WH_SNAPSHOT_STALE"
REASON_HUB_RESTRICTED_FOR_OOG = "HUB_RESTRICTED_FOR_OOG"
REASON_WEIGHT_LIMIT_EXCEEDED = "WEIGHT_LIMIT_EXCEEDED"
REASON_COG_DATA_REQUIRED = "COG_DATA_REQUIRED"
REASON_CONNECTION_RISK_HIGH = "CONNECTION_RISK_HIGH"
REASON_DEM_DET_EXPOSURE_ESTIMATED = "DEM_DET_EXPOSURE_ESTIMATED"
REASON_CUSTOMS_REVIEW_REQUIRED = "CUSTOMS_REVIEW_REQUIRED"

# High-risk HS code prefixes
HIGH_RISK_HS_PREFIXES = ["84", "85", "87"]

# Weight limits per route
WEIGHT_LIMITS = {
    RouteCode.SEA_DIRECT: 30000.0,
    RouteCode.SEA_TRANSSHIP: 28000.0,
    RouteCode.SEA_LAND: 25000.0,
}

# Connection risk thresholds
HIGH_RISK_CONNECTION_DAYS = 1.00


def evaluate_constraints(
    route: RouteOption,
    request: ShipmentRequest,
    wh_snapshot_age_hours: Optional[float] = None,
) -> ConstraintEvaluation:
    """
    Evaluate all constraints for a route option.

    Returns ConstraintEvaluation with deadline_ok, wh_ok, docs_ok,
    customs_ok, connection_ok, wh_impact_level, docs_completeness_pct,
    reason_codes, and input_required_codes.
    """
    reason_codes: list[str] = []
    input_required_codes: list[str] = []

    # --- Deadline constraint ---
    deadline_ok = _check_deadline(route, request)

    # --- WH capacity constraint ---
    wh_ok, wh_impact, wh_reason = _check_wh_capacity(
        request, wh_snapshot_age_hours
    )
    if not wh_ok:
        reason_codes.append(wh_reason)

    # --- Docs constraint ---
    docs_ok, docs_pct, docs_reason = _check_docs(route, request)
    if not docs_ok:
        reason_codes.append(docs_reason)

    # --- Customs constraint ---
    customs_ok, customs_reason = _check_customs(request)
    if not customs_ok:
        reason_codes.append(customs_reason)

    # --- Connection constraint ---
    connection_ok, connection_reason = _check_connection(route)
    if not connection_ok:
        reason_codes.append(connection_reason)

    # --- Weight constraint ---
    weight_ok, weight_reason = _check_weight(route, request)
    if not weight_ok:
        reason_codes.append(weight_reason)

    # --- WH freshness ---
    if wh_snapshot_age_hours is not None:
        if wh_snapshot_age_hours > 72.0:
            input_required_codes.append(REASON_WH_SNAPSHOT_STALE)
            wh_ok = False
        elif wh_snapshot_age_hours > 24.0:
            # AMBER but not blocking
            pass

    # Determine overall feasibility
    feasible = (
        deadline_ok
        and wh_ok
        and docs_ok
        and customs_ok
        and connection_ok
        and weight_ok
    )

    return ConstraintEvaluation(
        deadline_ok=deadline_ok,
        wh_ok=wh_ok,
        docs_ok=docs_ok,
        customs_ok=customs_ok,
        connection_ok=connection_ok,
        wh_impact_level=wh_impact,
        docs_completeness_pct=docs_pct,
        reason_codes=reason_codes,
        input_required_codes=input_required_codes,
    )


def _check_deadline(route: RouteOption, request: ShipmentRequest) -> bool:
    """Check if route can meet delivery deadline."""
    # Calculate total transit days from route legs
    total_days = sum(leg.base_days for leg in route.legs)

    # Add buffer days (customs + transship + inland)
    total_days += 2.00  # customs buffer

    if len(route.legs) > 1:
        total_days += 4.00  # transship buffer

    land_legs = [l for l in route.legs if l.mode == "LAND"]
    if land_legs:
        total_days += 3.00  # inland buffer

    eta = request.etd_target + timedelta(days=total_days)

    # For CRITICAL priority, exclude routes where eta > required_delivery_date
    if request.priority.value == "CRITICAL":
        if eta.date() > request.required_delivery_date:
            return False

    # Deadline slack check
    slack = (request.required_delivery_date - eta.date()).days
    if slack < 0.00:
        return False

    return True


def _check_wh_capacity(
    request: ShipmentRequest,
    wh_snapshot_age_hours: Optional[float] = None,
) -> tuple[bool, WHImpactLevel, str]:
    """Check warehouse capacity at destination."""
    # MVP: Use destination_site as site_code
    # Real implementation would check wh_capacity_snapshot table

    if wh_snapshot_age_hours is None:
        # No snapshot = AMBER (assume capacity OK but unverified)
        return True, WHImpactLevel.MEDIUM, REASON_WH_SNAPSHOT_STALE

    if wh_snapshot_age_hours > 72.0:
        return False, WHImpactLevel.BLOCKED, REASON_WH_SNAPSHOT_STALE

    if wh_snapshot_age_hours > 24.0:
        return True, WHImpactLevel.MEDIUM, REASON_WH_SNAPSHOT_STALE

    return True, WHImpactLevel.LOW, ""


def _check_docs(route: RouteOption, request: ShipmentRequest) -> tuple[bool, float, str]:
    """Check required documents availability."""
    # Required docs per route type
    required_docs_map = {
        RouteCode.SEA_DIRECT: ["CI", "PL", "BL", "COO"],
        RouteCode.SEA_TRANSSHIP: ["CI", "PL", "BL", "COO", "HUB_DOC"],
        RouteCode.SEA_LAND: ["CI", "PL", "BL", "COO", "INLAND_DO"],
    }

    required_docs = required_docs_map.get(route.route_code, [])
    available_docs = request.docs_available or []

    # Check coverage
    available_set = set(available_docs)
    required_set = set(required_docs)

    missing = required_set - available_set

    if missing:
        completeness = (len(required_set) - len(missing)) / len(required_set) * 100
        return False, completeness, REASON_MANDATORY_DOC_MISSING

    return True, 100.0, ""


def _check_customs(request: ShipmentRequest) -> tuple[bool, str]:
    """Check customs-related inputs and risk level."""
    # HS code must be provided
    if not request.hs_code or len(request.hs_code) < 6:
        return False, REASON_HS_CODE_MISSING

    # Check if HS code is high-risk
    hs_prefix = request.hs_code[:2]
    if hs_prefix in HIGH_RISK_HS_PREFIXES:
        # High-risk cargo needs customs review
        return False, REASON_CUSTOMS_REVIEW_REQUIRED

    return True, ""


def _check_connection(route: RouteOption) -> tuple[bool, str]:
    """Check connection feasibility between legs."""
    # For multi-leg routes, check connection time
    if len(route.legs) < 2:
        return True, ""

    # Check gap between consecutive legs
    sea_legs = [l for l in route.legs if l.mode == "SEA"]
    if len(sea_legs) < 2:
        return True, ""

    # For transshipment, need buffer days between connections
    # Using 4 days transship buffer from transit_rules
    # If connection time is too short, flag as high risk

    return True, ""


def _check_weight(route: RouteOption, request: ShipmentRequest) -> tuple[bool, str]:
    """Check if cargo weight is within route limits."""
    limit = WEIGHT_LIMITS.get(route.route_code, 30000.0)
    total_weight = request.gross_weight_kg * request.quantity

    if total_weight > limit:
        return False, REASON_WEIGHT_LIMIT_EXCEEDED

    return True, ""


def get_wh_freshness_status(age_hours: float) -> str:
    """Return WH snapshot freshness status string."""
    if age_hours <= 24:
        return "OK"
    elif age_hours <= 72:
        return "AMBER"
    return "ZERO"


def build_constraint_summary(evaluation: ConstraintEvaluation) -> dict:
    """Build a human-readable constraint summary."""
    return {
        "deadline_ok": evaluation.deadline_ok,
        "wh_ok": evaluation.wh_ok,
        "docs_ok": evaluation.docs_ok,
        "customs_ok": evaluation.customs_ok,
        "connection_ok": evaluation.connection_ok,
        "wh_impact_level": evaluation.wh_impact_level.value,
        "docs_completeness_pct": evaluation.docs_completeness_pct,
        "reason_codes": evaluation.reason_codes,
        "input_required_codes": evaluation.input_required_codes,
    }