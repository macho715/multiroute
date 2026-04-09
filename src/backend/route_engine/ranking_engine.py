"""Ranking Engine: scoring with priority weights and tie-breaking."""
from __future__ import annotations

from decimal import Decimal
from typing import Final

from .types import (
    DecisionLogic,
    Priority,
    PriorityWeights,
    RankedRouteOption,
    RiskLevel,
    RouteOption,
    RouteStatus,
    TransitEstimate,
    WHImpactLevel,
    CostBreakdown,
    ConstraintEvaluation,
    ShipmentRequest,
)


# Priority weights (FR-038)
_PRIORITY_WEIGHTS: Final[dict[Priority, PriorityWeights]] = {
    Priority.NORMAL: PriorityWeights(cost=0.50, time=0.25, risk=0.15, wh=0.10),
    Priority.URGENT: PriorityWeights(cost=0.25, time=0.50, risk=0.15, wh=0.10),
    Priority.CRITICAL: PriorityWeights(cost=0.15, time=0.60, risk=0.15, wh=0.10),
}

# Risk penalties (FR-039)
_RISK_PENALTIES: Final[dict[RiskLevel, float]] = {
    RiskLevel.LOW: 0.00,
    RiskLevel.MEDIUM: 0.10,
    RiskLevel.HIGH: 0.25,
    RiskLevel.BLOCKED: 0.0,  # BLOCKED routes are excluded from ranking
}

# WH impact penalties (FR-040)
_WH_PENALTIES: Final[dict[WHImpactLevel, float]] = {
    WHImpactLevel.LOW: 0.00,
    WHImpactLevel.MEDIUM: 0.10,
    WHImpactLevel.HIGH: 0.20,
    WHImpactLevel.BLOCKED: 0.0,  # BLOCKED routes are excluded
}

# Tie-breaker order (FR-043)
_TIE_BREAKER: Final[list[str]] = [
    "deadline_slack_days_desc",
    "risk_penalty_asc",
    "total_cost_aed_asc",
    "transit_days_asc",
    "route_code_asc",
]


def get_priority_weights(priority: Priority) -> PriorityWeights:
    """Get weight configuration for priority level."""
    return _PRIORITY_WEIGHTS[priority]


def rank_routes(
    routes: list[RouteOption],
    costs: dict[str, CostBreakdown],
    transits: dict[str, TransitEstimate],
    constraints: dict[str, ConstraintEvaluation],
    deadline_slacks: dict[str, Decimal],
    priority: Priority,
    shipment: ShipmentRequest,
) -> list[RankedRouteOption]:
    """
    Rank feasible routes using weighted scoring.

    Steps:
    1. Filter to feasible routes only (FR-037)
    2. Compute risk and WH penalties
    3. CRITICAL exclusion: drop routes where eta > required_delivery_date
       or deadline_slack_days < 0.00 (FR-042)
    4. Min-max normalize cost and transit days (FR-037)
    5. Compute weighted score (FR-041)
    6. Apply tie-breakers (FR-043)
    7. Assign ranks

    Score formula (FR-041):
    score = (w_cost * norm_cost) + (w_time * norm_transit)
          + (w_risk * risk_penalty) + (w_wh * wh_penalty)
    Lower score is better.
    """
    # Collect feasible routes with their data
    feasible: list[tuple[RouteOption, CostBreakdown, TransitEstimate, ConstraintEvaluation, Decimal]] = []

    for route in routes:
        if route.blocked or not route.feasible:
            continue

        cost = costs.get(route.id)
        transit = transits.get(route.id)
        constraint = constraints.get(route.id)
        slack = deadline_slacks.get(route.id, Decimal("0.00"))

        if cost is None or transit is None or constraint is None:
            continue

        # CRITICAL exclusion (FR-042)
        if priority == Priority.CRITICAL:
            if slack < Decimal("0.00"):
                continue
            if transit.eta.date() > shipment.required_delivery_date:
                continue

        feasible.append((route, cost, transit, constraint, slack))

    if not feasible:
        return []

    # Extract metrics for normalization
    costs_list = [float(f[1].total_cost_aed) for f in feasible]
    transit_list = [float(f[2].transit_days) for f in feasible]

    cost_min, cost_max = min(costs_list), max(costs_list)
    transit_min, transit_max = min(transit_list), max(transit_list)

    def normalize(value: float, mn: float, mx: float) -> float:
        if mx == mn:
            return 0.0
        return (value - mn) / (mx - mn)

    weights = _PRIORITY_WEIGHTS[priority]

    # Score each route
    scored: list[RankedRouteOption] = []
    for route, cost, transit, constraint, slack in feasible:
        # Normalize (0.00 for single candidate - FR-037)
        norm_cost = normalize(float(cost.total_cost_aed), cost_min, cost_max)
        norm_transit = normalize(float(transit.transit_days), transit_min, transit_max)

        # Penalties
        risk_penalty = _RISK_PENALTIES.get(constraint.wh_impact_level, 0.0)
        # Actually use constraint's risk_level for risk penalty
        risk_penalty = _RISK_PENALTIES.get(route.risk_level, 0.0)
        wh_penalty = _WH_PENALTIES.get(constraint.wh_impact_level, 0.0)

        # Compute score (lower is better - FR-041)
        score = (
            weights.cost * norm_cost
            + weights.time * norm_transit
            + weights.risk * risk_penalty
            + weights.wh * wh_penalty
        )

        ranked = RankedRouteOption(
            route_option_id=route.id,
            route_code=route.route_code,
            rank=None,
            feasible=True,
            blocked=False,
            eta=transit.eta,
            transit_days=transit.transit_days,
            deadline_slack_days=slack,
            total_cost_aed=cost.total_cost_aed,
            risk_level=route.risk_level,
            risk_penalty=risk_penalty,
            wh_impact_level=constraint.wh_impact_level,
            docs_completeness_pct=constraint.docs_completeness_pct,
            reason_codes=route.reason_codes + constraint.reason_codes,
            assumption_notes=route.assumption_notes,
            evidence_ref=route.evidence_ref,
            normalized_cost=round(norm_cost, 4),
            normalized_transit=round(norm_transit, 4),
            score=round(score, 4),
        )
        scored.append(ranked)

    # Sort by score asc (lower is better), then apply tie-breakers
    scored.sort(key=lambda r: (
        r.score,
        -float(r.deadline_slack_days or Decimal("0.00")),  # desc
        r.risk_penalty or 0.0,  # asc
        float(r.total_cost_aed or Decimal("0.00")),  # asc
        float(r.transit_days or Decimal("0.00")),  # asc
        r.route_code.value,  # asc (route_code is enum)
    ))

    # Assign ranks
    for i, route in enumerate(scored, start=1):
        route.rank = i

    return scored


