/**
 * GET /api/route/dashboard/[request_id]
 * Dashboard endpoint for route optimization results
 *
 * Returns:
 * {
 *   request_id: string,
 *   status: string,
 *   recommended_route_id: string | null,
 *   recommended_route_code: string | null,
 *   options: RouteOptionView[],
 *   decision_logic: DecisionLogicView,
 *   reason_codes: string[],
 *   assumptions: string[],
 *   input_required_codes: string[],
 *   evidence_ref: string[],
 *   rule_version: {...},
 *   feasible_count: number,
 *   total_count: number,
 *   approval_state: string,
 *   execution_eligible: boolean,
 *   generated_at: string,
 *   approval_trace: ApprovalTrace | null
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadApprovalTrace,
  getAuditTimeline,
  buildOptimizationAuditSummary,
} from "@/backend/data/audit_repository";
import {
  RouteStatus,
  ApprovalState,
  RouteCode,
  DecisionLogicView,
  RouteOptionView,
  ApprovalLog,
  DecisionOverrideLog,
} from "@/backend/data/models";

// Allowed roles for dashboard access
const ALLOWED_VIEWER_ROLES = new Set(["OPS_ADMIN", "LOGISTICS_APPROVER", "LOGISTICS_REVIEWER", "LOGISTICS_VIEWER"]);

interface RouteParams {
  params: Promise<{ request_id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { request_id } = await params;

    if (!request_id) {
      return NextResponse.json(
        {
          success: false,
          message: "request_id is required",
        },
        { status: 400 }
      );
    }

    // In a real implementation, we would:
    // 1. Fetch the optimization_result for request_id
    // 2. Fetch all route_options for this request
    // 3. Fetch decision_logs, approval_logs, override_logs
    // 4. Build the dashboard response

    // Placeholder response (would be from DB in production)
    // This demonstrates the expected response structure

    const placeholderResponse = {
      success: true,
      request_id: request_id,
      status: RouteStatus.OK.value,
      recommended_route_id: null,
      recommended_route_code: null,
      options: [] as RouteOptionView[],
      decision_logic: {
        priority: "NORMAL",
        weights: {
          cost: 0.50,
          time: 0.25,
          risk: 0.15,
          wh: 0.10,
        },
        normalization_method: "min_max",
        tie_breaker: [
          "deadline_slack_days_desc",
          "risk_penalty_asc",
          "total_cost_aed_asc",
          "transit_days_asc",
          "route_code_asc",
        ],
        penalties_applied: [],
      } as DecisionLogicView,
      reason_codes: [] as string[],
      assumptions: [] as string[],
      input_required_codes: [] as string[],
      evidence_ref: [] as string[],
      rule_version: {
        route_rules: "v2026.04",
        cost_rules: "v2026.04",
        transit_rules: "v2026.04",
        doc_rules: "v2026.04",
        risk_rules: "v2026.04",
      },
      feasible_count: 0,
      total_count: 0,
      approval_state: ApprovalState.NOT_REQUESTED.value,
      execution_eligible: false,
      generated_at: new Date().toISOString(),
      approval_trace: null,
    };

    return NextResponse.json(placeholderResponse);

  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Build a complete dashboard response from database records
 * This would be used in production to fetch real data
 */
export function buildDashboardResponse(
  requestId: string,
  status: RouteStatus,
  recommendedRouteOptionId: string | null,
  recommendedRouteCode: string | null,
  options: RouteOptionView[],
  decisionLogic: DecisionLogicView,
  reasonCodes: string[],
  assumptions: string[],
  inputRequiredCodes: string[],
  evidenceRef: string[],
  ruleVersion: Record<string, string>,
  feasibleCount: number,
  totalCount: number,
  approvalState: ApprovalState,
  executionEligible: boolean,
  generatedAt: Date,
  approvalTrace: ReturnType<typeof loadApprovalTrace> | null
) {
  return {
    request_id: requestId,
    status: status.value,
    recommended_route_id: recommendedRouteOptionId,
    recommended_route_code: recommendedRouteCode,
    options: options.map((opt) => ({
      route_option_id: opt.route_option_id,
      route_code: opt.route_code.value,
      rank: opt.rank,
      feasible: opt.feasible,
      blocked: opt.blocked,
      eta: opt.eta,
      transit_days: opt.transit_days?.toString() ?? null,
      deadline_slack_days: opt.deadline_slack_days?.toString() ?? null,
      total_cost_aed: opt.total_cost_aed?.toString() ?? null,
      risk_level: opt.risk_level.value,
      risk_penalty: opt.risk_penalty?.toString() ?? null,
      wh_impact_level: opt.wh_impact_level.value,
      docs_completeness_pct: parseFloat(opt.docs_completeness_pct.toString()),
      reason_codes: opt.reason_codes,
      assumption_notes: opt.assumption_notes,
      evidence_ref: opt.evidence_ref,
    })),
    decision_logic: {
      priority: decisionLogic.priority.value,
      weights: decisionLogic.weights,
      normalization_method: decisionLogic.normalization_method,
      tie_breaker: decisionLogic.tie_breaker,
      penalties_applied: decisionLogic.penalties_applied,
    },
    reason_codes: reasonCodes,
    assumptions: assumptions,
    input_required_codes: inputRequiredCodes,
    evidence_ref: evidenceRef,
    rule_version: ruleVersion,
    feasible_count: feasibleCount,
    total_count: totalCount,
    approval_state: approvalState.value,
    execution_eligible: executionEligible,
    generated_at: generatedAt.toISOString(),
    approval_trace: approvalTrace
      ? {
          request_id: approvalTrace.request_id,
          current_state: approvalTrace.current_state.value,
          execution_eligible: approvalTrace.execution_eligible,
          history: approvalTrace.approval_history.map((log) => ({
            approval_state: log.approval_state.value,
            actor_id: log.actor_id,
            actor_role: log.actor_role,
            note: log.note,
            acknowledge_assumptions: log.acknowledge_assumptions,
            hold_reason_code: log.hold_reason_code,
            hold_note: log.hold_note,
            created_at: log.created_at.toISOString(),
          })),
        }
      : null,
  };
}
