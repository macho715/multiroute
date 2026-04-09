"""
Audit Repository
Multi-Route Optimization MVP v1.0.0

Handles audit log persistence for decision tracking and compliance.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import UUID

from .models import (
    ApprovalLog,
    ApprovalState,
    DecisionEventType,
    DecisionLog,
    DecisionOverrideLog,
    OptimizationResult,
    OverrideType,
    RouteOption,
    RouteStatus,
)


@dataclass(frozen=True)
class AuditRecord:
    """Combined audit record for dashboard view"""
    request_id: str
    event_type: str
    actor_id: str
    actor_role: str
    timestamp: datetime
    note: Optional[str] = None
    payload: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ApprovalTrace:
    """Approval trace for a specific request"""
    request_id: str
    approval_history: list[ApprovalLog]
    override_history: list[DecisionOverrideLog]
    current_state: ApprovalState
    execution_eligible: bool


def persist_decision_log(
    log: DecisionLog,
) -> dict:
    """
    Persist a decision log entry.

    Returns a dictionary representation suitable for DB insertion.
    """
    return {
        "id": str(log.id) if log.id else None,
        "request_id": log.request_id,
        "route_option_id": str(log.route_option_id) if log.route_option_id else None,
        "event_type": log.event_type.value,
        "actor_id": log.actor_id,
        "actor_role": log.actor_role,
        "note": log.note,
        "payload_jsonb": log.payload,
        "created_at": log.created_at.isoformat(),
    }


def persist_approval_log(
    log: ApprovalLog,
) -> dict:
    """
    Persist an approval log entry.

    Returns a dictionary representation suitable for DB insertion.
    """
    return {
        "id": str(log.id) if log.id else None,
        "request_id": log.request_id,
        "route_option_id": str(log.route_option_id) if log.route_option_id else None,
        "approval_state": log.approval_state.value,
        "actor_id": log.actor_id,
        "actor_role": log.actor_role,
        "note": log.note,
        "acknowledge_assumptions": log.acknowledge_assumptions,
        "hold_reason_code": log.hold_reason_code,
        "hold_note": log.hold_note,
        "created_at": log.created_at.isoformat(),
    }


def persist_decision_override_log(
    log: DecisionOverrideLog,
) -> dict:
    """
    Persist a decision override log entry.

    Returns a dictionary representation suitable for DB insertion.
    """
    return {
        "id": str(log.id) if log.id else None,
        "request_id": log.request_id,
        "route_option_id": str(log.route_option_id) if log.route_option_id else None,
        "override_type": log.override_type.value,
        "override_reason_code": log.override_reason_code,
        "override_note": log.override_note,
        "actor_id": log.actor_id,
        "created_at": log.created_at.isoformat(),
    }


def load_approval_trace(
    request_id: str,
    approval_logs: list[ApprovalLog],
    override_logs: list[DecisionOverrideLog],
    current_state: ApprovalState,
    execution_eligible: bool,
) -> ApprovalTrace:
    """
    Load and construct an approval trace for a request.
    """
    return ApprovalTrace(
        request_id=request_id,
        approval_history=list(approval_logs),
        override_history=list(override_logs),
        current_state=current_state,
        execution_eligible=execution_eligible,
    )


def get_audit_timeline(
    decision_logs: list[DecisionLog],
    approval_logs: list[ApprovalLog],
    override_logs: list[DecisionOverrideLog],
) -> list[AuditRecord]:
    """
    Combine all audit logs into a chronological timeline.
    """
    records: list[AuditRecord] = []

    # Add decision logs
    for log in decision_logs:
        records.append(AuditRecord(
            request_id=log.request_id,
            event_type=log.event_type.value,
            actor_id=log.actor_id,
            actor_role=log.actor_role,
            timestamp=log.created_at,
            note=log.note,
            payload=log.payload,
        ))

    # Add approval logs
    for log in approval_logs:
        records.append(AuditRecord(
            request_id=log.request_id,
            event_type=f"APPROVAL_{log.approval_state.value}",
            actor_id=log.actor_id,
            actor_role=log.actor_role,
            timestamp=log.created_at,
            note=log.note,
            payload={
                "acknowledge_assumptions": log.acknowledge_assumptions,
                "hold_reason_code": log.hold_reason_code,
                "hold_note": log.hold_note,
            } if log.hold_reason_code else {
                "acknowledge_assumptions": log.acknowledge_assumptions,
            },
        ))

    # Add override logs
    for log in override_logs:
        records.append(AuditRecord(
            request_id=log.request_id,
            event_type=f"OVERRIDE_{log.override_type.value}",
            actor_id=log.actor_id,
            actor_role="OPS_ADMIN",
            timestamp=log.created_at,
            note=log.override_note,
            payload={
                "override_type": log.override_type.value,
                "override_reason_code": log.override_reason_code,
            },
        ))

    # Sort by timestamp
    records.sort(key=lambda x: x.timestamp)

    return records


def build_optimization_audit_summary(
    result: OptimizationResult,
    route_options: list[RouteOption],
    decision_logs: list[DecisionLog],
) -> dict:
    """
    Build a comprehensive audit summary for an optimization result.
    """
    return {
        "request_id": result.shipment_request_id,
        "status": result.status.value,
        "recommended_route_id": (
            str(result.recommended_route_option_id)
            if result.recommended_route_option_id else None
        ),
        "feasible_count": result.feasible_count,
        "total_count": result.total_count,
        "approval_state": result.approval_state.value,
        "execution_eligible": result.execution_eligible,
        "reason_codes": result.reason_codes,
        "assumptions": result.assumptions,
        "input_required_codes": result.input_required_codes,
        "evidence_ref": result.evidence_ref,
        "generated_at": result.generated_at.isoformat(),
        "route_options_count": len(route_options),
        "decision_log_count": len(decision_logs),
        "timeline": [
            {
                "event": log.event_type.value,
                "actor": log.actor_id,
                "timestamp": log.created_at.isoformat(),
                "note": log.note,
            }
            for log in sorted(decision_logs, key=lambda x: x.created_at)
        ],
    }


def validate_audit_integrity(
    result: OptimizationResult,
    decision_logs: list[DecisionLog],
) -> tuple[bool, list[str]]:
    """
    Validate audit integrity for an optimization result.
    Returns (is_valid, list of issues).
    """
    issues: list[str] = []

    # Check execution_eligible is false before approval
    if result.execution_eligible:
        # Find if there's an APPROVED event
        approved_logs = [
            log for log in decision_logs
            if log.event_type == DecisionEventType.APPROVED
        ]
        if not approved_logs:
            issues.append(
                "execution_eligible=true but no APPROVED event found"
            )

    # Check that all decision logs have valid timestamps
    for log in decision_logs:
        if log.created_at > datetime.utcnow():
            issues.append(
                f"Decision log {log.id} has future timestamp: {log.created_at}"
            )

    return (len(issues) == 0, issues)
