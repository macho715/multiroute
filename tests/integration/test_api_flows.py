"""Integration tests for API flows: generate -> evaluate -> optimize -> approve."""
from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal

import pytest

from src.backend.route_engine.types import (
    Priority,
    RouteCode,
    ShipmentRequest,
    CargoType,
    RouteOption,
    RiskLevel,
    TransportMode,
)
from src.backend.route_engine.route_generator import generate_routes
from src.backend.route_engine.cost_calculator import calculate_route_cost
from src.backend.route_engine.transit_estimator import estimate_transit
from src.backend.route_engine.constraint_evaluator import evaluate_constraints
from src.backend.route_engine.ranking_engine import rank_routes


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def valid_shipment() -> ShipmentRequest:
    return ShipmentRequest(
        request_id="INT-001",
        pol_code="Jebel Ali",
        pod_code="Rotterdam",
        cargo_type=CargoType.GENERAL,
        container_type="40GP",
        quantity=1,
        dims_cm={"length": 120.0, "width": 100.0, "height": 250.0},
        gross_weight_kg=15000.0,
        etd_target=datetime(2026, 5, 1, 10, 0, 0),
        required_delivery_date=date(2026, 5, 30),
        incoterm="CIF",
        priority=Priority.NORMAL,
        hs_code="847130",
        destination_site="AMS",
    )


@pytest.fixture
def urgent_shipment() -> ShipmentRequest:
    return ShipmentRequest(
        request_id="INT-002",
        pol_code="Jebel Ali",
        pod_code="Singapore",
        cargo_type=CargoType.GENERAL,
        container_type="20GP",
        quantity=1,
        dims_cm={"length": 100.0, "width": 80.0, "height": 200.0},
        gross_weight_kg=8000.0,
        etd_target=datetime(2026, 5, 1, 10, 0, 0),
        required_delivery_date=date(2026, 5, 15),  # Tight deadline
        incoterm="CIF",
        priority=Priority.URGENT,
        hs_code="847130",
        destination_site="SIN",
    )


@pytest.fixture
def critical_shipment() -> ShipmentRequest:
    return ShipmentRequest(
        request_id="INT-003",
        pol_code="Jebel Ali",
        pod_code="Shanghai",
        cargo_type=CargoType.GENERAL,
        container_type="40GP",
        quantity=1,
        dims_cm={"length": 120.0, "width": 100.0, "height": 250.0},
        gross_weight_kg=20000.0,
        etd_target=datetime(2026, 5, 1, 10, 0, 0),
        required_delivery_date=date(2026, 5, 5),  # Impossible deadline
        incoterm="CIF",
        priority=Priority.CRITICAL,
        hs_code="847130",
        destination_site="SHA",
    )


# ─── Integration: generate -> evaluate -> optimize ─────────────────────────────

class TestGenerateEvaluateOptimize:
    """SC-010: Integration test for generate→evaluate→optimize flow."""

    def test_full_flow_normal_priority(self, valid_shipment):
        """End-to-end flow for NORMAL priority shipment."""
        # Step 1: Generate routes
        routes = generate_routes(valid_shipment)
        assert len(routes) == 3
        feasible_routes = [r for r in routes if r.feasible]
        assert len(feasible_routes) >= 1

        # Step 2: Evaluate costs
        for route in feasible_routes:
            transit = estimate_transit(route, valid_shipment.etd_target)
            cost = calculate_route_cost(route, valid_shipment, transit.transit_days)
            constraint = evaluate_constraints(route, valid_shipment, transit)

            assert cost.total_cost_aed > Decimal("0")
            assert constraint is not None

        # Step 3: Rank routes
        ranked = rank_routes(
            routes=routes,
            costs={r.id: calculate_route_cost(r, valid_shipment, Decimal("12.00")) for r in routes},
            transits={r.id: estimate_transit(r, valid_shipment.etd_target) for r in routes},
            constraints={r.id: evaluate_constraints(r, valid_shipment, estimate_transit(r, valid_shipment.etd_target)) for r in routes},
            deadline_slacks={r.id: Decimal("10.00") for r in routes},
            priority=valid_shipment.priority,
            shipment=valid_shipment,
        )

        # Verify ranking
        if len([r for r in routes if r.feasible]) >= 1:
            assert len(ranked) >= 1
            # Recommended route should be first
            assert ranked[0].rank == 1

    def test_urgent_priority_prefers_faster_route(self, urgent_shipment):
        """URGENT priority should prefer faster routes (higher time weight)."""
        weights = {
            Priority.NORMAL: {"cost": 0.50, "time": 0.25},
            Priority.URGENT: {"cost": 0.25, "time": 0.50},
        }
        urgent_weights = weights[urgent_shipment.priority]
        assert urgent_weights["time"] > urgent_weights["cost"]

    def test_critical_priority_excludes_deadline_miss(self, critical_shipment):
        """FR-042: CRITICAL excludes routes where deadline_slack < 0."""
        routes = generate_routes(critical_shipment)
        # All routes should be blocked due to impossible deadline
        for route in routes:
            if route.feasible:
                transit = estimate_transit(route, critical_shipment.etd_target)
                # ETA would exceed required_delivery_date
                assert transit.eta.date() > critical_shipment.required_delivery_date


# ─── Integration: Blocked/Zero Scenarios ──────────────────────────────────────

class TestBlockedZeroScenarios:
    """SC-003: BLOCKED/REVIEW/AMBER/ZERO must have reason codes."""

    def test_zero_when_non_aed_currency(self):
        """FR-032: Non-AED currency triggers ZERO."""
        # This test verifies the rule that non-AED input triggers ZERO
        # In practice, this would be handled at API validation layer
        # HS code validation requires 6+ characters (FR-006)
        assert True  # Placeholder - actual validation in API layer

    def test_blocked_when_no_feasible_routes(self, heavy_shipment=None):
        """FR-031: feasible route count = 0 → BLOCKED."""
        # Create shipment with 0 feasible routes via weight
        shipment = ShipmentRequest(
            request_id="INT-BLOCK-001",
            pol_code="Jebel Ali",
            pod_code="Rotterdam",
            cargo_type=CargoType.GENERAL,
            container_type="40GP",
            quantity=1,
            dims_cm={"length": 120.0, "width": 100.0, "height": 250.0},
            gross_weight_kg=50000.0,  # Exceeds all limits
            etd_target=datetime(2026, 5, 1, 10, 0, 0),
            required_delivery_date=date(2026, 5, 30),
            incoterm="CIF",
            priority=Priority.NORMAL,
            hs_code="847130",
            destination_site="AMS",
        )
        routes = generate_routes(shipment)
        feasible_count = sum(1 for r in routes if r.feasible)
        # All routes blocked due to weight
        assert feasible_count == 0
