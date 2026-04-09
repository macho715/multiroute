"""Cost Calculator: total_cost_aed = sum of all cost components."""
from __future__ import annotations

from decimal import Decimal

from .types import CostBreakdown, RouteOption, ShipmentRequest


# Simplified rate table (MVP data - would come from rate_table.yaml in production)
_BASE_FREIGHT_RATES: dict[str, dict[str, Decimal]] = {
    "SEA_DIRECT": {
        "20GP": Decimal("2800.00"),
        "40GP": Decimal("5200.00"),
        "40HC": Decimal("5600.00"),
        "LCL": Decimal("180.00"),  # per CBM
    },
    "SEA_TRANSSHIP": {
        "20GP": Decimal("2400.00"),
        "40GP": Decimal("4500.00"),
        "40HC": Decimal("4900.00"),
        "LCL": Decimal("150.00"),
    },
    "SEA_LAND": {
        "20GP": Decimal("2600.00"),
        "40GP": Decimal("4800.00"),
        "40HC": Decimal("5200.00"),
        "LCL": Decimal("160.00"),
    },
}

_ORIGIN_CHARGES: dict[str, Decimal] = {
    "AE": Decimal("320.00"),
    "SA": Decimal("380.00"),
    "QA": Decimal("350.00"),
    "BH": Decimal("340.00"),
    "OM": Decimal("360.00"),
    "DEFAULT": Decimal("400.00"),
}

_DEST_CHARGES: dict[str, Decimal] = {
    "AE": Decimal("280.00"),
    "SA": Decimal("320.00"),
    "QA": Decimal("300.00"),
    "BH": Decimal("290.00"),
    "OM": Decimal("310.00"),
    "DEFAULT": Decimal("350.00"),
}

_SURCHARGE_RATES: dict[str, Decimal] = {
    "BAF": Decimal("180.00"),
    "CAF": Decimal("60.00"),
    "PSS": Decimal("120.00"),
    "WRS": Decimal("40.00"),
}

_DEM_DET_DAYS: dict[str, Decimal] = {
    "free_time_days": Decimal("5.00"),
    "daily_rate_20gp": Decimal("85.00"),
    "daily_rate_40gp": Decimal("150.00"),
    "daily_rate_40hc": Decimal("160.00"),
}

_INLAND_RATES: dict[str, Decimal] = {
    "per_100kg": Decimal("1.20"),
    "minimum": Decimal("180.00"),
}

_HANDLING_RATES: dict[str, Decimal] = {
    "stuffing_20gp": Decimal("220.00"),
    "stuffing_40gp": Decimal("380.00"),
    "lift_on_off": Decimal("95.00"),
}

_SPECIAL_EQUIPMENT_RATES: dict[str, Decimal] = {
    "OOG": Decimal("450.00"),
    "HEAVY_LIFT": Decimal("680.00"),
    "REEFER": Decimal("380.00"),
}

_BUFFER_PCT = Decimal("0.05")  # 5% buffer on total


def _get_currency_region(code: str) -> str:
    """Extract region from port/site code."""
    return code[:2].upper() if len(code) >= 2 else "DEFAULT"


def _compute_dem_det(
    container_type: str,
    transit_days: Decimal,
) -> tuple[Decimal, bool]:
    """
    Compute DEM/DET exposure cost.

    Returns (dem_det_aed, is_estimated).
    If actual free time exceeded, estimate exposure.
    """
    free_days = _DEM_DET_DAYS["free_time_days"]
    if transit_days <= free_days:
        return Decimal("0.00"), False

    excess_days = transit_days - free_days
    rate_key = f"daily_rate_{container_type.lower()}"
    daily_rate = _DEM_DET_DAYS.get(rate_key, _DEM_DET_DAYS["daily_rate_20gp"])
    dem_det = Decimal(str(excess_days)) * daily_rate
    return round(dem_det, 2), True


def calculate_route_cost(
    route: RouteOption,
    shipment: ShipmentRequest,
    transit_days: Decimal,
) -> CostBreakdown:
    """
    Calculate total cost for a route option.

    Formula (FR-016):
    total_cost_aed = base_freight + origin_charges + destination_charges
                  + surcharge + dem_det_estimated + inland + handling
                  + special_equipment + buffer_cost

    All values in AED, rounded to 2 decimal places.
    DEM/DET stored as dem_det_estimated_aed when exposure-based.
    """
    ct = shipment.container_type.upper()
    route_key = route.route_code.value

    # Base freight
    rate_table = _BASE_FREIGHT_RATES.get(route_key, _BASE_FREIGHT_RATES["SEA_DIRECT"])
    base_freight = rate_table.get(ct, rate_table.get("20GP", Decimal("2500.00")))
    # Scale by quantity
    base_freight = base_freight * max(1, shipment.quantity)

    # Origin charges
    origin_region = _get_currency_region(shipment.pol_code)
    origin_charges = _ORIGIN_CHARGES.get(origin_region, _ORIGIN_CHARGES["DEFAULT"])
    origin_charges = origin_charges * max(1, shipment.quantity)

    # Destination charges
    dest_region = _get_currency_region(shipment.pod_code)
    dest_charges = _DEST_CHARGES.get(dest_region, _DEST_CHARGES["DEFAULT"])
    dest_charges = dest_charges * max(1, shipment.quantity)

    # Surcharges (BAF + CAF + PSS + WRS per container)
    surcharge = sum(_SURCHARGE_RATES.values()) * max(1, shipment.quantity)

    # DEM/DET
    dem_det, _ = _compute_dem_det(ct, transit_days)
    dem_det = dem_det * max(1, shipment.quantity)

    # Inland cost (SEA_LAND only)
    inland = Decimal("0.00")
    if route.route_code.value == "SEA_LAND":
        weight_charge = Decimal(str(shipment.gross_weight_kg)) / Decimal("100.0")
        inland = max(
            _INLAND_RATES["minimum"],
            weight_charge * _INLAND_RATES["per_100kg"] * max(1, shipment.quantity),
        )

    # Handling
    if ct in ("20GP", "20CONTAINER"):
        handling = _HANDLING_RATES["stuffing_20gp"] * max(1, shipment.quantity)
    else:
        handling = _HANDLING_RATES["stuffing_40gp"] * max(1, shipment.quantity)
    handling += _HANDLING_RATES["lift_on_off"] * max(1, shipment.quantity)

    # Special equipment
    special = Decimal("0.00")
    if shipment.cargo_type.value == "OOG":
        special = _SPECIAL_EQUIPMENT_RATES["OOG"] * max(1, shipment.quantity)
    elif shipment.cargo_type.value == "HEAVY_LIFT":
        special = _SPECIAL_EQUIPMENT_RATES["HEAVY_LIFT"] * max(1, shipment.quantity)

    # Buffer (5% of subtotal)
    subtotal = (
        base_freight + origin_charges + dest_charges + surcharge + dem_det + inland + handling + special
    )
    buffer_cost = (subtotal * _BUFFER_PCT).quantize(Decimal("0.01"))

    return CostBreakdown.compute(
        base_freight_aed=base_freight,
        origin_charges_aed=origin_charges,
        destination_charges_aed=dest_charges,
        surcharge_aed=surcharge,
        dem_det_estimated_aed=dem_det,
        inland_aed=inland,
        handling_aed=handling,
        special_equipment_aed=special,
        buffer_cost_aed=buffer_cost,
    )
