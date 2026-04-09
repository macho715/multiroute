"""Route Generator: SEA_DIRECT, SEA_TRANSSHIP, SEA_LAND generation."""

from __future__ import annotations

import uuid
from typing import Optional

from .types import (
    RouteCode,
    RouteOption,
    RouteLeg,
    ShipmentRequest,
    CargoType,
)


# Hub nodes for transshipment routes
HUB_NODES = ["DXB", "JEBEL ALI", "PORT RASHID"]

# Inland destinations for SEA_LAND
INLAND_DESTINATIONS = {
    "AE": ["DUBAI", "ABU DHABI", "SHARJAH", "AJMAN"],
    "SA": ["RIYADH", "JEDDAH", "DAMMAM"],
    "QA": ["DOHA"],
    "KW": ["KUWAIT CITY"],
    "BH": ["MANAMA"],
}


def generate_routes(request: ShipmentRequest) -> list[RouteOption]:
    """
    Generate feasible route candidates for the given shipment request.

    Generates SEA_DIRECT, SEA_TRANSSHIP, and SEA_LAND routes based on
    POL/POD pair and cargo restrictions.
    """
    routes: list[RouteOption] = []

    # SEA_DIRECT: Direct sea route from pol to pod
    if _is_lane_supported(request.pol_code, request.pod_code, RouteCode.SEA_DIRECT):
        direct_route = _create_sea_direct(request)
        if direct_route:
            routes.append(direct_route)

    # SEA_TRANSSHIP: Route via hub
    if _is_lane_supported(request.pol_code, request.pod_code, RouteCode.SEA_TRANSSHIP):
        transship_route = _create_sea_transship(request)
        if transship_route:
            routes.append(transship_route)

    # SEA_LAND: Sea to port + inland transport
    if _is_lane_supported(request.pol_code, request.pod_code, RouteCode.SEA_LAND):
        land_route = _create_sea_land(request)
        if land_route:
            routes.append(land_route)

    return routes


def _is_lane_supported(pol_code: str, pod_code: str, route_code: RouteCode) -> bool:
    """
    Check if the lane supports the given route type.

    In a real implementation, this would check route_rules.yaml.
    For MVP, we assume all major ports support all route types.
    """
    # MVP: Assume most lanes support all route types
    # Non-supported lanes would be defined in route_rules
    return True


def _create_sea_direct(request: ShipmentRequest) -> Optional[RouteOption]:
    """Create a SEA_DIRECT route option."""
    # Check cargo restrictions
    if not _check_cargo_restrictions(request, RouteCode.SEA_DIRECT):
        return None

    leg = RouteLeg(
        seq=1,
        mode="SEA",
        origin_node=request.pol_code,
        destination_node=request.pod_code,
        carrier_code=_get_carrier_for_lane(request.pol_code, request.pod_code),
        service_code=f"SD_{request.pol_code}_{request.pod_code}",
        base_days=_get_base_transit_days(request.pol_code, request.pod_code),
        restrictions=_get_restrictions(request),
    )

    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_DIRECT,
        mode_mix="SEA",
        feasible=True,
        blocked=False,
        legs=[leg],
        evidence_ref=[_generate_evidence_ref("ROUTE", RouteCode.SEA_DIRECT.value)],
    )


def _create_sea_transship(request: ShipmentRequest) -> Optional[RouteOption]:
    """Create a SEA_TRANSSHIP route option via hub."""
    if not _check_cargo_restrictions(request, RouteCode.SEA_TRANSSHIP):
        return None

    # Select appropriate hub based on pol/pod
    hub = _select_hub(request.pol_code, request.pod_code)

    leg1 = RouteLeg(
        seq=1,
        mode="SEA",
        origin_node=request.pol_code,
        destination_node=hub,
        carrier_code=_get_carrier_for_lane(request.pol_code, hub),
        service_code=f"TS1_{request.pol_code}_{hub}",
        base_days=_get_base_transit_days(request.pol_code, hub),
        restrictions=None,
    )

    leg2 = RouteLeg(
        seq=2,
        mode="SEA",
        origin_node=hub,
        destination_node=request.pod_code,
        carrier_code=_get_carrier_for_lane(hub, request.pod_code),
        service_code=f"TS2_{hub}_{request.pod_code}",
        base_days=_get_base_transit_days(hub, request.pod_code),
        restrictions=None,
    )

    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_TRANSSHIP,
        mode_mix="SEA-SEA",
        feasible=True,
        blocked=False,
        legs=[leg1, leg2],
        evidence_ref=[_generate_evidence_ref("ROUTE", RouteCode.SEA_TRANSSHIP.value)],
    )


