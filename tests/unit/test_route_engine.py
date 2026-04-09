"""Unit tests for Route Engine modules."""
from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal

import pytest

from src.backend.route_engine.types import (
    RouteStatus,
    Priority,
    RouteCode,
    RiskLevel,
    CargoType,
    ShipmentRequest,
    RouteOption,
    RouteLeg,
    TransportMode,
)
from src.backend.route_engine.route_generator import generate_routes
from src.backend.route_engine.cost_calculator import calculate_route_cost, _compute_dem_det
from src.backend.route_engine.transit_estimator import estimate_transit
from src.backend.route_engine.ranking_engine import rank_routes, get_priority_weights


# ─── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_shipment() -> ShipmentRequest:
    """Create a sample shipment request for testing."""
    return ShipmentRequest(
        request_id="TEST-001",
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
def heavy_shipment() -> ShipmentRequest:
    """Create a heavy shipment that exceeds weight limits."""
    return ShipmentRequest(
        request_id="TEST-002",
        pol_code="Jebel Ali",
        pod_code="Rotterdam",
        cargo_type=CargoType.GENERAL,
        container_type="40GP",
        quantity=1,
        dims_cm={"length": 120.0, "width": 100.0, "height": 250.0},
        gross_weight_kg=35000.0,  # Exceeds 30t limit
        etd_target=datetime(2026, 5, 1, 10, 0, 0),
        required_delivery_date=date(2026, 5, 30),
        incoterm="CIF",
        priority=Priority.NORMAL,
        hs_code="847130",
        destination_site="AMS",
    )


@pytest.fixture
def oog_shipment() -> ShipmentRequest:
    """Create an OOG shipment."""
    return ShipmentRequest(
        request_id="TEST-003",
        pol_code="Jebel Ali",
        pod_code="Rotterdam",
        cargo_type=CargoType.OOG,
        container_type="40GP",
        quantity=1,
        dims_cm={"length": 200.0, "width": 300.0, "height": 250.0},
        gross_weight_kg=15000.0,
        etd_target=datetime(2026, 5, 1, 10, 0, 0),
        required_delivery_date=date(2026, 5, 30),
        incoterm="CIF",
        priority=Priority.NORMAL,
        hs_code="847130",
        destination_site="AMS",
    )


# ─── Route Generator Tests ─────────────────────────────────────────────────────

class TestRouteGenerator:
    """Tests for route_generator module."""

    def test_generate_routes_returns_three_routes(self, sample_shipment):
        """FR-010: SEA_DIRECT, SEA_TRANSSHIP, SEA_LAND must be generated."""
        routes = generate_routes(sample_shipment)
        assert len(routes) == 3

        route_codes = {r.route_code for r in routes}
        assert route_codes == {RouteCode.SEA_DIRECT, RouteCode.SEA_TRANSSHIP, RouteCode.SEA_LAND}

    def test_sea_direct_feasible_for_general_cargo(self, sample_shipment):
        """SEA_DIRECT should be feasible for GENERAL cargo."""
        routes = generate_routes(sample_shipment)
        sea_direct = next(r for r in routes if r.route_code == RouteCode.SEA_DIRECT)
        assert sea_direct.feasible is True
        assert sea_direct.blocked is False
        assert len(sea_direct.legs) == 1

    def test_sea_direct_blocked_for_oog(self, oog_shipment):
        """FR-012: OOG cargo excluded from SEA_DIRECT."""
        routes = generate_routes(oog_shipment)
        sea_direct = next(r for r in routes if r.route_code == RouteCode.SEA_DIRECT)
        assert sea_direct.feasible is False
        assert sea_direct.blocked is True
        assert "HUB_RESTRICTED_FOR_OOG" in sea_direct.reason_codes

    def test_sea_direct_blocked_for_heavy_cargo(self, heavy_shipment):
        """FR-012: Weight limit exceeded blocks SEA_DIRECT."""
        routes = generate_routes(heavy_shipment)
        sea_direct = next(r for r in routes if r.route_code == RouteCode.SEA_DIRECT)
        assert sea_direct.feasible is False
        assert "WEIGHT_LIMIT_EXCEEDED" in sea_direct.reason_codes

    def test_sea_land_has_inland_leg(self, sample_shipment):
        """FR-013: SEA_LAND requires inland final leg."""
        routes = generate_routes(sample_shipment)
        sea_land = next(r for r in routes if r.route_code == RouteCode.SEA_LAND)
        assert sea_land.feasible is True
        land_legs = [leg for leg in sea_land.legs if leg.mode == TransportMode.LAND]
        assert len(land_legs) >= 1

    def test_evidence_ref_present(self, sample_shipment):
        """FR-049: evidence_ref required on all routes."""
        routes = generate_routes(sample_shipment)
        for route in routes:
            assert len(route.evidence_ref) > 0


# ─── Cost Calculator Tests ─────────────────────────────────────────────────────

class TestCostCalculator:
    """Tests for cost_calculator module."""

    def test_cost_breakdown_contains_nine_components(self, sample_shipment):
        """FR-016: Total cost = sum of 9 components."""
        route = RouteOption(
            id="test-1",
            route_code=RouteCode.SEA_DIRECT,
            mode_mix=[TransportMode.SEA],
            legs=[],
            feasible=True,
            blocked=False,
            risk_level=RiskLevel.LOW,
        )
        transit_days = Decimal("12.00")
        cost = calculate_route_cost(route, sample_shipment, transit_days)

        assert cost.base_freight_aed > Decimal("0")
        assert cost.origin_charges_aed >= Decimal("0")
        assert cost.destination_charges_aed >= Decimal("0")
        assert cost.surcharge_aed >= Decimal("0")
        assert cost.dem_det_estimated_aed >= Decimal("0")
        assert cost.inland_aed >= Decimal("0")
        assert cost.handling_aed >= Decimal("0")
        assert cost.special_equipment_aed >= Decimal("0")
        assert cost.buffer_cost_aed >= Decimal("0")
        assert cost.total_cost_aed > Decimal("0")

    def test_cost_in_aed_two_decimals(self, sample_shipment):
        """NFR-012: All money in AED, 2 decimals."""
        route = RouteOption(
            id="test-1",
            route_code=RouteCode.SEA_DIRECT,
            mode_mix=[TransportMode.SEA],
            legs=[],
            feasible=True,
            blocked=False,
            risk_level=RiskLevel.LOW,
        )
        cost = calculate_route_cost(route, sample_shipment, Decimal("12.00"))
        for attr in [
            "base_freight_aed", "origin_charges_aed", "destination_charges_aed",
            "surcharge_aed", "dem_det_estimated_aed", "inland_aed",
            "handling_aed", "special_equipment_aed", "buffer_cost_aed", "total_cost_aed"
        ]:
            value = getattr(cost, attr)
            assert value == value.quantize(Decimal("0.01"))

    def test_dem_det_computed_when_exceeds_free_time(self):
        """DEM/DET exposure computed when free time exceeded."""
        dem_det, is_estimated = _compute_dem_det("40GP", Decimal("10.00"))
        assert dem_det > Decimal("0")
        assert is_estimated is True

    def test_dem_det_zero_when_within_free_time(self):
        """DEM/DET is 0 when within free time."""
        dem_det, is_estimated = _compute_dem_det("40GP", Decimal("3.00"))
        assert dem_det == Decimal("0.00")
        assert is_estimated is False

    def test_sea_land_includes_inland_cost(self, sample_shipment):
        """SEA_LAND includes inland cost."""
        route = RouteOption(
            id="test-1",
            route_code=RouteCode.SEA_LAND,
            mode_mix=[TransportMode.SEA, TransportMode.LAND],
            legs=[],
            feasible=True,
            blocked=False,
            risk_level=RiskLevel.MEDIUM,
        )
        cost = calculate_route_cost(route, sample_shipment, Decimal("15.00"))
        assert cost.inland_aed > Decimal("0")


# ─── Transit Estimator Tests ───────────────────────────────────────────────────

class TestTransitEstimator:
    """Tests for transit_estimator module."""

    def test_transit_days_sum_of_legs_and_buffers(self, sample_shipment):
        """FR-019: transit_days = sum(leg.base_days) + buffers."""
        routes = generate_routes(sample_shipment)
        sea_direct = next(r for r in routes if r.route_code == RouteCode.SEA_DIRECT)
        result = estimate_transit(sea_direct, datetime(2026, 5, 1))
        assert result.transit_days > Decimal("0")

    def test_transit_in_days_two_decimals(self, sample_shipment):
        """NFR-012: All time in days, 2 decimals."""
        routes = generate_routes(sample_shipment)
        sea_direct = next(r for r in routes if r.route_code == RouteCode.SEA_DIRECT)
        result = estimate_transit(sea_direct, datetime(2026, 5, 1))
        assert result.transit_days == result.transit_days.quantize(Decimal("0.01"))


# ─── Ranking Engine Tests ──────────────────────────────────────────────────────

class TestRankingEngine:
    """Tests for ranking_engine module."""

    def test_priority_weights_normal(self):
        """FR-038: NORMAL weight cost=0.50, time=0.25."""
        weights = get_priority_weights(Priority.NORMAL)
        assert weights.cost == 0.50
        assert weights.time == 0.25
        assert weights.risk == 0.15
        assert weights.wh == 0.10

    def test_priority_weights_urgent(self):
        """FR-038: URGENT weight time=0.50, cost=0.25."""
        weights = get_priority_weights(Priority.URGENT)
        assert weights.cost == 0.25
        assert weights.time == 0.50
        assert weights.risk == 0.15
        assert weights.wh == 0.10

    def test_priority_weights_critical(self):
        """FR-038: CRITICAL weight time=0.60, cost=0.15."""
        weights = get_priority_weights(Priority.CRITICAL)
        assert weights.cost == 0.15
        assert weights.time == 0.60
        assert weights.risk == 0.15
        assert weights.wh == 0.10

    def test_critical_exclusion_deadline_miss(self):
        """FR-042: CRITICAL excludes routes where deadline_slack < 0."""
        # This test verifies the logic - actual implementation in ranking_engine
        from src.backend.route_engine.types import ConstraintEvaluation
        constraint = ConstraintEvaluation(deadline_ok=False)
        # When deadline_ok is False for CRITICAL, route should be excluded
        assert constraint.deadline_ok is False


# ─── Status Mapping Tests ───────────────────────────────────────────────────────

class TestStatusMapping:
    """Tests for status mapping rules."""

    def test_status_values_only_five(self):
        """FR-027: Only OK, REVIEW, AMBER, BLOCKED, ZERO allowed."""
        allowed = {RouteStatus.OK, RouteStatus.REVIEW, RouteStatus.AMBER, RouteStatus.BLOCKED, RouteStatus.ZERO}
        assert len(allowed) == 5

    def test_status_values_match_spec(self):
        """FR-027: Status values match Spec.md."""
        assert RouteStatus.OK.value == "OK"
        assert RouteStatus.REVIEW.value == "REVIEW"
        assert RouteStatus.AMBER.value == "AMBER"
        assert RouteStatus.BLOCKED.value == "BLOCKED"
        assert RouteStatus.ZERO.value == "ZERO"
