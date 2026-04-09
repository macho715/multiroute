"""Decision Logger: audit logging for all route decisions."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from .types import (
    ApprovalLog,
    ApprovalState,
    DecisionEvent,
    DecisionLog,
    DecisionOverrideLog,
    OptimizeResponse,
    RankedRouteOption,
)


def create_decision_log(
    request_id: str,
    event_type: DecisionEvent,
    actor_id: str | None = None,
    actor_role: str | None = None,
    note: str | None = None,
    payload: dict | None = None,
) -> DecisionLog:
    """
    Create a decision log entry.

    FR-053: decision_log records for GENERATED, EVALUATED, OPTIMIZED,
    APPROVED, HELD, OVERRIDDEN, RE_EVALUATED events.
    """
    return DecisionLog(
        id=str(uuid.uuid4()),
        request_id=request_id,
        event_type=event_type,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        payload_jsonb=payload,
        created_at=datetime.utcnow(),
    )


def log_generated(
    request_id: str,
    route_count: int,
    actor_id: str | None = None,
) -> DecisionLog:
    """Log route generation event."""
    return create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.GENERATED,
        actor_id=actor_id,
        payload={
            "route_count": route_count,
            "generated_at": datetime.utcnow().isoformat(),
        },
    )


def log_evaluated(
    request_id: str,
    route_ids: list[str],
    actor_id: str | None = None,
) -> DecisionLog:
    """Log route evaluation event."""
    return create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.EVALUATED,
        actor_id=actor_id,
        payload={
            "route_ids": route_ids,
            "evaluated_at": datetime.utcnow().isoformat(),
        },
    )


def log_optimized(
    request_id: str,
    result: OptimizeResponse,
    actor_id: str | None = None,
) -> DecisionLog:
    """Log optimization event with full result payload."""
    payload = {
        "status": result.status.value,
        "recommended_route_id": result.recommended_route_id,
        "recommended_route_code": result.recommended_route_code.value if result.recommended_route_code else None,
        "feasible_count": result.feasible_count,
        "total_count": result.total_count,
        "reason_codes": result.reason_codes,
        "assumptions": result.assumptions,
        "evidence_ref": result.evidence_ref,
        "optimized_at": result.generated_at.isoformat(),
    }
    return create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.OPTIMIZED,
        actor_id=actor_id,
        payload=payload,
    )


def log_approved(
    request_id: str,
    actor_id: str,
    actor_role: str,
    note: str | None = None,
    acknowledge_assumptions: bool = False,
) -> tuple[DecisionLog, ApprovalLog]:
    """Log approval event."""
    decision = create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.APPROVED,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        payload={"acknowledged_assumptions": acknowledge_assumptions},
    )
    approval = ApprovalLog(
        id=str(uuid.uuid4()),
        request_id=request_id,
        approval_state=ApprovalState.APPROVED,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        acknowledge_assumptions=acknowledge_assumptions,
        created_at=datetime.utcnow(),
    )
    return decision, approval


def log_held(
    request_id: str,
    actor_id: str,
    actor_role: str,
    hold_reason_code: str,
    note: str | None = None,
) -> tuple[DecisionLog, ApprovalLog]:
    """Log hold event."""
    decision = create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.HELD,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        payload={"hold_reason_code": hold_reason_code},
    )
    approval = ApprovalLog(
        id=str(uuid.uuid4()),
        request_id=request_id,
        approval_state=ApprovalState.HELD,
        actor_id=actor_id,
        actor_role=actor_role,
        note=note,
        acknowledge_assumptions=False,
        created_at=datetime.utcnow(),
    )
    return decision, approval


def log_override(
    request_id: str,
    route_option_id: str,
    override_type: str,
    override_reason_code: str,
    actor_id: str,
    override_note: str | None = None,
) -> DecisionOverrideLog:
    """
    Log manual override event.

    FR-054: Persisted in decision_override_log with required fields:
    request_id, route_option_id, override_type, override_reason_code,
    override_note, actor_id, created_at.
    """
    return DecisionOverrideLog(
        id=str(uuid.uuid4()),
        request_id=request_id,
        route_option_id=route_option_id,
        override_type=override_type,
        override_reason_code=override_reason_code,
        override_note=override_note,
        actor_id=actor_id,
        created_at=datetime.utcnow(),
    )


def log_re_evaluated(
    request_id: str,
    actor_id: str | None = None,
    note: str | None = None,
) -> DecisionLog:
    """Log re-evaluation event after hold or override."""
    return create_decision_log(
        request_id=request_id,
        event_type=DecisionEvent.RE_EVALUATED,
        actor_id=actor_id,
        note=note,
        payload={"re_evaluated_at": datetime.utcnow().isoformat()},
    )
