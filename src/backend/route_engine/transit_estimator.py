"""Transit Estimator: ETA = ETD + transit_days + buffers."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from .types import RouteOption, ShipmentRequest, TransitEstimate


# Transit buffers from transit_rules.yaml (FR-019)
_BUFFER_CUSTOMs = Decimal("2.00")
_BUFFER_TRANSSHIP = Decimal("4.00")
_BUFFER_INLAND = Decimal("3.00")


def estimate_transit(route: RouteOption, etd_target: datetime) -> TransitEstimate:
    """
    Estimate transit time and ETA for a route.

    Formula (FR-019):
    transit_days = sum(leg.base_days)
                 + transship_buffer_days (if transshipment)
                 + customs_buffer_days
                 + inland_buffer_days (if inland leg)

    ETA (FR-020) = etd_target + transit_days
    deadline_slack_days (FR-021) = required_delivery_date - eta_date
    """
    # Sum base days from all legs
    total_base_days = sum(leg.base_days for leg in route.legs)

    # Add buffers
    transship_buffer = Decimal("0.00")
    customs_buffer = _BUFFER_CUSTOMs
    inland_buffer = Decimal("0.00")

    # SEA_TRANSSHIP gets transship buffer
    if route.route_code.value == "SEA_TRANSSHIP":
        transship_buffer = _BUFFER_TRANSSHIP

    # SEA_LAND gets inland buffer
    if route.route_code.value == "SEA_LAND":
        inland_buffer = _BUFFER_INLAND

    transit_days = total_base_days + transship_buffer + customs_buffer + inland_buffer

    # Compute ETA
    # Use Decimal arithmetic for days precision, then convert to datetime
    days_float = float(transit_days)
    eta = etd_target + timedelta(days=days_float)

    buffers_jsonb = {
        "customs_days": float(_BUFFER_CUSTOMs),
        "transship_days": float(transship_buffer),
        "inland_days": float(inland_buffer),
        "base_days": float(total_base_days),
        "total_transit_days": float(transit_days),
    }

    return TransitEstimate(
        etd_target=etd_target,
        transit_days=transit_days,
        eta=eta,
        deadline_slack_days=Decimal("0.00"),  # Computed in optimize phase with delivery date
        buffers_jsonb=buffers_jsonb,
    )


def compute_deadline_slack(eta: datetime, required_delivery_date, transit_days: Decimal) -> Decimal:
    """
    Compute deadline slack days.

    slack = required_delivery_date - eta_date
    Positive = early, negative = late
    """
    delivery_dt = datetime.combine(required_delivery_date, datetime.min.time())
    slack_delta = delivery_dt - eta
    slack_days = Decimal(str(slack_delta.days)) + Decimal(str(slack_delta.seconds)) / Decimal("86400")
    return round(slack_days, 2)
