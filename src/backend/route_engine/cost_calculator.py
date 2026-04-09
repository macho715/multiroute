"""Cost Calculator: Total cost = base_freight + origin_charges + destination_charges + surcharge + dem_det + inland + handling + special_equipment + buffer."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from .types import (
    RouteOption,
    CostBreakdown,
    ShipmentRequest,
    RouteLeg,
)


# Default rates per container type (AED)
DEFAULT_RATES = {
    "20DV": {
        "base_freight": 3500.00,
        "origin_charges": 450.00,
        "destination_charges": 550.00,
        "surcharge": 280.00,
        "handling": 180.00,
        "special_equipment": 0.00,
        "buffer": 320.00,
    },
    "40DV": {
        "base_freight": 5800.00,
        "origin_charges": 650.00,
        "destination_charges": 780.00,
        "surcharge": 420.00,
        "handling": 250.00,
        "special_equipment": 0.00,
        "buffer": 480.00,
    },
    "40HC": {
        "base_freight": 6200.00,
        "origin_charges": 680.00,
        "destination_charges": 820.00,
        "surcharge": 450.00,
        "handling": 280.00,
        "special_equipment": 0.00,
        "buffer": 520.00,
    },
    "REF": {
        "base_freight": 7000.00,
        "origin_charges": 750.00,
        "destination_charges": 900.00,
        "surcharge": 550.00,
        "handling": 320.00,
        "special_equipment": 0.00,
        "buffer": 600.00,
    },
}

# Inland transport rates per destination (AED)
INLAND_RATES = {
    "DUBAI": 450.00,
    "ABU DHABI": 680.00,
    "SHARJAH": 380.00,
    "AJMAN": 350.00,
    "RIYADH": 1200.00,
    "JEDDAH": 980.00,
    "DAMMAM": 850.00,
    "DOHA": 920.00,
    "KUWAIT CITY": 1100.00,
    "MANAMA": 780.00,
}

# Surcharge rates by route (AED)
SURCHARGE_RATES = {
    "SEA_DIRECT": 280.00,
    "SEA_TRANSSHIP": 450.00,
    "SEA_LAND": 320.00,
}

# DEM/DET rates per day (AED)
DEM_DET_RATE = 180.00
DEM_DET_FREE_DAYS = 5

# Special equipment surcharges (AED)
SPECIAL_EQUIPMENT_RATES = {
    "OOG": 850.00,
    "HEAVY_LIFT": 1200.00,
    "REF": 650.00,
}


def calculate_route_cost(
    route: RouteOption,
    request: ShipmentRequest,
) -> CostBreakdown:
    """
    Calculate total cost for a route option.

    Total = base_freight + origin_charges + destination_charges + surcharge
            + dem_det_estimated + inland + handling + special_equipment + buffer
    """
    container_type = request.container_type.upper()
    rates = _get_rates_for_container(container_type)

    # Base freight
    base_freight = rates["base_freight"] * request.quantity

    # Origin charges
    origin_charges = rates["origin_charges"] * request.quantity

    # Destination charges
    destination_charges = rates["destination_charges"] * request.quantity

    # Surcharge (varies by route type)
    surcharge = _get_surcharge(route.route_code.value) * request.quantity

    # DEM/DET estimated (exposure-based estimation)
    dem_det_estimated = _calculate_dem_det_estimated(route, request)

    # Inland cost (for SEA_LAND routes)
    inland = _calculate_inland_cost(route, request)

    # Handling
    handling = rates["handling"] * request.quantity

    # Special equipment
    special_equipment = _get_special_equipment_cost(request, route)

    # Buffer
    buffer = rates["buffer"] * request.quantity

    # Calculate total
    total_cost = (
        round(base_freight, 2)
        + round(origin_charges, 2)
        + round(destination_charges, 2)
        + round(surcharge, 2)
        + round(dem_det_estimated, 2)
        + round(inland, 2)
        + round(handling, 2)
        + round(special_equipment, 2)
        + round(buffer, 2)
    )

    components = {
        "base_freight_aed": round(base_freight, 2),
        "origin_charges_aed": round(origin_charges, 2),
        "destination_charges_aed": round(destination_charges, 2),
        "surcharge_aed": round(surcharge, 2),
        "dem_det_estimated_aed": round(dem_det_estimated, 2),
        "inland_aed": round(inland, 2),
        "handling_aed": round(handling, 2),
        "special_equipment_aed": round(special_equipment, 2),
        "buffer_cost_aed": round(buffer, 2),
    }

    return CostBreakdown(
        base_freight_aed=round(base_freight, 2),
        origin_charges_aed=round(origin_charges, 2),
        destination_charges_aed=round(destination_charges, 2),
        surcharge_aed=round(surcharge, 2),
        dem_det_estimated_aed=round(dem_det_estimated, 2),
        inland_aed=round(inland, 2),
        handling_aed=round(handling, 2),
        special_equipment_aed=round(special_equipment, 2),
        buffer_cost_aed=round(buffer, 2),
        total_cost_aed=round(total_cost, 2),
        components=components,
    )


def _get_rates_for_container(container_type: str) -> dict:
    """Get rate table for container type."""
    return DEFAULT_RATES.get(container_type, DEFAULT_RATES["20DV"])


def _get_surcharge(route_code: str) -> float:
    """Get surcharge for route type."""
    return SURCHARGE_RATES.get(route_code, 280.00)


def _calculate_dem_det_estimated(route: RouteOption, request: ShipmentRequest) -> float:
    """
    Calculate DEM/DET exposure estimate.

    For MVP, we estimate based on typical free time and potential delays.
    In production, this would use actual DEM/DET contract rates.
    """
    # Estimate potential demurrage/detention exposure
    # Assume some chance of delay based on route complexity
    route_code = route.route_code.value

    if route_code == "SEA_DIRECT":
        # Lower risk for direct routes
        exposure_days = 2.0
    elif route_code == "SEA_TRANSSHIP":
        # Higher risk due to connection uncertainty
        exposure_days = 4.0
    else:  # SEA_LAND
        # Medium risk
        exposure_days = 3.0

    # Only charge if container type supports DEM/DET
    if request.container_type.upper() in ["20DV", "40DV", "40HC"]:
        return DEM_DET_RATE * exposure_days

    return 0.00


def _calculate_inland_cost(route: RouteOption, request: ShipmentRequest) -> float:
    """Calculate inland transport cost for SEA_LAND routes."""
    if route.route_code.value != "SEA_LAND":
        return 0.00

    # Get the inland leg (second leg)
    inland_leg = None
    for leg in route.legs:
        if leg.mode == "LAND":
            inland_leg = leg
            break

    if inland_leg:
        dest = inland_leg.destination_node.upper()
        return INLAND_RATES.get(dest, 500.00) * request.quantity

    return 0.00


def _get_special_equipment_cost(request: ShipmentRequest, route: RouteOption) -> float:
    """Calculate special equipment surcharge."""
    cargo_type = request.cargo_type.value

    if cargo_type == "OOG":
        return SPECIAL_EQUIPMENT_RATES["OOG"] * request.quantity
    elif cargo_type == "HEAVY_LIFT":
        return SPECIAL_EQUIPMENT_RATES["HEAVY_LIFT"] * request.quantity

    # Check if route requires special equipment
    if route.legs:
        for leg in route.legs:
            if leg.restrictions:
                if "heavy_lift_allowed" in leg.restrictions:
                    return SPECIAL_EQUIPMENT_RATES["HEAVY_LIFT"] * request.quantity

    return 0.00


def calculate_buffer_cost(
    route: RouteOption,
    request: ShipmentRequest,
    risk_level: str,
) -> float:
    """
    Calculate buffer cost based on risk level.

    Higher risk routes get larger buffers.
    """
    base_buffer = _get_rates_for_container(request.container_type.upper()).get("buffer", 320.00)

    if risk_level == "HIGH":
        return base_buffer * 1.5 * request.quantity
    elif risk_level == "MEDIUM":
        return base_buffer * 1.2 * request.quantity
    else:
        return base_buffer * request.quantity