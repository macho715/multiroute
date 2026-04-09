/**
 * Data & Audit Models - TypeScript
 * Multi-Route Optimization MVP v1.0.0
 */

// ============================================================
// ENUMS
// ============================================================

export enum RouteCode {
  SEA_DIRECT = "SEA_DIRECT",
  SEA_TRANSSHIP = "SEA_TRANSSHIP",
  SEA_LAND = "SEA_LAND",
}

export enum RouteStatus {
  OK = "OK",
  REVIEW = "REVIEW",
  AMBER = "AMBER",
  BLOCKED = "BLOCKED",
  ZERO = "ZERO",
}

export enum ApprovalState {
  NOT_REQUESTED = "NOT_REQUESTED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  HELD = "HELD",
}

export enum Priority {
  NORMAL = "NORMAL",
  URGENT = "URGENT",
  CRITICAL = "CRITICAL",
}

export enum CargoType {
  GENERAL = "GENERAL",
  OOG = "OOG",
  HEAVY_LIFT = "HEAVY_LIFT",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  BLOCKED = "BLOCKED",
}

export enum WhImpactLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  BLOCKED = "BLOCKED",
}

export enum DecisionEventType {
  GENERATED = "GENERATED",
  EVALUATED = "EVALUATED",
  OPTIMIZED = "OPTIMIZED",
  APPROVED = "APPROVED",
  HELD = "HELD",
  OVERRIDDEN = "OVERRIDDEN",
  RE_EVALUATED = "RE_EVALUATED",
}

export enum LegMode {
  SEA = "SEA",
  INLAND = "INLAND",
  AIR = "AIR",
}

export enum OverrideType {
  ROUTE_CHANGE = "ROUTE_CHANGE",
  STATUS_OVERRIDE = "STATUS_OVERRIDE",
  FORCE_APPROVE = "FORCE_APPROVE",
  REMOVE_HOLD = "REMOVE_HOLD",
}

// ============================================================
// TYPES
// ============================================================

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface COG {
  x: number;
  y: number;
  z: number;
}