def build_decision_logic(priority: Priority) -> DecisionLogic:
    """Build decision logic view for the response."""
    weights = _PRIORITY_WEIGHTS[priority]
    penalties = [
        {"code": "RISK_LOW", "value": 0.00, "description": "Low risk - no penalty"},
        {"code": "RISK_MEDIUM", "value": 0.10, "description": "Medium risk"},
        {"code": "RISK_HIGH", "value": 0.25, "description": "High risk"},
        {"code": "WH_LOW", "value": 0.00, "description": "Low WH impact - no penalty"},
        {"code": "WH_MEDIUM", "value": 0.10, "description": "Medium WH impact"},
        {"code": "WH_HIGH", "value": 0.20, "description": "High WH impact"},
    ]
    return DecisionLogic(
        priority=priority,
        weights=weights,
        normalization_method="min_max",
        tie_breaker=_TIE_BREAKER.copy(),
        penalties_applied=penalties,
    )


def compute_status(
    ranked_routes: list[RankedRouteOption],
    all_routes: list[RouteOption],
    constraints: dict[str, ConstraintEvaluation],
    has_stale_wh: bool = False,
    has_missing_input: bool = False,
    assumptions_needed: bool = False,
) -> RouteStatus:
    """
    Determine optimization status.

    Rules (FR-027 to FR-035):
    - OK: feasible >= 1, no ZERO condition, no blocking condition
    - REVIEW: inputs sufficient, human judgment required
    - AMBER: feasible exists, but relies on estimation/assumption
    - BLOCKED: feasible == 0 or all routes violate hard constraints
    - ZERO: high-risk mandatory input missing (HS, customs, AED, WH > 72h, dims)
    """
    feasible_count = sum(1 for r in ranked_routes if r.feasible and not r.blocked)
    total_count = len(all_routes)

    # ZERO conditions (FR-032)
    if has_missing_input or has_stale_wh:
        return RouteStatus.ZERO

    # BLOCKED conditions (FR-031)
    if feasible_count == 0:
        return RouteStatus.BLOCKED

    # AMBER conditions (FR-030)
    if assumptions_needed or any(c.reason_codes for c in constraints.values()):
        # Check if any route uses DEM/DET estimation
        for c in constraints.values():
            if "DEM_DET_EXPOSURE_ESTIMATED" in c.reason_codes:
                return RouteStatus.AMBER

    # REVIEW conditions (FR-029)
    if any(c.reason_codes for c in constraints.values()):
        return RouteStatus.REVIEW

    return RouteStatus.OK
