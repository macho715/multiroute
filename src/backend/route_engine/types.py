"""Pydantic models for Route Engine domain."""
from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Annotated
from pydantic import BaseModel, Field, field_validator


# ─── Enums ──────────────────────────────────────────────────────────────────

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


class DecisionEvent(str, Enum):
    GENERATED = "GENERATED"
    EVALUATED = "EVALUATED"
    OPTIMIZED = "OPTIMIZED"
    APPROVED = "APPROVED"
    HELD = "HELD"
    OVERRIDDEN = "OVERRIDDEN"
    RE_EVALUATED = "RE_EVALUATED"


# ─── Shipment Request ────────────────────────────────────────────────────────

class DimensionsCm(BaseModel):
    length: Annotated[float, Field(gt=0, description="Length in cm")]
    width: Annotated[float, Field(gt=0, description="Width in cm")]
    height: Annotated[float, Field(gt=0, description="Height in cm")]


class COGCm(BaseModel):
    x: float = Field(description="Center of gravity X offset in cm")
    y: float = Field(description="Center of gravity Y offset in cm")
    z: float = Field(description="Center of gravity Z offset in cm")


class ShipmentRequest(BaseModel):
    request_id: str
    pol_code: str = Field(min_length=3, max_length=10)
    pod_code: str = Field(min_length=3, max_length=10)
    cargo_type: CargoType
    container_type: str
    quantity: Annotated[int, Field(gt=0)]
    dims_cm: DimensionsCm
    gross_weight_kg: Annotated[float, Field(gt=0)]
    cog_cm: COGCm | None = None
    etd_target: datetime
    required_delivery_date: date
    incoterm: str
    priority: Priority
    hs_code: str = Field(min_length=6, max_length=12, pattern=r"^\d{6,12}$")
    destination_site: str
    docs_available: list[str] | None = None
    remarks: str | None = None

    @field_validator("required_delivery_date")
    @classmethod
    def delivery_after_etd(cls, v: date, info) -> date:
        etd = info.data.get("etd_target")
        if etd and v < etd.date():
            raise ValueError("required_delivery_date must be >= etd_target date")
        return v

    @field_validator("pod_code")
    @classmethod
    def pol_pod_different(cls, v: str, info) -> str:
        if v == info.data.get("pol_code"):
            raise ValueError("pol_code and pod_code must be different")
        return v


# ─── Route Leg ────────────────────────────────────────────────────────────────

class TransportMode(str, Enum):
    SEA = "SEA"
    LAND = "LAND"
    AIR = "AIR"
    RAIL = "RAIL"


class RouteLeg(BaseModel):
    seq: Annotated[int, Field(ge=1, le=4)]
    mode: TransportMode
    origin_node: str
    destination_node: str
    carrier_code: str | None = None
    service_code: str | None = None
    base_days: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    restrictions_jsonb: dict | None = None


# ─── Route Option ─────────────────────────────────────────────────────────────

class RouteOption(BaseModel):
    id: str
    route_code: RouteCode
    mode_mix: list[TransportMode]
    legs: list[RouteLeg]
    feasible: bool = True
    blocked: bool = False
    risk_level: RiskLevel = RiskLevel.LOW
    reason_codes: list[str] = Field(default_factory=list)
    assumption_notes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)
    rule_set_version_id: str | None = None


# ─── Cost Breakdown ─────────────────────────────────────────────────────────

class CostBreakdown(BaseModel):
    base_freight_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    origin_charges_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    destination_charges_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    surcharge_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    dem_det_estimated_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    inland_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    handling_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    special_equipment_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    buffer_cost_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    total_cost_aed: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    components_jsonb: dict | None = None

    @classmethod
    def compute(
        cls,
        base_freight_aed: Decimal,
        origin_charges_aed: Decimal,
        destination_charges_aed: Decimal,
        surcharge_aed: Decimal,
        dem_det_estimated_aed: Decimal,
        inland_aed: Decimal,
        handling_aed: Decimal,
        special_equipment_aed: Decimal,
        buffer_cost_aed: Decimal,
    ) -> CostBreakdown:
        total = (
            base_freight_aed
            + origin_charges_aed
            + destination_charges_aed
            + surcharge_aed
            + dem_det_estimated_aed
            + inland_aed
            + handling_aed
            + special_equipment_aed
            + buffer_cost_aed
        )
        return cls(
            base_freight_aed=round(base_freight_aed, 2),
            origin_charges_aed=round(origin_charges_aed, 2),
            destination_charges_aed=round(destination_charges_aed, 2),
            surcharge_aed=round(surcharge_aed, 2),
            dem_det_estimated_aed=round(dem_det_estimated_aed, 2),
            inland_aed=round(inland_aed, 2),
            handling_aed=round(handling_aed, 2),
            special_equipment_aed=round(special_equipment_aed, 2),
            buffer_cost_aed=round(buffer_cost_aed, 2),
            total_cost_aed=round(total, 2),
        )


