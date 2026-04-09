/**
 * Shared TypeScript types for Route Optimization API.
 * Mirrors the Python Pydantic models in src/backend/route_engine/types.py
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type RouteCode = "SEA_DIRECT" | "SEA_TRANSSHIP" | "SEA_LAND";
export type Priority = "NORMAL" | "URGENT" | "CRITICAL";
export type CargoType = "GENERAL" | "OOG" | "HEAVY_LIFT";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type WHImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type RouteStatus = "OK" | "REVIEW" | "AMBER" | "BLOCKED" | "ZERO";
export type ApprovalState = "NOT_REQUESTED" | "PENDING" | "APPROVED" | "HELD";

// ─── Input ──────────────────────────────────────────────────────────────────

export interface DimensionsCm {
  length: number;
  width: number;
  height: number;
}

export interface COGCm {
  x: number;
  y: number;
  z: number;
}

export interface ShipmentRequest {
  request_id: string;
  pol_code: string;
  pod_code: string;
  cargo_type: CargoType;
  container_type: string;
  quantity: number;
  dims_cm: DimensionsCm;
  gross_weight_kg: number;
  cog_cm?: COGCm;
  etd_target: string; // ISO datetime
  required_delivery_date: string; // ISO date
  incoterm: string;
  priority: Priority;
  hs_code: string;
  destination_site: string;
  docs_available?: string[];
  remarks?: string;
}

// ─── Route Option ────────────────────────────────────────────────────────────

export interface RouteLeg {
  seq: number;
  mode: "SEA" | "LAND" | "AIR" | "RAIL";
  origin_node: string;
  destination_node: string;
  carrier_code?: string;
  service_code?: string;
  base_days: number;
  restrictions_jsonb?: Record<string, unknown>;
}

export interface RouteOption {
  id: string;
  route_code: RouteCode;
  mode_mix: Array<"SEA" | "LAND" | "AIR" | "RAIL">;
  legs: RouteLeg[];
  feasible: boolean;
  blocked: boolean;
  risk_level: RiskLevel;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
  rule_set_version_id?: string;
}

// ─── Cost Breakdown ──────────────────────────────────────────────────────────

export interface CostBreakdown {
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
  components_jsonb?: Record<string, unknown>;
}

// ─── Transit Estimate ─────────────────────────────────────────────────────────

export interface TransitEstimate {
  etd_target: string; // ISO datetime
  transit_days: number;
  eta: string; // ISO datetime
  deadline_slack_days: number;
  buffers_jsonb?: Record<string, number>;
}

// ─── Constraint Evaluation ───────────────────────────────────────────────────

export interface ConstraintEvaluation {
  deadline_ok: boolean;
  wh_ok: boolean;
  docs_ok: boolean;
  customs_ok: boolean;
  connection_ok: boolean;
  wh_impact_level: WHImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  input_required_codes: string[];
}

// ─── Ranked Route ─────────────────────────────────────────────────────────────

export interface RankedRouteOption {
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
  wh_impact_level: WHImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
}

// ─── Decision Logic ──────────────────────────────────────────────────────────

export interface PriorityWeights {
  cost: number;
  time: number;
  risk: number;
  wh: number;
}

export interface DecisionLogic {
  priority: Priority;
  weights: PriorityWeights;
  normalization_method: string;
  tie_breaker: string[];
  penalties_applied: Array<{ code: string; value: number; description: string }>;
}

// ─── Rule Version ─────────────────────────────────────────────────────────────

export interface RuleVersion {
  route_rules: string;
  cost_rules: string;
  transit_rules: string;
  doc_rules: string;
  risk_rules: string;
}

// ─── Optimize Response ──────────────────────────────────────────────────────

export interface OptimizeResponse {
  request_id: string;
  status: RouteStatus;
  recommended_route_id: string | null;
  recommended_route_code: RouteCode | null;
  options: RankedRouteOption[];
  decision_logic: DecisionLogic | null;
  reason_codes: string[];
  assumptions: string[];
  input_required_codes: string[];
  evidence_ref: string[];
  rule_version: RuleVersion | null;
  feasible_count: number;
  total_count: number;
  approval_state: ApprovalState;
  execution_eligible: boolean;
  generated_at: string;
}

// ─── Generate Response ────────────────────────────────────────────────────────

export interface GenerateResponse {
  request_id: string;
  routes: RouteOption[];
  generated_at: string;
}

// ─── Evaluate Response ───────────────────────────────────────────────────────

export interface EvaluateResponse {
  request_id: string;
  evaluations: Array<{
    route_id: string;
    route_code: RouteCode;
    cost: CostBreakdown;
    transit: TransitEstimate;
    constraint: ConstraintEvaluation;
  }>;
  evaluated_at: string;
}

// ─── Approval Request ────────────────────────────────────────────────────────

export interface ApprovalRequest {
  request_id: string;
  route_option_id: string;
  acknowledge_assumptions?: boolean;
  note?: string;
}

// ─── Hold Request ────────────────────────────────────────────────────────────

export interface HoldRequest {
  request_id: string;
  hold_reason_code: string;
  note?: string;
}