export interface ShipmentRequest {
  id?: string;
  request_id: string;
  pol_code: string;
  pod_code: string;
  cargo_type: CargoType;
  container_type: string;
  quantity: number;
  dims_cm: Dimensions;
  gross_weight_kg: number;
  cog_cm?: COG;
  etd_target: string;
  required_delivery_date: string;
  incoterm: string;
  priority: Priority;
  hs_code: string;
  destination_site: string;
  docs_available?: string[];
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RuleSetVersion {
  id?: string;
  route_rules_version: string;
  cost_rules_version: string;
  transit_rules_version: string;
  doc_rules_version: string;
  risk_rules_version: string;
  effective_at?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface RouteLeg {
  id?: string;
  route_option_id?: string;
  seq: number;
  mode: LegMode;
  origin_node: string;
  destination_node: string;
  carrier_code?: string;
  service_code?: string;
  base_days: number;
  restrictions?: Record<string, unknown>;
  created_at?: string;
}

export interface RouteOption {
  id?: string;
  route_code: RouteCode;
  mode_mix: string;
  feasible: boolean;
  blocked: boolean;
  risk_level: RiskLevel;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
  legs: RouteLeg[];
  rule_set_version_id?: string;
  shipment_request_id?: string;
  created_at?: string;
}

export interface CostBreakdown {
  id?: string;
  route_option_id?: string;
  base_freight_aed: number;
  origin_charges_aed: number;
  destination_charges_aed: number;
  surcharge_aed: number;
  dem_det_estimated_aed: number;
  inland_aed: number;
  handling_aed: number;
  special_equipment_aed: number;
  buffer_cost_aed: number;
  total_cost_aed: number;
  components?: Record<string, unknown>;
  created_at?: string;
}

export interface TransitEstimate {
  id?: string;
  route_option_id?: string;
  etd_target: string;
  transit_days: number;
  eta: string;
  deadline_slack_days: number;
  buffers?: Record<string, unknown>;
  created_at?: string;
}

export interface ConstraintEvaluation {
  id?: string;
  route_option_id?: string;
  deadline_ok: boolean;
  wh_ok: boolean;
  docs_ok: boolean;
  customs_ok: boolean;
  connection_ok: boolean;
  wh_impact_level: WhImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  input_required_codes: string[];
  created_at?: string;
}

export interface OptimizationResult {
  id?: string;
  shipment_request_id: string;
  status: RouteStatus;
  recommended_route_option_id?: string;
  decision_logic?: Record<string, unknown>;
  feasible_count: number;
  total_count: number;
  reason_codes: string[];
  assumptions: string[];
  input_required_codes: string[];
  evidence_ref: string[];
  approval_state: ApprovalState;
  execution_eligible: boolean;
  rule_set_version_id?: string;
  generated_at?: string;
  updated_at?: string;
}

export interface DecisionLog {
  id?: string;
  request_id: string;
  route_option_id?: string;
  event_type: DecisionEventType;
  actor_id: string;
  actor_role: string;
  note?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

export interface ApprovalLog {
  id?: string;
  request_id: string;
  route_option_id?: string;
  approval_state: ApprovalState;
  actor_id: string;
  actor_role: string;
  note?: string;
  acknowledge_assumptions: boolean;
  hold_reason_code?: string;
  hold_note?: string;
  created_at?: string;
}

export interface DecisionOverrideLog {
  id?: string;
  request_id: string;
  route_option_id?: string;
  override_type: OverrideType;
  override_reason_code: string;
  override_note?: string;
  actor_id: string;
  created_at?: string;
}

export interface WHCapacitySnapshot {
  id?: string;
  site_code: string;
  date_bucket: string;
  inbound_capacity: number;
  allocated_qty: number;
  remaining_capacity: number;
  snapshot_at?: string;
}

// ============================================================
// VIEW MODELS
// ============================================================

export interface RouteOptionView {
  route_option_id: string;
  route_code: RouteCode;
  rank: number | null;
  feasible: boolean;
  blocked: boolean;
  eta: string | null;
  transit_days: number | null;
  deadline_slack_days: number | null;
  total_cost_aed: number | null;
  risk_level: RiskLevel;
  risk_penalty: number | null;
  wh_impact_level: WhImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
}

export interface DecisionLogicView {
  priority: Priority;
  weights: {
    cost: number;
    time: number;
    risk: number;
    wh: number;
  };
  normalization_method: string;
  tie_breaker: string[];
  penalties_applied: Array<{
    code: string;
    value: number;
    description: string;
  }>;
}

export interface DashboardResponse {
  request_id: string;
  status: RouteStatus;
  recommended_route_id: string | null;
  recommended_route_code: RouteCode | null;
  options: RouteOptionView[];
  decision_logic: DecisionLogicView;
  reason_codes: string[];
  assumptions: string[];
  input_required_codes: string[];
  evidence_ref: string[];
  rule_version: {
    route_rules: string;
    cost_rules: string;
    transit_rules: string;
    doc_rules: string;
    risk_rules: string;
  };
  feasible_count: number;
  total_count: number;
  approval_state: ApprovalState;
  execution_eligible: boolean;
  generated_at: string;
}

// ============================================================
// REQUEST TYPES
// ============================================================

export interface ApproveRequest {
  request_id: string;
  actor_id: string;
  actor_role: string;
  note?: string;
  acknowledge_assumptions?: boolean;
}

export interface HoldRequest {
  request_id: string;
  actor_id: string;
  actor_role: string;
  hold_reason_code: string;
  hold_note: string;
  note?: string;
}

export interface OverrideRequest {
  request_id: string;
  route_option_id: string;
  override_type: OverrideType;
  override_reason_code: string;
  override_note: string;
  actor_id: string;
}
