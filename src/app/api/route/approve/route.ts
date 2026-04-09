/**
 * POST /api/route/approve
 * Approval endpoint for route optimization results
 *
 * Request body:
 * {
 *   request_id: string,
 *   actor_id: string,
 *   actor_role: string,
 *   note?: string,
 *   acknowledge_assumptions?: boolean
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   execution_eligible: boolean,
 *   approval_state: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { processApproval } from "@/backend/data/approval_service";
import { persistApprovalLog, persistDecisionLog } from "@/backend/data/audit_repository";
import { RouteStatus, ApprovalState } from "@/backend/data/models";

// Allowed roles for approval
const ALLOWED_APPROVER_ROLES = new Set(["LOGISTICS_APPROVER", "OPS_ADMIN"]);

// Statuses that allow approval
const APPROVABLE_STATUSES = new Set([RouteStatus.OK, RouteStatus.REVIEW, RouteStatus.AMBER]);

// Statuses that block approval
const BLOCKED_STATUSES = new Set([RouteStatus.BLOCKED, RouteStatus.ZERO]);

interface ApproveRequestBody {
  request_id: string;
  actor_id: string;
  actor_role: string;
  note?: string;
  acknowledge_assumptions?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ApproveRequestBody = await request.json();

    // Validate required fields
    if (!body.request_id || !body.actor_id || !body.actor_role) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: request_id, actor_id, actor_role",
          execution_eligible: false,
        },
        { status: 400 }
      );
    }

    // Validate actor role
    if (!ALLOWED_APPROVER_ROLES.has(body.actor_role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Role '${body.actor_role}' is not authorized for approval. Allowed roles: ${[...ALLOWED_APPROVER_ROLES].join(", ")}`,
          execution_eligible: false,
        },
        { status: 403 }
      );
    }

    // In a real implementation, we would:
    // 1. Fetch the current optimization_result for request_id
    // 2. Fetch the current status
    // 3. Validate against current status
    // 4. Persist the approval log
    // 5. Update execution_eligible to true
    // 6. Update approval_state to APPROVED

    // For MVP, we validate the status and simulate success
    // In production, this would query the database

    // Placeholder for status lookup (would be from DB in production)
    const currentStatus = RouteStatus.OK; // Placeholder

    // Check if status allows approval
    if (BLOCKED_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot approve: status is '${currentStatus}'. BLOCKED and ZERO statuses cannot be approved.`,
          execution_eligible: false,
        },
        { status: 422 }
      );
    }

    if (!APPROVABLE_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot approve: status is '${currentStatus}'. Only OK, REVIEW, and AMBER statuses allow approval.`,
          execution_eligible: false,
        },
        { status: 422 }
      );
    }

    // Check acknowledgement for AMBER/REVIEW
    if (
      (currentStatus === RouteStatus.AMBER || currentStatus === RouteStatus.REVIEW) &&
      !body.acknowledge_assumptions
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Approval for status '${currentStatus}' requires acknowledgement of assumptions. Set acknowledge_assumptions=true to proceed.`,
          execution_eligible: false,
        },
        { status: 422 }
      );
    }

    // Process approval
    const approvalResult = processApproval(
      body.request_id,
      currentStatus,
      null, // recommended_route_option_id would be from DB in production
      body.actor_id,
      body.actor_role,
      body.note,
      body.acknowledge_assumptions ?? false
    );

    if (!approvalResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: approvalResult.message,
          execution_eligible: false,
        },
        { status: 422 }
      );
    }

    // Persist logs (in production, would save to database)
    if (approvalResult.approval_log) {
      const approvalLogRecord = persistApprovalLog(approvalResult.approval_log);
      // Would save to DB here
    }

    if (approvalResult.decision_log) {
      const decisionLogRecord = persistDecisionLog(approvalResult.decision_log);
      // Would save to DB here
    }

    return NextResponse.json({
      success: true,
      message: approvalResult.message,
      execution_eligible: true,
      approval_state: ApprovalState.APPROVED.value,
    });

  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        execution_eligible: false,
      },
      { status: 500 }
    );
  }
}
