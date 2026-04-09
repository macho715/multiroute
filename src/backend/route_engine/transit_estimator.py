"""Transit Estimator: ETA = ETD + transit_days + buffers."""

from __future__ import annotations

from datetime import datetime, timedelta

from .types import (
    RouteOption,
    TransitEstimate,
    ShipmentRequest,
)


# Buffer days from transit_rules.yaml
CUSTOMS_BUFFER_DAYS = 2.00
TRANSSHIP_BUFFER_DAYS = 4.00
INLAND_BUFFER_DAYS = 3.00


def estimate_transit(
    route: RouteOption,
    request: ShipmentRequest,
) -> TransitEstimate:
    """
    Calculate transit days and ETA.

    Formula: transit_days = sum(leg.base_days) + transship_buffer_days
             + customs_buffer_days + inland_buffer_days
             eta = etd_target + transit_days
    """
    total_transit_days = 0.00
    buffers = {}

    # Sum base days from all legs
    for leg in route.legs:
        total_transit_days += leg.base_days

    # Add transship buffer if route has multiple sea legs
    sea_legs = [leg for leg in route.legs if leg.mode == "SEA"]
    if len(sea_legs) > 1:
        total_transit_days += TRANSSHIP_BUFFER_DAYS
        buffers["transship_buffer_days"] = TRANSSHIP_BUFFER_DAYS

    # Add customs buffer
    total_transit_days += CUSTOMS_BUFFER_DAYS
    buffers["customs_buffer_days"] = CUSTOMS_BUFFER_DAYS

    # Add inland buffer if route has land leg
    land_legs = [leg for leg in route.legs if leg.mode == "LAND"]
    if land_legs:
        total_transit_days += INLAND_BUFFER_DAYS
        buffers["inland_buffer_days"] = INLAND_BUFFER_DAYS

    # Calculate ETA
    etd = request.etd_target
    eta = etd + timedelta(days=total_transit_days)

    # Calculate deadline slack
    required_delivery = request.required_delivery_date
    deadline_slack_days = (required_delivery - eta).total_seconds() / 86400

    return TransitEstimate(
        etd_target=etd,
        transit_days=round(total_transit_days, 2),
        eta=eta,
        deadline_slack_days=round(deadline_slack_days, 2),
        buffers=buffers,
    )


def calculate_deadline_slack(eta: datetime, required_delivery_date: datetime) -> float:
    """Calculate days between ETA and required delivery date."""
    slack = (required_delivery_date - eta).total_seconds() / 86400
    return round(slack, 2)


def is_deadline_met(eta: datetime, required_delivery_date: datetime) -> bool:
    """Check if delivery can meet deadline."""
    return eta <= required_delivery_date


def get_transit_summary(transit: TransitEstimate) -> dict:
    """Get human-readable transit summary."""
    return {
        "transit_days": transit.transit_days,
        "eta_formatted": transit.eta.strftime("%Y-%m-%d"),
        "deadline_slack_days": transit.deadline_slack_days,
        "buffers_applied": list(transit.buffers.keys()) if transit.buffers else [],
    }