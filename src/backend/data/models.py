"""
Data & Audit Models
Multi-Route Optimization MVP v1.0.0
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID


# ============================================================
# ENUMS
# ============================================================

class RouteCode(str, Enum):
    SEA_DIRECT = "SEA_DIRECT"
    SEA_TRANSSHIP = "SEA_TRANSSHIP"
    SEA_LAND = "SEA_LAND"


class RouteStatus(str, Enum):
    OK = "OK"
    REVIEW = "REVIEW"
    AMBER = "AMBER"
    BLOCKED = "BLOCKED"
    ZERO = "ZERO"


class ApprovalState(str, Enum):
    NOT_REQUESTED = "NOT_REQUESTED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    HELD = "HELD"


class Priority(str, Enum):
    NORMAL = "NORMAL"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class CargoType(str, Enum):
    GENERAL = "GENERAL"
    OOG = "OOG"
    HEAVY_LIFT = "HEAVY_LIFT"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


class WhImpactLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


class DecisionEventType(str, Enum):
    GENERATED = "GENERATED"
    EVALUATED = "EVALUATED"
    OPTIMIZED = "OPTIMIZED"
    APPROVED = "APPROVED"
    HELD = "HELD"
    OVERRIDDEN = "OVERRIDDEN"
    RE_EVALUATED = "RE_EVALUATED"


class LegMode(str, Enum):
    SEA = "SEA"
    INLAND = "INLAND"
    AIR = "AIR"


class OverrideType(str, Enum):
    ROUTE_CHANGE = "ROUTE_CHANGE"
    STATUS_OVERRIDE = "STATUS_OVERRIDE"
    FORCE_APPROVE = "FORCE_APPROVE"
    REMOVE_HOLD = "REMOVE_HOLD"


# ============================================================
# DATA CLASSES (immutable patterns)
# ============================================================

@dataclass(frozen=True)
class Dimensions:
    length: Decimal
    width: Decimal
    height: Decimal


@dataclass(frozen=True)
class COG:
    x: Decimal
    y: Decimal
    z: Decimal


@dataclass(frozen=True)
class ShipmentRequest:
    request_id: str
    pol_code: str
    pod_code: str
    cargo_type: CargoType
    container_type: str
    quantity: int
    dims_cm: Dimensions
    gross_weight_kg: Decimal
    etd_target: datetime
    required_delivery_date: date
    incoterm: str
    priority: Priority
    hs_code: str
    destination_site: str
    cog_cm: Optional[COG] = None
    docs_available: Optional[list[str]] = None
    remarks: Optional[str] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class RuleSetVersion:
    route_rules_version: str
    cost_rules_version: str
    transit_rules_version: str
    doc_rules_version: str
    risk_rules_version: str
    effective_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class RouteLeg:
    seq: int
    mode: LegMode
    origin_node: str
    destination_node: str
    carrier_code: Optional[str] = None
    service_code: Optional[str] = None
    base_days: Decimal = Decimal("0.00")
    restrictions: dict = field(default_factory=dict)
    id: Optional[UUID] = None
    route_option_id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class RouteOption:
    route_code: RouteCode
    mode_mix: str
    feasible: bool = False
    blocked: bool = False
    risk_level: RiskLevel = RiskLevel.MEDIUM
    reason_codes: list[str] = field(default_factory=list)
    assumption_notes: list[str] = field(default_factory=list)
    evidence_ref: list[str] = field(default_factory=list)
    legs: list[RouteLeg] = field(default_factory=list)
    rule_set_version_id: Optional[UUID] = None
    shipment_request_id: Optional[UUID] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class CostBreakdown:
    base_freight_aed: Decimal
    origin_charges_aed: Decimal = Decimal("0.00")
    destination_charges_aed: Decimal = Decimal("0.00")
    surcharge_aed: Decimal = Decimal("0.00")
    dem_det_estimated_aed: Decimal = Decimal("0.00")
    inland_aed: Decimal = Decimal("0.00")
    handling_aed: Decimal = Decimal("0.00")
    special_equipment_aed: Decimal = Decimal("0.00")
    buffer_cost_aed: Decimal = Decimal("0.00")
    total_cost_aed: Decimal = Decimal("0.00")
    components: dict = field(default_factory=dict)
    route_option_id: Optional[UUID] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class TransitEstimate:
    etd_target: datetime
    transit_days: Decimal
    eta: datetime
    deadline_slack_days: Decimal
    buffers: dict = field(default_factory=dict)
    route_option_id: Optional[UUID] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class ConstraintEvaluation:
    deadline_ok: bool = False
    wh_ok: bool = False
    docs_ok: bool = False
    customs_ok: bool = False
    connection_ok: bool = False
    wh_impact_level: WhImpactLevel = WhImpactLevel.LOW
    docs_completeness_pct: Decimal = Decimal("0.00")
    reason_codes: list[str] = field(default_factory=list)
    input_required_codes: list[str] = field(default_factory=list)
    route_option_id: Optional[UUID] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class OptimizationResult:
    status: RouteStatus
    feasible_count: int = 0
    total_count: int = 0
    reason_codes: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    input_required_codes: list[str] = field(default_factory=list)
    evidence_ref: list[str] = field(default_factory=list)
    decision_logic: dict = field(default_factory=dict)
    recommended_route_option_id: Optional[UUID] = None
    approval_state: ApprovalState = ApprovalState.NOT_REQUESTED
    execution_eligible: bool = False
    rule_set_version_id: Optional[UUID] = None
    shipment_request_id: Optional[UUID] = None
    id: Optional[UUID] = None
    generated_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class DecisionLog:
    request_id: str
    event_type: DecisionEventType
    actor_id: str
    actor_role: str
    route_option_id: Optional[UUID] = None
    note: Optional[str] = None
    payload: dict = field(default_factory=dict)
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class ApprovalLog:
    request_id: str
    approval_state: ApprovalState
    actor_id: str
    actor_role: str
    route_option_id: Optional[UUID] = None
    note: Optional[str] = None
    acknowledge_assumptions: bool = False
    hold_reason_code: Optional[str] = None
    hold_note: Optional[str] = None
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class DecisionOverrideLog:
    request_id: str
    override_type: OverrideType
    override_reason_code: str
    route_option_id: Optional[UUID] = None
    override_note: Optional[str] = None
    actor_id: str
    id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class WHCapacitySnapshot:
    site_code: str
    date_bucket: date
    inbound_capacity: int
    allocated_qty: int = 0
    remaining_capacity: int = 0
    snapshot_at: datetime = field(default_factory=datetime.utcnow)
    id: Optional[UUID] = None


# ============================================================
# VIEW MODELS (for API responses)
# ============================================================

@dataclass(frozen=True)
class RouteOptionView:
    route_option_id: str
    route_code: RouteCode
    rank: Optional[int]
    feasible: bool
    blocked: bool
    eta: Optional[str]
    transit_days: Optional[Decimal]
    deadline_slack_days: Optional[Decimal]
    total_cost_aed: Optional[Decimal]
    risk_level: RiskLevel
    risk_penalty: Optional[Decimal]
    wh_impact_level: WhImpactLevel
    docs_completeness_pct: Decimal
    reason_codes: list[str]
    assumption_notes: list[str]
    evidence_ref: list[str]


@dataclass(frozen=True)
class DecisionLogicView:
    priority: Priority
    weights: dict
    normalization_method: str = "min_max"
    tie_breaker: list[str] = field(default_factory=lambda: [
        "deadline_slack_days_desc",
        "risk_penalty_asc",
        "total_cost_aed_asc",
        "transit_days_asc",
        "route_code_asc"
    ])
    penalties_applied: list[dict] = field(default_factory=list)


@dataclass(frozen=True)
class DashboardResponse:
    request_id: str
    status: RouteStatus
    recommended_route_id: Optional[str]
    recommended_route_code: Optional[RouteCode]
    options: list[RouteOptionView]
    decision_logic: DecisionLogicView
    reason_codes: list[str]
    assumptions: list[str]
    input_required_codes: list[str]
    evidence_ref: list[str]
    rule_version: dict
    feasible_count: int
    total_count: int
    approval_state: ApprovalState
    execution_eligible: bool
    generated_at: datetime


@dataclass(frozen=True)
class ApprovalRequest:
    request_id: str
    actor_id: str
    actor_role: str
    note: Optional[str] = None
    acknowledge_assumptions: bool = False


@dataclass(frozen=True)
class HoldRequest:
    request_id: str
    actor_id: str
    actor_role: str
    hold_reason_code: str
    hold_note: str
    note: Optional[str] = None


@dataclass(frozen=True)
class OverrideRequest:
    request_id: str
    route_option_id: str
    override_type: OverrideType
    override_reason_code: str
    override_note: str
    actor_id: str
