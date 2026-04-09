"""
Approval Service
Multi-Route Optimization MVP v1.0.0

Handles approval and hold logic for route optimization results.
- approve: execution_eligible=true only after approval
- hold: requires hold_reason_code, hold_note, actor info
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from .models import (
    ApprovalState,
    ApprovalLog,
    DecisionEventType,
    DecisionLog,
    HoldRequest,
    OverrideRequest,
    OverrideType,
    RouteStatus,
)


# Allowed roles for approval actions
ALLOWED_APPROVER_ROLES = {"LOGISTICS_APPROVER", "OPS_ADMIN"}
ALLOWED_OVERRIDE_ROLES = {"OPS_ADMIN"}

# Statuses that allow approval
APPROVABLE_STATUSES = {RouteStatus.OK, RouteStatus.REVIEW, RouteStatus.AMBER}

# Statuses that block approval
BLOCKED_STATUSES = {RouteStatus.BLOCKED, RouteStatus.ZERO}


class ApprovalError(Exception):
    """Base exception for approval errors"""
    pass


class UnauthorizedError(ApprovalError):
    """Actor is not authorized for this action"""
    pass


class InvalidStatusError(ApprovalError):
    """Current status does not allow this action"""
    pass


class MissingFieldError(ApprovalError):
    """Required field is missing"""
    pass


@dataclass(frozen=True)
class ApprovalResult:
    success: bool
    message: str
    approval_log: Optional[ApprovalLog] = None
    decision_log: Optional[DecisionLog] = None
    execution_eligible: bool = False


@dataclass(frozen=True)
class HoldResult:
    success: bool
    message: str
    approval_log: Optional[ApprovalLog] = None
    decision_log: Optional[DecisionLog] = None


@dataclass(frozen=True)
class OverrideResult:
    success: bool
    message: str
    override_log: Optional[dict] = None


def validate_approval_eligibility(
    status: RouteStatus,
    actor_role: str,
) -> None:
    """
    Validate if approval can proceed.
    Raises UnauthorizedError if actor_role is not allowed.
    Raises InvalidStatusError if status does not allow approval.
    """
    if actor_role not in ALLOWED_APPROVER_ROLES:
        raise UnauthorizedError(
            f"Role '{actor_role}' is not authorized for approval. "
            f"Allowed roles: {ALLOWED_APPROVER_ROLES}"
        )

    if status in BLOCKED_STATUSES:
        raise InvalidStatusError(
            f"Cannot approve: status is '{status.value}'. "
            f"Only {APPROVABLE_STATUSES} statuses allow approval."
        )

    if status not in APPROVABLE_STATUSES:
        raise InvalidStatusError(
            f"Cannot approve: status is '{status.value}'. "
            f"Allowed statuses: {APPROVABLE_STATUSES}"
        )


def validate_hold_eligibility(
    status: RouteStatus,
    actor_role: str,
    hold_reason_code: str,
    hold_note: str,
) -> None:
    """
    Validate if hold can proceed.
    Raises UnauthorizedError if actor_role is not allowed.
    Raises MissingFieldError if hold_reason_code or hold_note is missing.
    """
    if actor_role not in ALLOWED_APPROVER_ROLES:
        raise UnauthorizedError(
            f"Role '{actor_role}' is not authorized for hold. "
            f"Allowed roles: {ALLOWED_APPROVER_ROLES}"
        )

    if not hold_reason_code or not hold_reason_code.strip():
        raise MissingFieldError("hold_reason_code is required")

    if not hold_note or not hold_note.strip():
        raise MissingFieldError("hold_note is required")


def validate_override_eligibility(
    actor_role: str,
    override_type: OverrideType,
) -> None:
    """
    Validate if override can proceed.
    Raises UnauthorizedError if actor_role is not OPS_ADMIN.
    """
    if actor_role not in ALLOWED_OVERRIDE_ROLES:
        raise UnauthorizedError(
            f"Role '{actor_role}' is not authorized for override. "
            f"Only OPS_ADMIN can perform overrides."
        )


def check_acknowledgement_required(status: RouteStatus) -> bool:
    """
    Check if acknowledgement is required for the given status.
    AMBER and REVIEW require acknowledgement before approval.
    """
    return status in {RouteStatus.AMBER, RouteStatus.REVIEW}


def process_approval(
    request_id: str,
    status: RouteStatus,
    recommended_route_id: Optional[UUID],
    actor_id: str,
    actor_role: str,
    note: Optional[str] = None,
    acknowledge_assumptions: bool = False,
) -> ApprovalResult:
    """
    Process an approval request.

    Args:
        request_id: The shipment request ID
        status: Current optimization status
        recommended_route_id: The recommended route option ID
        actor_id: ID of the actor performing approval
        actor_role: Role of the actor
        note: Optional approval note
        acknowledge_assumptions: Required true for AMBER/REVIEW statuses

    Returns:
        ApprovalResult with success status and logs
    """
    # Validate eligibility
    validate_approval_eligibility(status, actor_role)

    # Check acknowledgement for AMBER/REVIEW
    if check_acknowledgement_required(status) and not acknowledge_assumptions:
        return ApprovalResult(
            success=False,
            message=(
                f"Approval for status '{status.value}' requires "
                f"acknowledgement of assumptions. "
                f"Set acknowledge_assumptions=true to proceed."
            ),
            execution_eligible=False,
        )

    # Create approval log
    approval_log = ApprovalLog(
        request_id=request_id,
        route_option_id=recommended_route_id,
        approval_state=ApprovalState.APPROVED,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        acknowledge_assumptions=acknowledge_assumptions,
    )

    # Create decision log
    decision_log = DecisionLog(
        request_id=request_id,
        route_option_id=recommended_route_id,
        event_type=DecisionEventType.APPROVED,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        payload={
            "status": status.value,
            "acknowledge_assumptions": acknowledge_assumptions,
        },
    )

    return ApprovalResult(
        success=True,
        message="Approval processed successfully. execution_eligible=true.",
        approval_log=approval_log,
        decision_log=decision_log,
        execution_eligible=True,
    )


def process_hold(
    request_id: str,
    status: RouteStatus,
    recommended_route_id: Optional[UUID],
    actor_id: str,
    actor_role: str,
    hold_reason_code: str,
    hold_note: str,
    note: Optional[str] = None,
) -> HoldResult:
    """
    Process a hold request.

    Args:
        request_id: The shipment request ID
        status: Current optimization status
        recommended_route_id: The recommended route option ID
        actor_id: ID of the actor performing hold
        actor_role: Role of the actor
        hold_reason_code: Required reason code for the hold
        hold_note: Required note explaining the hold
        note: Optional additional note

    Returns:
        HoldResult with success status and logs
    """
    # Validate eligibility
    validate_hold_eligibility(status, actor_role, hold_reason_code, hold_note)

    # Create approval log with hold info
    approval_log = ApprovalLog(
        request_id=request_id,
        route_option_id=recommended_route_id,
        approval_state=ApprovalState.HELD,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        acknowledge_assumptions=False,
        hold_reason_code=hold_reason_code,
        hold_note=hold_note,
    )

    # Create decision log
    decision_log = DecisionLog(
        request_id=request_id,
        route_option_id=recommended_route_id,
        event_type=DecisionEventType.HELD,
        actor_id=actor_id,
        actor_role=actor_role,
        note=f"Hold: {hold_reason_code} - {hold_note}",
        payload={
            "status": status.value,
            "hold_reason_code": hold_reason_code,
            "hold_note": hold_note,
        },
    )

    return HoldResult(
        success=True,
        message="Hold processed successfully.",
        approval_log=approval_log,
        decision_log=decision_log,
    )


def process_override(
    request: OverrideRequest,
    current_status: RouteStatus,
) -> OverrideResult:
    """
    Process an override request (OPS_ADMIN only).

    Args:
        request: Override request details
        current_status: Current optimization status

    Returns:
        OverrideResult with success status and logs
    """
    # Validate eligibility
    validate_override_eligibility(request.actor_id, request.override_type)

    # Create override log entry
    override_log = DecisionLog(
        request_id=request.request_id,
        route_option_id=request.route_option_id,
        event_type=DecisionEventType.OVERRIDDEN,
        actor_id=request.actor_id,
        actor_role="OPS_ADMIN",
        note=request.override_note,
        payload={
            "override_type": request.override_type.value,
            "override_reason_code": request.override_reason_code,
            "previous_status": current_status.value,
        },
    )

    return OverrideResult(
        success=True,
        message=f"Override ({request.override_type.value}) processed successfully.",
        override_log={
            "id": str(override_log.id) if override_log.id else None,
            "request_id": override_log.request_id,
            "route_option_id": str(request.route_option_id),
            "override_type": request.override_type.value,
            "override_reason_code": request.override_reason_code,
            "override_note": request.override_note,
            "actor_id": request.actor_id,
            "created_at": override_log.created_at.isoformat(),
        },
    )


def get_approval_state_for_status(
    status: RouteStatus,
    current_approval_state: ApprovalState,
) -> ApprovalState:
    """
    Determine the appropriate approval_state based on status.

    Returns NOT_REQUESTED for ZERO/BLOCKED, PENDING for others if not yet processed.
    """
    if status in BLOCKED_STATUSES:
        return ApprovalState.NOT_REQUESTED

    if current_approval_state in {ApprovalState.APPROVED, ApprovalState.HELD}:
        return current_approval_state

    return ApprovalState.PENDING
