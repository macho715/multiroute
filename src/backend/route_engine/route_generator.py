"""Route Generator: SEA_DIRECT, SEA_TRANSSHIP, SEA_LAND route candidates."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from .types import (
    CargoType,
    RouteCode,
    RouteLeg,
    RouteOption,
    ShipmentRequest,
    TransportMode,
    RiskLevel,
)


# Hub nodes for transshipment routes (simplified MVP data)
_HUB_NODES: dict[str, str] = {
    "DXB": "Jebel Ali",
    "DUB": "Jebel Ali",
    "AUH": "Khalifa",
    "KWI": "Shuwaikh",
}

# Inland delivery nodes per region (simplified MVP data)
_INLAND_NODES: dict[str, list[str]] = {
    "AE": ["Abu Dhabi", "Al Ain", "Sharjah"],
    "SA": ["Riyadh", "Jeddah", "Dammam"],
    "QA": ["Doha", "Al Rayyan"],
    "BH": ["Manama"],
    "OM": ["Muscat", "Salalah"],
}


def _is_oog_restricted(cargo_type: CargoType, route_code: RouteCode) -> bool:
    """Check if OOG/HEAVY_LIFT cargo is restricted for given route."""
    if route_code == RouteCode.SEA_DIRECT:
        return cargo_type in (CargoType.OOG, CargoType.HEAVY_LIFT)
    return False


def _is_weight_exceeded(gross_weight_kg: float, route_code: RouteCode) -> bool:
    """Check if weight exceeds route limit."""
    # Simplified: SEA_DIRECT max 30t per container, others 25t
    limit_kg = 30_000 if route_code == RouteCode.SEA_DIRECT else 25_000
    return gross_weight_kg > limit_kg


def _build_sea_direct(req: ShipmentRequest, base_days: Decimal) -> RouteOption:
    """Build a SEA_DIRECT route: single sea leg POL -> POD."""
    leg = RouteLeg(
        seq=1,
        mode=TransportMode.SEA,
        origin_node=req.pol_code,
        destination_node=req.pod_code,
        carrier_code="MAERSK",
        service_code="SEALAND_DIRECT",
        base_days=base_days,
        restrictions_jsonb=None,
    )
    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_DIRECT,
        mode_mix=[TransportMode.SEA],
        legs=[leg],
        feasible=True,
        blocked=False,
        risk_level=RiskLevel.LOW,
        evidence_ref=[f"route_gen:v2026.04:SEA_DIRECT:{req.pol_code}:{req.pod_code}"],
    )


def _build_sea_transship(
    req: ShipmentRequest, hub_code: str, base_days: Decimal, transship_buffer: Decimal
) -> RouteOption:
    """Build a SEA_TRANSSHIP route: POL -> hub -> POD."""
    hub_name = _HUB_NODES.get(hub_code, hub_code)
    leg1 = RouteLeg(
        seq=1,
        mode=TransportMode.SEA,
        origin_node=req.pol_code,
        destination_node=hub_name,
        carrier_code="MAERSK",
        service_code="FEEDER_EAST",
        base_days=base_days,
        restrictions_jsonb=None,
    )
    leg2 = RouteLeg(
        seq=2,
        mode=TransportMode.SEA,
        origin_node=hub_name,
        destination_node=req.pod_code,
        carrier_code="MSC",
        service_code="MAIN_LINE",
        base_days=transship_buffer,
        restrictions_jsonb=None,
    )
    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_TRANSSHIP,
        mode_mix=[TransportMode.SEA, TransportMode.SEA],
        legs=[leg1, leg2],
        feasible=True,
        blocked=False,
        risk_level=RiskLevel.MEDIUM,
        evidence_ref=[f"route_gen:v2026.04:SEA_TRANSSHIP:{req.pol_code}:{hub_code}:{req.pod_code}"],
    )


def _build_sea_land(
    req: ShipmentRequest,
    hub_code: str,
    sea_days: Decimal,
    inland_days: Decimal,
) -> RouteOption:
    """Build a SEA_LAND route: POL -> hub (sea) -> inland destination."""
    # Determine inland destination based on destination_site region
    inland_destinations = _INLAND_NODES.get(req.destination_site[:2].upper(), ["Inland"])
    inland_dest = inland_destinations[0] if inland_destinations else "Inland"

    hub_name = _HUB_NODES.get(hub_code, hub_code)
    leg1 = RouteLeg(
        seq=1,
        mode=TransportMode.SEA,
        origin_node=req.pol_code,
        destination_node=hub_name,
        carrier_code="MAERSK",
        service_code="FEEDER_GULF",
        base_days=sea_days,
        restrictions_jsonb=None,
    )
    leg2 = RouteLeg(
        seq=2,
        mode=TransportMode.LAND,
        origin_node=hub_name,
        destination_node=inland_dest,
        carrier_code="LOCAL_TRUCK",
        service_code="INLAND_DELIVERY",
        base_days=inland_days,
        restrictions_jsonb=None,
    )
    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_LAND,
        mode_mix=[TransportMode.SEA, TransportMode.LAND],
        legs=[leg1, leg2],
        feasible=True,
        blocked=False,
        risk_level=RiskLevel.MEDIUM,
        evidence_ref=[f"route_gen:v2026.04:SEA_LAND:{req.pol_code}:{hub_code}:{inland_dest}"],
    )


def generate_routes(req: ShipmentRequest) -> list[RouteOption]:
    """
    Generate feasible route candidates for the given shipment request.

    Returns SEA_DIRECT, SEA_TRANSSHIP, and SEA_LAND routes that pass
    cargo type, weight, and hub restriction checks.

    Rules (from Spec.md):
    - SEA_LAND requires an inland final leg
    - OOG/HEAVY_LIFT excluded from SEA_DIRECT (hub-restricted)
    - Weight limit checks per route type
    - 1-4 legs per route
    """
    routes: list[RouteOption] = []
    reason_codes: list[str] = []

    # Base transit days by lane (simplified MVP lookup)
    # In production, this would come from rate_table / transit_rules
    sea_direct_days = Decimal("12.00")
    sea_to_hub_days = Decimal("5.00")
    hub_to_pod_days = Decimal("8.00")
    sea_to_inland_days = Decimal("5.00")
    inland_days = Decimal("3.00")
    transship_buffer = Decimal("4.00")

    # Default hub
    hub = "DXB"

    # ── SEA_DIRECT ──────────────────────────────────────────────────────────
    if _is_oog_restricted(req.cargo_type, RouteCode.SEA_DIRECT):
        reason_codes.append("HUB_RESTRICTED_FOR_OOG")
        routes.append(
            RouteOption(
                id=str(uuid.uuid4()),
                route_code=RouteCode.SEA_DIRECT,
                mode_mix=[TransportMode.SEA],
                legs=[],
                feasible=False,
                blocked=True,
                risk_level=RiskLevel.BLOCKED,
                reason_codes=["HUB_RESTRICTED_FOR_OOG"],
                evidence_ref=["route_gen:v2026.04:SEA_DIRECT:oog_restricted"],
            )
        )
    elif _is_weight_exceeded(req.gross_weight_kg, RouteCode.SEA_DIRECT):
        reason_codes.append("WEIGHT_LIMIT_EXCEEDED")
        routes.append(
            RouteOption(
                id=str(uuid.uuid4()),
                route_code=RouteCode.SEA_DIRECT,
                mode_mix=[TransportMode.SEA],
                legs=[],
                feasible=False,
                blocked=True,
                risk_level=RiskLevel.BLOCKED,
                reason_codes=["WEIGHT_LIMIT_EXCEEDED"],
                evidence_ref=["route_gen:v2026.04:SEA_DIRECT:weight_exceeded"],
            )
        )
    else:
        routes.append(_build_sea_direct(req, sea_direct_days))

    # ── SEA_TRANSSHIP ───────────────────────────────────────────────────────
    if _is_weight_exceeded(req.gross_weight_kg, RouteCode.SEA_TRANSSHIP):
        routes.append(
            RouteOption(
                id=str(uuid.uuid4()),
                route_code=RouteCode.SEA_TRANSSHIP,
                mode_mix=[TransportMode.SEA, TransportMode.SEA],
                legs=[],
                feasible=False,
                blocked=True,
                risk_level=RiskLevel.BLOCKED,
                reason_codes=["WEIGHT_LIMIT_EXCEEDED"],
                evidence_ref=["route_gen:v2026.04:SEA_TRANSSHIP:weight_exceeded"],
            )
        )
    else:
        routes.append(_build_sea_transship(req, hub, sea_to_hub_days, hub_to_pod_days))

    # ── SEA_LAND ────────────────────────────────────────────────────────────
    # OOG/HEAVY_LIFT not restricted for SEA_LAND (uses inland leg)
    if _is_weight_exceeded(req.gross_weight_kg, RouteCode.SEA_LAND):
        routes.append(
            RouteOption(
                id=str(uuid.uuid4()),
                route_code=RouteCode.SEA_LAND,
                mode_mix=[TransportMode.SEA, TransportMode.LAND],
                legs=[],
                feasible=False,
                blocked=True,
                risk_level=RiskLevel.BLOCKED,
                reason_codes=["WEIGHT_LIMIT_EXCEEDED"],
                evidence_ref=["route_gen:v2026.04:SEA_LAND:weight_exceeded"],
            )
        )
    else:
        sea_land_route = _build_sea_land(req, hub, sea_to_inland_days, inland_days)
        # Verify inland leg exists (FR-013)
        has_inland = any(leg.mode == TransportMode.LAND for leg in sea_land_route.legs)
        if not has_inland:
            sea_land_route.feasible = False
            sea_land_route.blocked = True
            sea_land_route.reason_codes.append("LANE_UNSUPPORTED")
        routes.append(sea_land_route)

    return routes
