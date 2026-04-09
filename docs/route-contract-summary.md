# Route Contract Summary

이 문서는 Route Optimization Engine의 개발 착수용 contract 요약본이다.

## Canonical Status
- `OK`
- `REVIEW`
- `AMBER`
- `BLOCKED`
- `ZERO`

## Canonical Route Codes
- `SEA_DIRECT`
- `SEA_TRANSSHIP`
- `SEA_LAND`

## Canonical Roles
- `OPS_ADMIN`
- `LOGISTICS_APPROVER`
- `LOGISTICS_REVIEWER`
- `LOGISTICS_VIEWER`

## Canonical Response Requirements
`POST /api/route/optimize` 응답은 최소 아래를 포함해야 한다.
- `request_id`
- `status`
- `recommended_route_id`
- `recommended_route_code`
- `options`
- `decision_logic`
- `reason_codes`
- `assumptions`
- `input_required_codes`
- `evidence_ref`
- `rule_version`
- `feasible_count`
- `total_count`
- `approval_state`
- `execution_eligible`
- `generated_at`

## Key Logic Invariants
- feasible route만 rank 대상이다.
- infeasible route는 best-effort 추천으로 숨기지 않는다.
- `CRITICAL` priority에서 `eta > required_delivery_date` 또는 `deadline_slack_days < 0.00` 이면 즉시 제외한다.
- `WH snapshot > 72h` 또는 missing이면 `ZERO`다.
- `24h < stale <= 72h` 이면 `AMBER`다.
- `ZERO`에는 최소 1개 `input_required_code`가 필요하다.
- `AMBER`에는 최소 1개 assumption note가 필요하다.
- `BLOCKED/REVIEW/AMBER/ZERO`에는 최소 1개 `reason_code`가 필요하다.
- approval 전 `execution_eligible=false`여야 한다.

## Ranking Weights
- `NORMAL`: cost `0.50`, time `0.25`, risk `0.15`, wh `0.10`
- `URGENT`: cost `0.25`, time `0.50`, risk `0.15`, wh `0.10`
- `CRITICAL`: cost `0.15`, time `0.60`, risk `0.15`, wh `0.10`

## Tie-breaker Order
1. `deadline_slack_days_desc`
2. `risk_penalty_asc`
3. `total_cost_aed_asc`
4. `transit_days_asc`
5. `route_code_asc`
