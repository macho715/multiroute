// Route Workbench Type Definitions
// Following Spec.md v1.0.0 and layout.md

export type RouteStatus = 'OK' | 'REVIEW' | 'AMBER' | 'BLOCKED' | 'ZERO';
export type WorkbenchViewMode = 'overview' | 'compare' | 'audit';
export type ScenarioMode = 'recommended' | 'cheapest' | 'fastest';
export type ApprovalState = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'HELD';
export type DrawerTab = 'overview' | 'legs' | 'cost' | 'transit' | 'docs' | 'wh' | 'evidence' | 'trace';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type WHImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type RouteCode = 'SEA_DIRECT' | 'SEA_TRANSSHIP' | 'SEA_LAND';

// === Shipment Request ===
export interface DimsCm {
  length: number;
  width: number;
  height: number;
}

export interface CogCm {
  x: number;
  y: number;
  z: number;
}

export interface ShipmentRequest {
  request_id: string;
  pol_code: string;
  pod_code: string;
  cargo_type: 'GENERAL' | 'OOG' | 'HEAVY_LIFT';
  container_type: string;
  quantity: number;
  dims_cm: DimsCm;
  gross_weight_kg: number;
  cog_cm?: CogCm;
  etd_target: string;
  required_delivery_date: string;
  incoterm: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  hs_code: string;
  destination_site: string;
  docs_available?: string[];
  remarks?: string;
}

// === Route Option View ===
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
  wh_impact_level: WHImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
}

// === Decision Logic ===
export interface PriorityWeights {
  cost: number;
  time: number;
  risk: number;
  wh: number;
}

export interface PenaltyApplied {
  code: string;
  value: number;
  description: string;
}

export interface DecisionLogicView {
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  weights: PriorityWeights;
  normalization_method: 'min_max';
  tie_breaker: string[];
  penalties_applied: PenaltyApplied[];
}

// === Rule Version ===
export interface RuleVersion {
  route_rules: string;
  cost_rules: string;
  transit_rules: string;
  doc_rules: string;
  risk_rules: string;
}

// === Optimize Response ===
export interface OptimizeResponse {
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
  rule_version: RuleVersion;
  feasible_count: number;
  total_count: number;
  approval_state: ApprovalState;
  execution_eligible: boolean;
  generated_at: string;
}

// === Cost Breakdown ===
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
  components_jsonb?: Record<string, number>;
}

// === Route Leg ===
export interface RouteLeg {
  seq: number;
  mode: string;
  origin_node: string;
  destination_node: string;
  carrier_code: string;
  service_code: string;
  base_days: number;
  restrictions_jsonb?: Record<string, unknown>;
}

// === Transit Estimate ===
export interface TransitEstimate {
  etd_target: string;
  transit_days: number;
  eta: string;
  deadline_slack_days: number;
  buffers_jsonb?: {
    customs_days: number;
    transship_days: number;
    inland_days: number;
  };
}

// === Constraint Evaluation ===
export interface ConstraintEvaluation {
  deadline_ok: boolean;
  wh_ok: boolean;
  docs_ok: boolean;
  customs_ok: boolean;
  connection_ok: boolean;
  wh_impact_level: WHImpactLevel;
  docs_completeness_pct: number;
  reason_codes_jsonb: string[];
  input_required_codes_jsonb: string[];
}

// === Approval Log ===
export interface ApprovalLog {
  approval_state: ApprovalState;
  actor_id: string;
  actor_role: string;
  note?: string;
  acknowledge_assumptions: boolean;
  created_at: string;
}

// === Decision Log ===
export interface DecisionLog {
  event_type: 'GENERATED' | 'EVALUATED' | 'OPTIMIZED' | 'APPROVED' | 'HELD' | 'OVERRIDDEN' | 'RE_EVALUATED';
  actor_id: string;
  actor_role: string;
  note?: string;
  payload_jsonb?: Record<string, unknown>;
  created_at: string;
}

// === Workbench UI State ===
export interface WorkbenchFilters {
  feasibleOnly: boolean;
  docsReadyOnly: boolean;
  whSafeOnly: boolean;
  lowRiskOnly: boolean;
}

export interface WorkbenchUIState {
  viewMode: WorkbenchViewMode;
  scenarioMode: ScenarioMode;
  selectedRouteId: string | null;
  activeDrawerTab: DrawerTab;
  isDrawerOpen: boolean;
  isApprovalModalOpen: boolean;
  filters: WorkbenchFilters;
}

// === Context Rail Cards ===
export interface ShipmentSummary {
  pol_code: string;
  pod_code: string;
  cargo_type: string;
  container_type: string;
  quantity: number;
  dims_cm: DimsCm;
  gross_weight_kg: number;
  cog_cm?: CogCm;
  etd_target: string;
  required_delivery_date: string;
  incoterm: string;
  destination_site: string;
}

export interface MissingInput {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface HardConstraint {
  code: string;
  description: string;
  blocked: boolean;
}

// === Evidence Drawer Data ===
export interface RouteOverviewData {
  route_option_id: string;
  route_code: RouteCode;
  rank: number | null;
  feasible: boolean;
  blocked: boolean;
  total_cost_aed: number | null;
  transit_days: number | null;
  eta: string | null;
  risk_level: RiskLevel;
  wh_impact_level: WHImpactLevel;
  docs_completeness_pct: number;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
}

export interface CostBreakdownData {
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
}

export interface TransitData {
  etd_target: string;
  transit_days: number;
  eta: string;
  deadline_slack_days: number;
  buffers: {
    customs_days: number;
    transship_days: number;
    inland_days: number;
  };
}

export interface DocsCustomsData {
  required_docs: string[];
  available_docs: string[];
  customs_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  unresolved_checks: string[];
}

export interface WHImpactData {
  site_code: string;
  date_bucket: string;
  inbound_capacity: number;
  allocated_qty: number;
  remaining_capacity: number;
  overload_risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface EvidenceRuleVersionData {
  evidence_ref: string[];
  rule_version: RuleVersion;
  route_rules_content?: string;
  cost_rules_content?: string;
  transit_rules_content?: string;
  doc_rules_content?: string;
  risk_rules_content?: string;
}

export interface ApprovalTraceData {
  approval_logs: ApprovalLog[];
  decision_logs: DecisionLog[];
}

// === Status Display Config ===
export interface StatusDisplayConfig {
  label: string;
  color: string;
  icon: string;
  bgColor: string;
}

export const STATUS_DISPLAY_CONFIG: Record<RouteStatus, StatusDisplayConfig> = {
  OK: {
    label: 'Recommended',
    color: 'text-green-700',
    icon: 'check-circle',
    bgColor: 'bg-green-50',
  },
  REVIEW: {
    label: 'Review Required',
    color: 'text-yellow-700',
    icon: 'alert-triangle',
    bgColor: 'bg-yellow-50',
  },
  AMBER: {
    label: 'Assumptions Active',
    color: 'text-amber-700',
    icon: 'alert-circle',
    bgColor: 'bg-amber-50',
  },
  BLOCKED: {
    label: 'No Feasible Route',
    color: 'text-red-700',
    icon: 'x-circle',
    bgColor: 'bg-red-50',
  },
  ZERO: {
    label: 'Input Required',
    color: 'text-gray-700',
    icon: 'alert-octagon',
    bgColor: 'bg-gray-100',
  },
};