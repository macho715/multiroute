/**
 * Approval Service - TypeScript
 * Multi-Route Optimization MVP v1.0.0
 *
 * Handles approval and hold logic for route optimization results.
 */

import {
  ApprovalState,
  ApprovalLog,
  DecisionEventType,
  DecisionLog,
  RouteStatus,
  OverrideType,
} from "./models";

// Allowed roles for approval actions
const ALLOWED_APPROVER_ROLES = new Set(["LOGISTICS_APPROVER", "OPS_ADMIN"]);
const ALLOWED_OVERRIDE_ROLES = new Set(["OPS_ADMIN"]);

// Statuses that allow approval
const APPROVABLE_STATUSES = new Set([RouteStatus.OK, RouteStatus.REVIEW, RouteStatus.AMBER]);

// Statuses that block approval
const BLOCKED_STATUSES = new Set([RouteStatus.BLOCKED, RouteStatus.ZERO]);

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

export class UnauthorizedError extends ApprovalError {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class InvalidStatusError extends ApprovalError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStatusError";
  }
}

export class MissingFieldError extends ApprovalError {
  constructor(message: string) {
    super(message);
    this.name = "MissingFieldError";
  }
}

export interface ApprovalResult {
  success: boolean;
  message: string;
  approval_log?: ApprovalLog;
  decision_log?: DecisionLog;
  execution_eligible: boolean;
}

export interface HoldResult {
  success: boolean;
  message: string;
  approval_log?: ApprovalLog;
  decision_log?: DecisionLog;
}

export interface OverrideResult {
  success: boolean;
  message: string;
  override_log?: Record<string, unknown>;
}

function validateApprovalEligibility(
  status: RouteStatus,
  actorRole: string
): void {
  if (!ALLOWED_APPROVER_ROLES.has(actorRole)) {
    throw new UnauthorizedError(
      `Role '${actorRole}' is not authorized for approval. Allowed roles: ${[...ALLOWED_APPROVER_ROLES].join(", ")}`
    );
  }

  if (BLOCKED_STATUSES.has(status)) {
    throw new InvalidStatusError(
      `Cannot approve: status is '${status}'. Only ${[...APPROVABLE_STATUSES].join(", ")} statuses allow approval.`
    );
  }

  if (!APPROVABLE_STATUSES.has(status)) {
    throw new InvalidStatusError(
      `Cannot approve: status is '${status}'. Allowed statuses: ${[...APPROVABLE_STATUSES].join(", ")}`
    );
  }
}

function validateHoldEligibility(
  status: RouteStatus,
  actorRole: string,
  holdReasonCode: string,
  holdNote: string
): void {
  if (!ALLOWED_APPROVER_ROLES.has(actorRole)) {
    throw new UnauthorizedError(
      `Role '${actorRole}' is not authorized for hold. Allowed roles: ${[...ALLOWED_APPROVER_ROLES].join(", ")}`
    );
  }

  if (!holdReasonCode || !holdReasonCode.trim()) {
    throw new MissingFieldError("hold_reason_code is required");
  }

  if (!holdNote || !holdNote.trim()) {
    throw new MissingFieldError("hold_note is required");
  }
}

function validateOverrideEligibility(
  actorRole: string,
  _overrideType: OverrideType
): void {
  if (!ALLOWED_OVERRIDE_ROLES.has(actorRole)) {
    throw new UnauthorizedError(
      `Role '${actorRole}' is not authorized for override. Only OPS_ADMIN can perform overrides.`
    );
  }
}

function checkAcknowledgementRequired(status: RouteStatus): boolean {
  return status === RouteStatus.AMBER || status === RouteStatus.REVIEW;
}

export function processApproval(
  requestId: string,
  status: RouteStatus,
  recommendedRouteOptionId: string | null,
  actorId: string,
  actorRole: string,
  note?: string,
  acknowledgeAssumptions: boolean = false
): ApprovalResult {
  // Validate eligibility
  validateApprovalEligibility(status, actorRole);

  // Check acknowledgement for AMBER/REVIEW
  if (checkAcknowledgementRequired(status) && !acknowledgeAssumptions) {
    return {
      success: false,
      message: `Approval for status '${status}' requires acknowledgement of assumptions. Set acknowledge_assumptions=true to proceed.`,
      execution_eligible: false,
    };
  }

  // Create approval log
  const approvalLog: ApprovalLog = {
    request_id: requestId,
    route_option_id: recommendedRouteOptionId ?? undefined,
    approval_state: ApprovalState.APPROVED,
    actor_id: actorId,
    actor_role: actorRole,
    note,
    acknowledge_assumptions: acknowledgeAssumptions,
  };

  // Create decision log
  const decisionLog: DecisionLog = {
    request_id: requestId,
    route_option_id: recommendedRouteOptionId ?? undefined,
    event_type: DecisionEventType.APPROVED,
    actor_id: actorId,
    actor_role: actorRole,
    note,
    payload: {
      status,
      acknowledge_assumptions: acknowledgeAssumptions,
    },
  };

  return {
    success: true,
    message: "Approval processed successfully. execution_eligible=true.",
    approval_log: approvalLog,
    decision_log: decisionLog,
    execution_eligible: true,
  };
}

export function processHold(
  requestId: string,
  status: RouteStatus,
  recommendedRouteOptionId: string | null,
  actorId: string,
  actorRole: string,
  holdReasonCode: string,
  holdNote: string,
  note?: string
): HoldResult {
  // Validate eligibility
  validateHoldEligibility(status, actorRole, holdReasonCode, holdNote);

  // Create approval log with hold info
  const approvalLog: ApprovalLog = {
    request_id: requestId,
    route_option_id: recommendedRouteOptionId ?? undefined,
    approval_state: ApprovalState.HELD,
    actor_id: actorId,
    actor_role: actorRole,
    note,
    acknowledge_assumptions: false,
    hold_reason_code: holdReasonCode,
    hold_note: holdNote,
  };

  // Create decision log
  const decisionLog: DecisionLog = {
    request_id: requestId,
    route_option_id: recommendedRouteOptionId ?? undefined,
    event_type: DecisionEventType.HELD,
    actor_id: actorId,
    actor_role: actorRole,
    note: `Hold: ${holdReasonCode} - ${holdNote}`,
    payload: {
      status,
      hold_reason_code: holdReasonCode,
      hold_note: holdNote,
    },
  };

  return {
    success: true,
    message: "Hold processed successfully.",
    approval_log: approvalLog,
    decision_log: decisionLog,
  };
}

export function processOverride(
  requestId: string,
  routeOptionId: string,
  overrideType: OverrideType,
  overrideReasonCode: string,
  overrideNote: string,
  actorId: string,
  currentStatus: RouteStatus
): OverrideResult {
  // Validate eligibility
  validateOverrideEligibility(actorId, overrideType);

  return {
    success: true,
    message: `Override (${overrideType}) processed successfully.`,
    override_log: {
      request_id: requestId,
      route_option_id: routeOptionId,
      override_type: overrideType,
      override_reason_code: overrideReasonCode,
      override_note: overrideNote,
      actor_id: actorId,
      created_at: new Date().toISOString(),
    },
  };
}

export function getApprovalStateForStatus(
  status: RouteStatus,
  currentApprovalState: ApprovalState
): ApprovalState {
  if (BLOCKED_STATUSES.has(status)) {
    return ApprovalState.NOT_REQUESTED;
  }

  if (
    currentApprovalState === ApprovalState.APPROVED ||
    currentApprovalState === ApprovalState.HELD
  ) {
    return currentApprovalState;
  }

  return ApprovalState.PENDING;
}
