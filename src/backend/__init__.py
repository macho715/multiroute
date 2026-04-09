"""Route Engine orchestrator — wires generate → evaluate → optimize flow."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from .route_engine.types import (
    ShipmentRequest,
    RouteOption,
    CostBreakdown,
    TransitEstimate,
    ConstraintEvaluation,
    OptimizeResponse,
    RankedRouteOption,
    RouteStatus,
    ApprovalState,
    DecisionLogic,
    RuleVersion,
)
from .route_engine import (
    route_generator,
    cost_calculator,
    transit_estimator,
    constraint_evaluator,
    ranking_engine,
    decision_logger,
)


# ─── Rule Versions ────────────────────────────────────────────────────────────

RULE_VERSIONS = RuleVersion(
    route_rules="v2026.04",
    cost_rules="v2026.04",
    transit_rules="v2026.04",
    doc_rules="v2026.04",
    risk_rules="v2026.04",
)


def run_generate(shipment: ShipmentRequest) -> list[RouteOption]:
    """
    Phase 1: Generate route candidates.

    FR-010 to FR-015: Generate SEA_DIRECT, SEA_TRANSSHIP, SEA_LAND
    with leg data, feasibility, and restrictions.
    """
    return route_generator.generate_routes(shipment)


def run_evaluate(
    shipment: ShipmentRequest,
    routes: list[RouteOption],
    wh_snapshot_age_hours: float | None = None,
) -> tuple[
    dict[str, CostBreakdown],
    dict[str, TransitEstimate],
    dict[str, ConstraintEvaluation],
    dict[str, Decimal],
]:
    """
    Phase 2: Evaluate routes — cost, transit, constraints.

    Returns dicts keyed by route_id.
    """
    etd_target = shipment.etd_target
    costs: dict[str, CostBreakdown] = {}
    transits: dict[str, TransitEstimate] = {}
    constraints: dict[str, ConstraintEvaluation] = {}
    deadline_slacks: dict[str, Decimal] = {}

    for route in routes:
        # Transit estimate
        transit_est = transit_estimator.estimate_transit(route, etd_target)

        # Compute deadline slack
        slack = transit_estimator.compute_deadline_slack(
            transit_est.eta,
            shipment.required_delivery_date,
            transit_est.transit_days,
        )
        transit_est.deadline_slack_days = slack
        transits[route.id] = transit_est

        # Cost calculation
        cost = cost_calculator.calculate_route_cost(
            route, shipment, transit_est.transit_days
        )
        costs[route.id] = cost

        # Constraint evaluation
        constraint = constraint_evaluator.evaluate_constraints(
            route=route,
            shipment=shipment,
            transit_est=transit_est,
            eta=transit_est.eta,
            deadline_slack_days=slack,
        )
        constraints[route.id] = constraint

        deadline_slacks[route.id] = slack

    return costs, transits, constraints, deadline_slacks


def run_optimize(
    shipment: ShipmentRequest,
    routes: list[RouteOption],
    costs: dict[str, CostBreakdown],
    transits: dict[str, TransitEstimate],
    constraints: dict[str, ConstraintEvaluation],
    deadline_slacks: dict[str, Decimal],
) -> OptimizeResponse:
    """
    Phase 3: Rank routes and produce final recommendation.

    FR-036 to FR-044: Rank feasible routes using weighted scoring,
    apply tie-breakers, determine status.
    """
    # Rank routes
    ranked = ranking_engine.rank_routes(
        routes=routes,
        costs=costs,
        transits=transits,
        constraints=constraints,
        deadline_slacks=deadline_slacks,
        priority=shipment.priority,
        shipment=shipment,
    )

    # Determine status
    has_stale_wh = any(
        c.reason_codes for c in constraints.values()
        if "WH_SNAPSHOT_STALE" in c.reason_codes
    )
    has_missing_input = any(
        c.input_required_codes for c in constraints.values()
    )
    assumptions_needed = any(
        c.reason_codes for c in constraints.values()
        if "DEM_DET_EXPOSURE_ESTIMATED" in c.reason_codes
    )

    status = ranking_engine.compute_status(
        ranked_routes=ranked,
        all_routes=routes,
        constraints=constraints,
        has_stale_wh=has_stale_wh,
        has_missing_input=has_missing_input,
        assumptions_needed=assumptions_needed,
    )

    # Build recommended route
    recommended = ranked[0] if ranked else None
    feasible_count = sum(1 for r in ranked if r.feasible and not r.blocked)

    # Collect reason codes, assumptions, evidence_refs
    all_reason_codes = list(set(
        route.reason_codes + constraints[route.id].reason_codes
        for route in routes
        for _ in [route.id]
    ))
    all_assumptions = list(set(
        route.assumption_notes for route in routes
    ))
    all_evidence = list(set(
        route.evidence_ref for route in routes
    ))

    decision_logic = ranking_engine.build_decision_logic(shipment.priority)

    return OptimizeResponse(
        request_id=shipment.request_id,
        status=status,
        recommended_route_id=recommended.route_option_id if recommended else None,
        recommended_route_code=recommended.route_code if recommended else None,
        options=ranked,
        decision_logic=decision_logic,
        reason_codes=all_reason_codes,
        assumptions=all_assumptions,
        input_required_codes=list(set(
            code for c in constraints.values() for code in c.input_required_codes
        )),
        evidence_ref=all_evidence,
        rule_version=RULE_VERSIONS,
        feasible_count=feasible_count,
        total_count=len(routes),
        approval_state=ApprovalState.NOT_REQUESTED,
        execution_eligible=False,
        generated_at=datetime.utcnow(),
    )