# ─── Transit Estimate ────────────────────────────────────────────────────────

class TransitEstimate(BaseModel):
    etd_target: datetime
    transit_days: Annotated[Decimal, Field(ge=Decimal("0.00"))]
    eta: datetime
    deadline_slack_days: Decimal
    buffers_jsonb: dict | None = None


# ─── Constraint Evaluation ────────────────────────────────────────────────────

class ConstraintEvaluation(BaseModel):
    deadline_ok: bool = True
    wh_ok: bool = True
    docs_ok: bool = True
    customs_ok: bool = True
    connection_ok: bool = True
    wh_impact_level: WHImpactLevel = WHImpactLevel.LOW
    docs_completeness_pct: Annotated[float, Field(ge=0.0, le=100.0)] = 100.0
    reason_codes: list[str] = Field(default_factory=list)
    input_required_codes: list[str] = Field(default_factory=list)


# ─── Ranked Route ────────────────────────────────────────────────────────────

class RankedRouteOption(BaseModel):
    route_option_id: str
    route_code: RouteCode
    rank: int | None = None
    feasible: bool = True
    blocked: bool = False
    eta: datetime | None = None
    transit_days: Decimal | None = None
    deadline_slack_days: Decimal | None = None
    total_cost_aed: Decimal | None = None
    risk_level: RiskLevel = RiskLevel.LOW
    risk_penalty: float | None = None
    wh_impact_level: WHImpactLevel = WHImpactLevel.LOW
    docs_completeness_pct: float = 100.0
    reason_codes: list[str] = Field(default_factory=list)
    assumption_notes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)
    # Internal scoring fields
    normalized_cost: float | None = None
    normalized_transit: float | None = None
    score: float | None = None


# ─── Decision Logic ──────────────────────────────────────────────────────────

class PriorityWeights(BaseModel):
    cost: float
    time: float
    risk: float
    wh: float


class DecisionLogic(BaseModel):
    priority: Priority
    weights: PriorityWeights
    normalization_method: str = "min_max"
    tie_breaker: list[str] = Field(
        default_factory=list,
    )
    penalties_applied: list[dict] = Field(default_factory=list)


# ─── Optimization Result ─────────────────────────────────────────────────────

class RuleVersion(BaseModel):
    route_rules: str
    cost_rules: str
    transit_rules: str
    doc_rules: str
    risk_rules: str


class OptimizeResponse(BaseModel):
    request_id: str
    status: RouteStatus
    recommended_route_id: str | None = None
    recommended_route_code: RouteCode | None = None
    options: list[RankedRouteOption] = Field(default_factory=list)
    decision_logic: DecisionLogic | None = None
    reason_codes: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    input_required_codes: list[str] = Field(default_factory=list)
    evidence_ref: list[str] = Field(default_factory=list)
    rule_version: RuleVersion | None = None
    feasible_count: int = 0
    total_count: int = 0
    approval_state: ApprovalState = ApprovalState.NOT_REQUESTED
    execution_eligible: bool = False
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Decision Log ────────────────────────────────────────────────────────────

class DecisionLog(BaseModel):
    id: str
    request_id: str
    event_type: DecisionEvent
    actor_id: str | None = None
    actor_role: str | None = None
    note: str | None = None
    payload_jsonb: dict | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Approval Log ───────────────────────────────────────────────────────────

class ApprovalLog(BaseModel):
    id: str
    request_id: str
    approval_state: ApprovalState
    actor_id: str
    actor_role: str
    note: str | None = None
    acknowledge_assumptions: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Decision Override Log ───────────────────────────────────────────────────

class DecisionOverrideLog(BaseModel):
    id: str
    request_id: str
    route_option_id: str
    override_type: str
    override_reason_code: str
    override_note: str | None = None
    actor_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── WH Capacity Snapshot ────────────────────────────────────────────────────

class WHCapacitySnapshot(BaseModel):
    site_code: str
    date_bucket: date
    inbound_capacity: int
    allocated_qty: int
    remaining_capacity: int
    snapshot_at: datetime


# ─── Rule Set Version ───────────────────────────────────────────────────────

class RuleSetVersion(BaseModel):
    id: str
    route_rules_version: str
    cost_rules_version: str
    transit_rules_version: str
    doc_rules_version: str
    risk_rules_version: str
    effective_at: datetime
    is_active: bool = True
