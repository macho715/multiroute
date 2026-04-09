"""Pydantic models for route engine."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class RouteCode(str, Enum):
    SEA_DIRECT = "SEA_DIRECT"
    SEA_TRANSSHIP = "SEA_TRANSSHIP"
    SEA_LAND = "SEA_LAND"


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


class WHImpactLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


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


class EventType(str, Enum):
    GENERATED = "GENERATED"
    EVALUATED = "EVALUATED"
    OPTIMIZED = "OPTIMIZED"
    APPROVED = "APPROVED"
    HELD = "HELD"
    OVERRIDDEN = "OVERRIDDEN"
    RE_EVALUATED = "RE_EVALUATED"


class DimsCm(BaseModel):
    length: float
    width: float
    height: float


class CogCm(BaseModel):
    x: float
    y: float
    z: float


class ShipmentRequest(BaseModel):
    request_id: str
    pol_code: str
    pod_code: str
    cargo_type: CargoType
    container_type: str
    quantity: int = Field(gt=0)
    dims_cm: DimsCm
    gross_weight_kg: float = Field(gt=0)
    cog_cm: Optional[CogCm] = None
    etd_target: datetime
    required_delivery_date: datetime
    incoterm: str
    priority: Priority
    hs_code: str
    destination_site: str
    docs_available: Optional[list[str]] = None
    remarks: Optional[str] = None


class RouteLeg(BaseModel):
    seq: int
    mode: str
    origin_node: str
    destination_node: str
    carrier_code: str
    service_code: str
    base_days: float = Field(ge=0)
    restrictions: Optional[dict] = None


class RouteOption(BaseModel):
    id: str
    route_code: RouteCode
    mode_mix: str
    feasible: bool = True
    blocked: bool = False
    legs: list[RouteLeg] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    reason_codes: list[str] = Field(default_factory=list)
    assumption_notes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)
    rule_set_version_id: Optional[str] = None


class CostBreakdown(BaseModel):
    base_freight_aed: float = 0.00
    origin_charges_aed: float = 0.00
    destination_charges_aed: float = 0.00
    surcharge_aed: float = 0.00
    dem_det_estimated_aed: float = 0.00
    inland_aed: float = 0.00
    handling_aed: float = 0.00
    special_equipment_aed: float = 0.00
    buffer_cost_aed: float = 0.00
    total_cost_aed: float = 0.00
    components: Optional[dict] = None


class TransitEstimate(BaseModel):
    etd_target: datetime
    transit_days: float = 0.00
    eta: datetime
    deadline_slack_days: float = 0.00
    buffers: Optional[dict] = None


class ConstraintEvaluation(BaseModel):
    deadline_ok: bool = True
    wh_ok: bool = True
    docs_ok: bool = True
    customs_ok: bool = True
    connection_ok: bool = True
    wh_impact_level: WHImpactLevel = WHImpactLevel.LOW
    docs_completeness_pct: float = 100.00
    reason_codes: list[str] = Field(default_factory=list)
    input_required_codes: list[str] = Field(default_factory=list)


class RouteOptionView(BaseModel):
    route_option_id: str
    route_code: RouteCode
    rank: Optional[int] = None
    feasible: bool = True
    blocked: bool = False
    eta: Optional[str] = None
    transit_days: Optional[float] = None
    deadline_slack_days: Optional[float] = None
    total_cost_aed: Optional[float] = None
    risk_level: RiskLevel = RiskLevel.LOW
    risk_penalty: Optional[float] = None
    wh_impact_level: WHImpactLevel = WHImpactLevel.LOW
    docs_completeness_pct: float = 100.00
    reason_codes: list[str] = Field(default_factory=list)
    assumption_notes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)


class WeightConfig(BaseModel):
    cost: float
    time: float
    risk: float
    wh: float


class DecisionLogicView(BaseModel):
    priority: Priority
    weights: WeightConfig
    normalization_method: str = "min_max"
    tie_breaker: list[str] = Field(default_factory=list)
    penalties_applied: list[dict] = Field(default_factory=list)


class RuleVersion(BaseModel):
    route_rules: str
    cost_rules: str
    transit_rules: str
    doc_rules: str
    risk_rules: str


class OptimizeResponse(BaseModel):
    request_id: str
    status: RouteStatus
    recommended_route_id: Optional[str] = None
    recommended_route_code: Optional[RouteCode] = None
    options: list[RouteOptionView] = Field(default_factory=list)
    decision_logic: Optional[DecisionLogicView] = None
    reason_codes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    input_required_codes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)
    rule_version: Optional[RuleVersion] = None
    feasible_count: int = 0
    total_count: int = 0
    approval_state: ApprovalState = ApprovalState.NOT_REQUESTED
    execution_eligible: bool = False
    generated_at: str


class DecisionLog(BaseModel):
    event_type: EventType
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    note: Optional[str] = None
    payload_jsonb: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ApprovalLog(BaseModel):
    approval_state: ApprovalState
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    note: Optional[str] = None
    acknowledge_assumptions: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DecisionOverrideLog(BaseModel):
    override_type: str
    override_reason_code: str
    override_note: Optional[str] = None
    actor_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WHCapacitySnapshot(BaseModel):
    site_code: str
    date_bucket: str
    inbound_capacity: float
    allocated_qty: float
    remaining_capacity: float
    snapshot_at: datetime


class RuleSetVersion(BaseModel):
    route_rules_version: str
    cost_rules_version: str
    transit_rules_version: str
    doc_rules_version: str
    risk_rules_version: str
    effective_at: datetime
    is_active: bool = True