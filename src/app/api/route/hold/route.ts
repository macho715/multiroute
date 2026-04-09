/**
 * POST /api/route/hold
 * Hold endpoint for route optimization results
 *
 * Request body:
 * {
 *   request_id: string,
 *   actor_id: string,
 *   actor_role: string,
 *   hold_reason_code: string,
 *   hold_note: string,
 *   note?: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   approval_state: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { processHold } from "@/backend/data/approval_service";
import { persistApprovalLog, persistDecisionLog } from "@/backend/data/audit_repository";
import { RouteStatus, ApprovalState } from "@/backend/data/models";

// Allowed roles for hold
const ALLOWED_HOLDER_ROLES = new Set(["LOGISTICS_APPROVER", "OPS_ADMIN"]);

// Statuses that block hold (ZERO/BLOCKED don't make sense to hold since they can't proceed anyway)
const HOLDABLE_STATUSES = new Set([RouteStatus.OK, RouteStatus.REVIEW, RouteStatus.AMBER, RouteStatus.BLOCKED, RouteStatus.ZERO]);

interface HoldRequestBody {
  request_id: string;
  actor_id: string;
  actor_role: string;
  hold_reason_code: string;
  hold_note: string;
  note?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: HoldRequestBody = await request.json();

    // Validate required fields
    if (!body.request_id || !body.actor_id || !body.actor_role) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: request_id, actor_id, actor_role",
        },
        { status: 400 }
      );
    }

    // Validate hold reason
    if (!body.hold_reason_code || !body.hold_reason_code.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "hold_reason_code is required",
        },
        { status: 400 }
      );
    }

    if (!body.hold_note || !body.hold_note.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "hold_note is required",
        },
        { status: 400 }
      );
    }

    // Validate actor role
    if (!ALLOWED_HOLDER_ROLES.has(body.actor_role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Role '${body.actor_role}' is not authorized to hold. Allowed roles: ${[...ALLOWED_HOLDER_ROLES].join(", ")}`,
        },
        { status: 403 }
      );
    }

    // In a real implementation, we would:
    // 1. Fetch the current optimization_result for request_id
    // 2. Fetch the current status and approval_state
    // 3. Validate against current status
    // 4. Persist the hold (approval_log with HELD state)
    // 5. Update approval_state to HELD

    // Placeholder for status lookup (would be from DB in production)
    const currentStatus = RouteStatus.OK; // Placeholder

    // Check if status allows hold
    if (!HOLDABLE_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot hold: status is '${currentStatus}'`,
        },
        { status: 422 }
      );
    }

    // Process hold
    const holdResult = processHold(
      body.request_id,
      currentStatus,
      null, // recommended_route_option_id would be from DB in production
      body.actor_id,
      body.actor_role,
      body.hold_reason_code,
      body.hold_note,
      body.note
    );

    if (!holdResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: holdResult.message,
        },
        { status: 422 }
      );
    }

    // Persist logs (in production, would save to database)
    if (holdResult.approval_log) {
      const approvalLogRecord = persistApprovalLog(holdResult.approval_log);
      // Would save to DB here
    }

    if (holdResult.decision_log) {
      const decisionLogRecord = persistDecisionLog(holdResult.decision_log);
      // Would save to DB here
    }

    return NextResponse.json({
      success: true,
      message: holdResult.message,
      approval_state: ApprovalState.HELD.value,
    });

  } catch (error) {
    console.error("Hold error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