def _create_sea_land(request: ShipmentRequest) -> Optional[RouteOption]:
    """Create a SEA_LAND route option with inland final leg."""
    if not _check_cargo_restrictions(request, RouteCode.SEA_LAND):
        return None

    # Check if we can generate an inland leg
    inland_dest = _get_inland_destination(request.destination_site, request.pod_code)
    if not inland_dest:
        # Cannot create SEA_LAND without valid inland destination
        return None

    leg1 = RouteLeg(
        seq=1,
        mode="SEA",
        origin_node=request.pol_code,
        destination_node=request.pod_code,
        carrier_code=_get_carrier_for_lane(request.pol_code, request.pod_code),
        service_code=f"SL_{request.pol_code}_{request.pod_code}",
        base_days=_get_base_transit_days(request.pol_code, request.pod_code),
        restrictions=None,
    )

    leg2 = RouteLeg(
        seq=2,
        mode="LAND",
        origin_node=request.pod_code,
        destination_node=inland_dest,
        carrier_code=_get_inland_carrier(inland_dest),
        service_code=f"INLAND_{request.pod_code}_{inland_dest}",
        base_days=_get_inland_transit_days(inland_dest),
        restrictions=None,
    )

    return RouteOption(
        id=str(uuid.uuid4()),
        route_code=RouteCode.SEA_LAND,
        mode_mix="SEA-LAND",
        feasible=True,
        blocked=False,
        legs=[leg1, leg2],
        evidence_ref=[_generate_evidence_ref("ROUTE", RouteCode.SEA_LAND.value)],
    )


def _check_cargo_restrictions(request: ShipmentRequest, route_code: RouteCode) -> bool:
    """
    Check if cargo type is allowed for the route.

    OOG and HEAVY_LIFT may be restricted on certain routes/hubs.
    """
    if request.cargo_type == CargoType.OOG:
        # OOG cargo may be restricted at certain hubs
        if route_code == RouteCode.SEA_TRANSSHIP:
            # Check if any hub in the route restricts OOG
            for hub in HUB_NODES:
                if _hub_restricts_oog(hub):
                    return False
    elif request.cargo_type == CargoType.HEAVY_LIFT:
        # HEAVY_LIFT may require special equipment
        # For MVP, we allow it but mark it in restrictions
        pass

    return True


def _hub_restricts_oog(hub: str) -> bool:
    """Check if hub has OOG restrictions."""
    # In production, check hub_rules.yaml
    restricted_hubs = ["PORT RASHID"]  # Example
    return hub in restricted_hubs


def _get_carrier_for_lane(origin: str, destination: str) -> str:
    """Get default carrier code for a lane."""
    # MVP: Return mock carrier codes
    carriers = ["MAERSK", "MSC", "CMA CGM", "COSCO", "HAPAG"]
    # Simple hash to pick consistent carrier for lane
    idx = hash(f"{origin}{destination}") % len(carriers)
    return carriers[idx]


def _get_inland_carrier(destination: str) -> str:
    """Get inland carrier for destination."""
    # MVP: Return mock carrier
    return "ARCO_LOGISTICS"


def _select_hub(pol_code: str, pod_code: str) -> str:
    """Select appropriate hub for transshipment."""
    # MVP: Use DXB as default hub
    return "DXB"


def _get_base_transit_days(origin: str, destination: str) -> float:
    """
    Get base transit days between ports.

    In production, this would look up rate_table.
    MVP: Return estimated days based on rough distances.
    """
    # Simplified distance-based estimation
    # Real implementation would use rate_table lookup
    distances = {
        ("JEA", "MUN"): 14.0,
        ("JEA", "BOM"): 7.0,
        ("JEA", "SGN"): 10.0,
        ("MUN", "JEA"): 16.0,
        ("BOM", "JEA"): 8.0,
        ("SGN", "JEA"): 11.0,
    }

    key = (origin, destination)
    if key in distances:
        return distances[key]

    # Default fallback
    return 12.00


def _get_inland_transit_days(destination: str) -> float:
    """Get inland transit days to destination."""
    # Default inland transit
    return 3.00


def _get_inland_destination(destination_site: str, pod_code: str) -> Optional[str]:
    """Get inland destination for SEA_LAND route."""
    # Check if destination_site maps to an inland location
    for country_codes, destinations in INLAND_DESTINATIONS.items():
        if destination_site.upper() in destinations:
            return destination_site.upper()

    # Fallback: use pod_code as inland destination
    return pod_code if pod_code else None


def _get_restrictions(request: ShipmentRequest) -> Optional[dict]:
    """Get cargo restrictions for the route."""
    restrictions = {}

    if request.cargo_type == CargoType.OOG:
        restrictions["oog_allowed"] = True
        restrictions["oog_notes"] = "Out-of-gauge cargo requires special handling"

    if request.cargo_type == CargoType.HEAVY_LIFT:
        restrictions["heavy_lift_allowed"] = True
        restrictions["heavy_lift_notes"] = "Heavy lift requires special equipment"

    return restrictions if restrictions else None


def _generate_evidence_ref(prefix: str, value: str) -> str:
        """Generate evidence reference."""
        import datetime
        ts = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{prefix}-{value}-{ts}"