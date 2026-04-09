/**
 * Audit Repository - TypeScript
 * Multi-Route Optimization MVP v1.0.0
 *
 * Handles audit log persistence for decision tracking and compliance.
 */

import {
  ApprovalLog,
  ApprovalState,
  DecisionEventType,
  DecisionLog,
  DecisionOverrideLog,
  OverrideType,
  RouteOption,
  RouteStatus,
} from "./models";

export interface AuditRecord {
  request_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  timestamp: string;
  note?: string;
  payload: Record<string, unknown>;
}

export interface ApprovalTrace {
  request_id: string;
  approval_history: ApprovalLog[];
  override_history: DecisionOverrideLog[];
  current_state: ApprovalState;
  execution_eligible: boolean;
}

export function persistDecisionLog(log: DecisionLog): Record<string, unknown> {
  return {
    id: log.id ?? null,
    request_id: log.request_id,
    route_option_id: log.route_option_id ?? null,
    event_type: log.event_type,
    actor_id: log.actor_id,
    actor_role: log.actor_role,
    note: log.note ?? null,
    payload_jsonb: log.payload ?? {},
    created_at: log.created_at ?? new Date().toISOString(),
  };
}

export function persistApprovalLog(log: ApprovalLog): Record<string, unknown> {
  return {
    id: log.id ?? null,
    request_id: log.request_id,
    route_option_id: log.route_option_id ?? null,
    approval_state: log.approval_state,
    actor_id: log.actor_id,
    actor_role: log.actor_role,
    note: log.note ?? null,
    acknowledge_assumptions: log.acknowledge_assumptions,
    hold_reason_code: log.hold_reason_code ?? null,
    hold_note: log.hold_note ?? null,
    created_at: log.created_at ?? new Date().toISOString(),
  };
}

export function persistDecisionOverrideLog(
  log: DecisionOverrideLog
): Record<string, unknown> {
  return {
    id: log.id ?? null,
    request_id: log.request_id,
    route_option_id: log.route_option_id ?? null,
    override_type: log.override_type,
    override_reason_code: log.override_reason_code,
    override_note: log.override_note ?? null,
    actor_id: log.actor_id,
    created_at: log.created_at ?? new Date().toISOString(),
  };
}

export function loadApprovalTrace(
  requestId: string,
  approvalLogs: ApprovalLog[],
  overrideLogs: DecisionOverrideLog[],
  currentState: ApprovalState,
  executionEligible: boolean
): ApprovalTrace {
  return {
    request_id: requestId,
    approval_history: [...approvalLogs],
    override_history: [...overrideLogs],
    current_state: currentState,
    execution_eligible: executionEligible,
  };
}

export function getAuditTimeline(
  decisionLogs: DecisionLog[],
  approvalLogs: ApprovalLog[],
  overrideLogs: DecisionOverrideLog[]
): AuditRecord[] {
  const records: AuditRecord[] = [];

  // Add decision logs
  for (const log of decisionLogs) {
    records.push({
      request_id: log.request_id,
      event_type: log.event_type,
      actor_id: log.actor_id,
      actor_role: log.actor_role,
      timestamp: log.created_at ?? new Date().toISOString(),
      note: log.note ?? undefined,
      payload: log.payload ?? {},
    });
  }

  // Add approval logs
  for (const log of approvalLogs) {
    records.push({
      request_id: log.request_id,
      event_type: `APPROVAL_${log.approval_state}`,
      actor_id: log.actor_id,
      actor_role: log.actor_role,
      timestamp: log.created_at ?? new Date().toISOString(),
      note: log.note ?? undefined,
      payload: log.hold_reason_code
        ? {
            acknowledge_assumptions: log.acknowledge_assumptions,
            hold_reason_code: log.hold_reason_code,
            hold_note: log.hold_note,
          }
        : { acknowledge_assumptions: log.acknowledge_assumptions },
    });
  }

  // Add override logs
  for (const log of overrideLogs) {
    records.push({
      request_id: log.request_id,
      event_type: `OVERRIDE_${log.override_type}`,
      actor_id: log.actor_id,
      actor_role: "OPS_ADMIN",
      timestamp: log.created_at ?? new Date().toISOString(),
      note: log.override_note ?? undefined,
      payload: {
        override_type: log.override_type,
        override_reason_code: log.override_reason_code,
      },
    });
  }

  // Sort by timestamp
  records.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return records;
}

export function buildOptimizationAuditSummary(
  requestId: string,
  status: RouteStatus,
  recommendedRouteOptionId: string | null,
  feasibleCount: number,
  totalCount: number,
  approvalState: ApprovalState,
  executionEligible: boolean,
  reasonCodes: string[],
  assumptions: string[],
  inputRequiredCodes: string[],
  evidenceRef: string[],
  generatedAt: string,
  routeOptionsCount: number,
  decisionLogCount: number,
  timeline: Array<{
    event: string;
    actor: string;
    timestamp: string;
    note?: string;
  }>
): Record<string, unknown> {
  return {
    request_id: requestId,
    status,
    recommended_route_id: recommendedRouteOptionId,
    feasible_count: feasibleCount,
    total_count: totalCount,
    approval_state: approvalState,
    execution_eligible: executionEligible,
    reason_codes: reasonCodes,
    assumptions: assumptions,
    input_required_codes: inputRequiredCodes,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
    route_options_count: routeOptionsCount,
    decision_log_count: decisionLogCount,
    timeline,
  };
}

export function validateAuditIntegrity(
  executionEligible: boolean,
  decisionLogs: DecisionLog[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (executionEligible) {
    const approvedLogs = decisionLogs.filter(
      (log) => log.event_type === DecisionEventType.APPROVED
    );
    if (approvedLogs.length === 0) {
      issues.push("execution_eligible=true but no APPROVED event found");
    }
  }

  const now = new Date();
  for (const log of decisionLogs) {
    const logTime = new Date(log.created_at ?? now);
    if (logTime > now) {
      issues.push(
        `Decision log ${log.id} has future timestamp: ${log.created_at}`
      );
    }
  }

  return { valid: issues.length === 0, issues };
}
