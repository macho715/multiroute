# Feature Specification: Multi-Route Optimization + Cost vs Transit Tradeoff Engine

Feature ID/Branch: route-optimization-engine
Created: 2026-04-09
Status: Approved
Owner: OPS_ADMIN
Input: `plan.patched.final.v2026.04.md` + `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`
Last Updated: 2026-04-09
Version: v1.0.0

## Summary
### Problem
- 현재 Route 선택은 담당자 경험과 개별 운임표 확인에 크게 의존한다.
- 동일 Shipment에 대해 `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND` 대안을 정형적으로 비교하지 못해 비용·납기·리스크·WH 영향을 일관되게 반영하지 못한다.
- `Freight` 외 `Surcharge`, `DEM/DET exposure`, `Inland`, `Handling`, `Docs/Customs`, `WH inbound capacity`가 route 의사결정에 구조적으로 연결되지 않는다.
- 추천 결과의 근거, 승인, 재현, 감사가 일관된 계약으로 남지 않는다.

### Goals
- G1: 각 `ShipmentRequest`에 대해 비교 가능한 `options`와 `recommended_route` 1건 또는 명시적 차단 상태를 반환한다.
- G2: 모든 추천 결과에 `status`, `decision_logic`, `reason_codes`, `assumptions`, `evidence_ref`, `approval_trace`를 남긴다.
- G3: `NORMAL`, `URGENT`, `CRITICAL` 우선순위에 따라 다른 ranking 정책을 일관되게 적용한다.
- G4: `Dry-run → Approval → Execution Eligible` 운영 통제를 백엔드와 UI에서 모두 강제한다.
- G5: 운영자/승인자가 단일 Workbench에서 비교, 검토, 승인, 감사 추적을 수행할 수 있게 한다.

### Non-Goals
- NG1: 실제 `Booking` 자동 실행
- NG2: Carrier 운임 협상 자동화
- NG3: Customs 신고 자동 제출
- NG4: 실시간 `port congestion` 예측 엔진 구현
- NG5: MVP 범위에서 `AIR`, `AIR+LAND`, `SEA_AIR` 운영 지원

## User Scenarios & Testing
### User Story 1 - Shipment Route Recommendation (Priority: P1)
운영자는 단일 `ShipmentRequest`를 입력하고, 후보 route를 비교한 뒤, 추천 route와 그 근거를 확인해야 한다.

Why this priority: 제품의 핵심 가치는 “최저가 route”가 아니라 비용·시간·리스크·WH 영향의 균형점이 가장 우수한 route를 일관되게 선택하는 것이다.
Independent Test: 동일한 `ShipmentRequest`, 동일한 `rule_version`, 동일한 snapshot을 넣었을 때 동일한 `options`, `rank`, `recommended_route`가 재현되는지 검증한다.

Acceptance Scenarios:
1. Given 유효한 `ShipmentRequest`와 활성 `route_rules`, `cost_rules`, `transit_rules`, `doc_rules`, `risk_rules`, `wh_capacity_snapshot`이 존재할 때, When 사용자가 `POST /api/route/optimize`를 호출하면, Then 시스템은 `status`, `recommended_route`, `options`, `decision_logic`, `evidence_ref`를 포함한 응답을 반환해야 한다.
2. Given feasible route가 2건 이상 존재할 때, When 사용자가 Workbench `Compare Canvas`를 열면, Then 각 route row는 최소 `route_code`, `rank`, `feasible`, `ETA`, `transit_days`, `total_cost_aed`, `risk_level`, `wh_impact_level`, `docs_completeness_pct`, `reason chip count`, `evidence chip count`를 표시해야 한다.
3. Given 동일 입력과 동일 `rule_version`을 다시 평가할 때, When 시스템이 replay를 수행하면, Then 결과 `rank`와 `recommended_route`는 동일해야 한다.

### User Story 2 - Time-Prioritized Recommendation for Urgent Cargo (Priority: P1)
긴급 shipment 담당자는 비용이 더 높더라도 납기 충족 가능성이 높은 route가 우선 추천되길 원한다.

Why this priority: `URGENT`와 `CRITICAL`은 ranking과 exclusion 규칙을 실제로 바꾸는 핵심 업무 조건이다.
Independent Test: 동일 shipment를 `NORMAL`, `URGENT`, `CRITICAL`로 각각 실행해 ranking 변화와 제외 기준 차이를 확인한다.

Acceptance Scenarios:
1. Given `priority=URGENT` 이고 faster route가 slower route보다 비싸지만 deadline slack이 더 클 때, When optimize를 실행하면, Then `time` 가중치가 `cost`보다 높게 적용되어 faster route가 더 좋은 score를 받아야 한다.
2. Given `priority=CRITICAL` 이고 특정 route의 `eta > required_delivery_date` 일 때, When optimize를 실행하면, Then 해당 route는 즉시 제외되어야 하며 추천 대상이 되면 안 된다.

### User Story 3 - Explicit Failure and Review States (Priority: P1)
운영자는 실행 불가 또는 검토 필요 상태를 “추천 없음”으로 숨기지 않고, 왜 그런지 명시적으로 확인해야 한다.

Why this priority: Fail-safe 없는 추천은 잘못된 실행과 감사 공백을 만든다.
Independent Test: `lane unsupported`, `mandatory doc missing`, `WH overload`, `FX unresolved`, `stale WH snapshot`, `deadline miss` 케이스를 각각 입력해 기대 상태와 reason code가 반환되는지 확인한다.

Acceptance Scenarios:
1. Given feasible route가 0건일 때, When optimize를 실행하면, Then `status=BLOCKED` 이고 최소 1개의 `reason_code`가 포함되어야 한다.
2. Given `HS code` 누락 또는 `AED normalized input` 미제공일 때, When optimize를 실행하면, Then `status=ZERO` 이고 최소 1개의 `input_required_code`가 포함되어야 한다.
3. Given `WH snapshot`이 24시간 초과 72시간 이하로 stale일 때, When optimize를 실행하면, Then `status=AMBER` 이고 assumption note가 포함되어야 한다.
4. Given structured input은 충분하지만 `customs risk high` 또는 `deadline_slack_days <= 2.00` 일 때, When optimize를 실행하면, Then `status=REVIEW` 이고 사람이 검토해야 하는 이유가 reason code로 포함되어야 한다.

### User Story 4 - Approval and Audit Trace (Priority: P1)
승인자는 추천 결과의 근거와 rule version을 확인한 뒤 승인 또는 보류 결정을 기록해야 한다.

Why this priority: 본 제품은 `booking automation system`이 아니라 `operations decision engine`이므로 승인과 감사 추적은 핵심 제품 계약이다.
Independent Test: `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO` 각각에 대해 CTA, 승인 가능 여부, 로그 저장 여부가 기대대로 동작하는지 검증한다.

Acceptance Scenarios:
1. Given `status=OK` 또는 `status=REVIEW` 인 optimization 결과가 있을 때, When 승인자가 `POST /api/route/approve`를 호출하면, Then `approval_log`와 `decision_log`가 저장되고 `execution_eligible=true`가 되어야 한다.
2. Given `status=AMBER` 인 결과가 있을 때, When 승인자가 승인하려고 하면, Then `acknowledge_assumptions=true` 없이는 승인되면 안 된다.
3. Given `status=BLOCKED` 또는 `status=ZERO` 인 결과가 있을 때, When 사용자가 Workbench에서 승인하려고 하면, Then 승인 버튼은 비활성화되어야 한다.
4. Given 보류가 필요한 결과가 있을 때, When 승인자가 `POST /api/route/hold`를 호출하면, Then `hold_reason_code`, `hold_note`, actor 정보가 저장되어야 한다.

### User Story 5 - Workbench Comparison and Evidence Review (Priority: P2)
운영자와 승인자는 한 화면에서 route 비교, 세부 근거 확인, 승인 준비를 완료해야 한다.

Why this priority: 고복잡 운영 화면에서 비교와 근거 확인이 분리되면 cognitive load가 증가하고 승인 품질이 저하된다.
Independent Test: Workbench 진입 후 `Compare Canvas`에서 row 선택 → `Evidence Drawer` 오픈 → `Decision Rail` 검토 → `Approval Modal` 진입 흐름을 E2E로 검증한다.

Acceptance Scenarios:
1. Given Workbench를 연 상태에서 사용자가 route row를 선택할 때, When `View details` 또는 row click을 수행하면, Then `Contextual Evidence Drawer`가 열리고 기본 탭은 `Overview`여야 한다.
2. Given Drawer가 열린 상태일 때, When 사용자가 `Esc`를 누르면, Then Drawer는 닫히고 focus는 안전하게 이전 선택 row로 복귀해야 한다.
3. Given 사용자가 `Overview | Compare | Audit` 모드를 전환할 때, When `Audit` 모드로 이동하면, Then ranking reason, `evidence_ref`, decision timeline을 우선 노출해야 한다.

### Edge Cases
- EC1: `pol_code == pod_code` → validation error, optimize 진행 금지
- EC2: `dims_cm` 누락 → `ZERO`
- EC3: `gross_weight_kg <= 0` 또는 `quantity <= 0` → validation error
- EC4: `OOG` 또는 `HEAVY_LIFT`가 허용되지 않은 hub를 요구 → 해당 route 제외
- EC5: `SEA_LAND`인데 inland leg를 생성할 수 없음 → 해당 route 제외
- EC6: 비용 입력 통화가 AED가 아님 → `ZERO` + `FX_NORMALIZED_AED_REQUIRED`
- EC7: `required_delivery_date < etd_target::date` → validation error
- EC8: feasible route가 1건만 존재 → normalized metric은 모두 `0.00`, 단일 feasible route를 추천
- EC9: 동점 score 발생 → `deadline_slack_days_desc`, `risk_penalty_asc`, `total_cost_aed_asc`, `transit_days_asc`, `route_code_asc` 순서로 tie-break
- EC10: `WH snapshot > 72h` 또는 미존재 → `ZERO`
- EC11: `DEM/DET`가 추정치뿐인 경우 → `DEM_DET_EXPOSURE_ESTIMATED` reason code 포함, 필요 시 `AMBER`
- EC12: `BLOCKED` 또는 `ZERO` 상태에서는 best-effort 추천으로 infeasible route를 숨기면 안 됨

## Requirements
### Functional Requirements
#### Intake, Validation, and Canonical Inputs
- FR-001: System MUST accept a canonical `ShipmentRequest` with required fields `request_id`, `pol_code`, `pod_code`, `cargo_type`, `container_type`, `quantity`, `dims_cm`, `gross_weight_kg`, `etd_target`, `required_delivery_date`, `incoterm`, `priority`, `hs_code`, `destination_site`.
- FR-002: System MUST treat `cog_cm`, `docs_available`, and `remarks` as optional inputs.
- FR-003: System MUST validate `gross_weight_kg > 0`, `quantity > 0`, `pol_code != pod_code`, and `required_delivery_date >= etd_target::date` before evaluation.
- FR-004: System MUST allow `priority` values only from `NORMAL`, `URGENT`, `CRITICAL`.
- FR-005: System MUST allow `cargo_type` values only from `GENERAL`, `OOG`, `HEAVY_LIFT`.
- FR-006: System MUST accept `hs_code` only as a numeric string of length 6–12.
- FR-007: System MUST require the reference data set `rate_table`, `route_rules`, `cost_rules`, `transit_rules`, `doc_rules`, `risk_rules`, `wh_capacity_snapshot` for evaluation.
- FR-008: System MUST classify `dims_cm` missing as `ZERO` rather than silently continuing.
- FR-009: System MUST classify any non-AED cost input as `ZERO` with `input_required_codes=["FX_NORMALIZED_AED_REQUIRED"]`.

#### Route Generation
- FR-010: System MUST support exactly `SEA_DIRECT`, `SEA_TRANSSHIP`, and `SEA_LAND` as MVP route codes.
- FR-011: System MUST generate only route candidates that are allowed by the `POL/POD` pair and `route_rules`.
- FR-012: System MUST exclude route candidates that violate cargo size, weight, `COG`, `OOG`, `HEAVY_LIFT`, or hub restrictions.
- FR-013: System MUST require `SEA_LAND` to include an inland final leg.
- FR-014: System MUST persist generated routes as `RouteOption` with structured `RouteLeg` records, including per-leg `seq`, `mode`, `origin_node`, `destination_node`, `carrier_code`, `service_code`, `base_days`, and restrictions.
- FR-015: System MUST generate between 1 and 4 legs per route and reject route structures outside that range.

#### Cost, Transit, Constraints
- FR-016: System MUST compute `total_cost_aed` as the sum of `base_freight_aed`, `origin_charges_aed`, `destination_charges_aed`, `surcharge_aed`, `dem_det_estimated_aed`, `inland_aed`, `handling_aed`, `special_equipment_aed`, and `buffer_cost_aed`.
- FR-017: System MUST store every cost component as a non-negative numeric field rounded to 2 decimals.
- FR-018: System MUST store `DEM/DET` as `dem_det_estimated_aed` when the value is exposure-based rather than final.
- FR-019: System MUST compute `transit_days = sum(leg.base_days) + transship_buffer_days + customs_buffer_days + inland_buffer_days`.
- FR-020: System MUST compute `eta = etd_target + transit_days`.
- FR-021: System MUST compute `deadline_slack_days = required_delivery_date - eta_date`.
- FR-022: System MUST evaluate constraints across `deadline`, `WH capacity`, `docs`, `customs`, and `connection`.
- FR-023: System MUST mark a route infeasible when any hard constraint is violated, including `mandatory docs missing`, `WH overload unavoidable`, `deadline miss`, `lane unsupported`, `OOG restriction violation`, `weight limit violation`, or `CRITICAL priority on-time impossible`.
- FR-024: System MUST classify `WH snapshot freshness <= 24h` as normal, `24h < stale <= 72h` as `AMBER`, and `> 72h` or missing as `ZERO`.
- FR-025: System MUST evaluate route-specific required documents as defined in `doc_rules`.
- FR-026: System MUST record `docs_completeness_pct`, `wh_impact_level`, `reason_codes`, and `input_required_codes` per route evaluation.

#### Status Mapping and Ranking
- FR-027: System MUST allow only `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO` as optimization result statuses.
- FR-028: System MUST set `status=OK` only when feasible route count is at least 1, no `ZERO` condition exists, and no blocking condition remains.
- FR-029: System MUST set `status=REVIEW` when inputs are sufficient but a person must verify operational or policy judgement.
- FR-030: System MUST set `status=AMBER` when a feasible route exists but the result relies on estimation or assumption.
- FR-031: System MUST set `status=BLOCKED` when feasible route count is 0 or all routes violate hard constraints.
- FR-032: System MUST set `status=ZERO` when high-risk mandatory input is missing, including `HS code`, `customs critical input`, `AED normalized cost`, `WH snapshot > 72h`, or required dimensions/weight.
- FR-033: System MUST require at least 1 `reason_code` for every `BLOCKED`, `REVIEW`, `AMBER`, and `ZERO` response.
- FR-034: System MUST require at least 1 `assumption note` for every `AMBER` response.
- FR-035: System MUST require at least 1 `input_required_code` for every `ZERO` response.
- FR-036: System MUST rank only feasible routes.
- FR-037: System MUST use `min_max` normalization for all feasible candidate metrics and set normalized metrics to `0.00` when only one candidate exists.
- FR-038: System MUST use priority weights exactly as follows: `NORMAL {cost:0.50, time:0.25, risk:0.15, wh:0.10}`, `URGENT {cost:0.25, time:0.50, risk:0.15, wh:0.10}`, `CRITICAL {cost:0.15, time:0.60, risk:0.15, wh:0.10}`.
- FR-039: System MUST use risk penalty mapping exactly as `LOW=0.00`, `MEDIUM=0.10`, `HIGH=0.25`, `BLOCKED=excluded`.
- FR-040: System MUST use WH penalty mapping exactly as `LOW=0.00`, `MEDIUM=0.10`, `HIGH=0.20`, `BLOCKED=excluded`.
- FR-041: System MUST calculate `score = (weight_cost × normalized_cost) + (weight_time × normalized_transit) + (weight_risk × risk_penalty) + (weight_wh × wh_penalty)` and treat lower score as better.
- FR-042: System MUST immediately exclude any route with `priority=CRITICAL` and `eta > required_delivery_date` or `deadline_slack_days < 0.00`.
- FR-043: System MUST apply tie-breakers in this exact order: `deadline_slack_days_desc`, `risk_penalty_asc`, `total_cost_aed_asc`, `transit_days_asc`, `route_code_asc`.
- FR-044: System MUST never return an infeasible `recommended_route`; doing so is a system error.

#### API, Persistence, and Audit
- FR-045: System MUST expose `POST /api/route/generate`, `POST /api/route/evaluate`, `POST /api/route/optimize`, `POST /api/route/approve`, `POST /api/route/hold`, and `GET /api/route/dashboard/[request_id]`.
- FR-046: System MUST make `POST /api/route/generate` return route candidates without final recommendation.
- FR-047: System MUST make `POST /api/route/evaluate` return cost, transit, risk, and feasibility for generated routes.
- FR-048: System MUST make `POST /api/route/optimize` return `request_id`, `status`, `recommended_route_id`, `recommended_route_code`, `options`, `decision_logic`, `reason_codes`, `assumptions`, `input_required_codes`, `evidence_ref`, `rule_version`, `feasible_count`, `total_count`, `approval_state`, `execution_eligible`, and `generated_at`.
- FR-049: System MUST make every recommendation response include non-empty `evidence_ref`.
- FR-050: System MUST persist at minimum these entities: `shipment_request`, `route_option`, `route_leg`, `cost_breakdown`, `transit_estimate`, `constraint_evaluation`, `optimization_result`, `decision_log`, `approval_log`, `decision_override_log`, `wh_capacity_snapshot`, `rule_set_version`.
- FR-051: System MUST persist `optimization_result.status` using the 5 canonical statuses only.
- FR-052: System MUST persist `execution_eligible=false` until approval is confirmed.
- FR-053: System MUST create `decision_log` records for `GENERATED`, `EVALUATED`, `OPTIMIZED`, `APPROVED`, `HELD`, `OVERRIDDEN`, and `RE_EVALUATED` events.
- FR-054: System MUST persist manual overrides in `decision_override_log` with required fields `request_id`, `route_option_id`, `override_type`, `override_reason_code`, `override_note`, `actor_id`, `created_at`.
- FR-055: System MUST persist approval records in `approval_log` with `approval_state`, actor identity, note, and `acknowledge_assumptions`.
- FR-056: System MUST preserve `rule_version` and evidence metadata with every optimization result to support replay and audit.

#### Workbench UI and Approval Workflow
- FR-057: System MUST implement the Workbench as `Header + Decision Bar + Context Rail + Compare Canvas + Decision Rail + Contextual Evidence Drawer + Approval Modal`.
- FR-058: System MUST use the `2.5-pane Workbench + Contextual Evidence Drawer` layout for desktop.
- FR-059: System MUST keep comparison as the central interaction surface and use progressive disclosure for detailed evidence.
- FR-060: System MUST provide `Overview`, `Compare`, and `Audit` view modes.
- FR-061: System MUST provide `Recommended`, `Cheapest`, and `Fastest` scenario toggles.
- FR-062: System MUST provide route sorting by `rank`, `cost`, `transit`, and `risk` and filtering by `feasible only`, `docs-ready only`, `wh-safe only`, `low-risk only`.
- FR-063: System MUST pin the recommended route row at the top of the comparison surface.
- FR-064: System MUST expose `status`, `recommended_route`, `feasible_count/total_count`, `reason_count`, `assumption_count`, `evidence_count`, `last_evaluated_at`, and `incomplete_input_count` in `Decision Bar`.
- FR-065: System MUST expose `Shipment Summary`, `Missing/Stale Inputs`, `Hard Constraints`, and `Filters` in `Context Rail`.
- FR-066: System MUST expose `Recommended Route Summary`, `Decision Logic`, `Reason/Assumption Summary`, `Approval Controls`, and `Safe Next Step` in `Decision Rail`.
- FR-067: System MUST expose the following `Evidence Drawer` tabs in order: `Overview`, `Route Legs`, `Cost Breakdown`, `Transit & Buffers`, `Docs & Customs`, `WH Impact`, `Evidence & Rule Version`, `Approval Trace`.
- FR-068: System MUST open the `Evidence Drawer` from row click or `View details`, close it on `Esc`, trap focus while open, and reopen on the `Overview` tab by default.
- FR-069: System MUST require `acknowledgement checkbox` in `Approval Modal` for `AMBER` and `REVIEW` approvals.
- FR-070: System MUST disable approval action for `BLOCKED` and `ZERO` states.
- FR-071: System MUST not expose `booking submit`, `customs submit`, `carrier action`, `payment`, or any other execution CTA on the same surface as approval.
- FR-072: System MUST separate `Approve`, `Hold`, and `Request Re-evaluation` actions and preserve them in traceable logs.

#### Roles and Authorization
- FR-073: System MUST support roles `OPS_ADMIN`, `LOGISTICS_APPROVER`, `LOGISTICS_REVIEWER`, and `LOGISTICS_VIEWER`.
- FR-074: System MUST allow `generate`, `evaluate`, and `optimize` for `LOGISTICS_REVIEWER`, `LOGISTICS_APPROVER`, and `OPS_ADMIN`, but not for `LOGISTICS_VIEWER`.
- FR-075: System MUST allow `approve` and `hold` only for `LOGISTICS_APPROVER` and `OPS_ADMIN`.
- FR-076: System MUST allow `override` only for `OPS_ADMIN`.
- FR-077: System MUST allow `dashboard` read access for all four roles.

### Non-Functional Requirements
- NFR-001 (Performance): `POST /api/route/generate` p95 latency MUST be `<= 800ms`, `POST /api/route/evaluate` p95 MUST be `<= 1500ms`, `POST /api/route/optimize` p95 MUST be `<= 2000ms`, and `GET /api/route/dashboard/[request_id]` p95 MUST be `<= 1200ms` under the MVP assumption of `route options <= 10`, single request evaluation, and same-region DB.
- NFR-002 (Determinism): 동일 입력 + 동일 `rule_version` + 동일 snapshot이면 결과가 100% 재현 가능해야 한다.
- NFR-003 (Data Integrity): DB는 cost 음수 금지, canonical status 외 값 금지, `request-route` 관계의 PK/FK/CHECK 무결성을 보장해야 한다.
- NFR-004 (Reliability): 시스템은 silent failure 없이 항상 명시적 상태 또는 validation error를 반환해야 하며 crash로 종료되면 안 된다.
- NFR-005 (Explainability): 모든 recommendation은 사람이 검토 가능한 `decision_logic`, `reason_codes`, `evidence_ref`, `rule_version`을 포함해야 한다.
- NFR-006 (Auditability): recommendation, approval, hold, override, re-evaluation 모두 `decision_log` 또는 대응 audit entity에 남아야 한다.
- NFR-007 (Security/Authorization): API와 Workbench는 역할 기반 권한 모델을 강제해야 한다.
- NFR-008 (Accessibility): Workbench 컴포넌트 DoD는 `WCAG 2.2 AA`를 충족해야 하며 keyboard-only 사용자가 주요 흐름을 완료할 수 있어야 한다.
- NFR-009 (Usability): 고복잡 정보를 progressive disclosure로 제공하고, 비교/검토/승인을 한 화면 mental model 안에서 수행할 수 있어야 한다.
- NFR-010 (Observability): 서버 로그는 최소 `request_id`, `route_option_count`, `status`, `recommended_route_id`, `rule_version`, `latency_ms`, `actor_id`를 포함해야 한다.
- NFR-011 (Frontend Telemetry): 프론트는 최소 `workbench_loaded`, `scenario_changed`, `route_selected`, `evidence_drawer_opened`, `approval_clicked`, `approval_confirmed`, `hold_confirmed`, `re_evaluate_clicked` 이벤트를 수집해야 한다.
- NFR-012 (Formatting): 모든 금액은 `AED` 2 decimals, 모든 시간은 `days` 2 decimals, 저장 시점의 날짜/시간은 `ISO 8601 UTC`를 사용해야 한다.

## Key Entities / Data
- `ShipmentRequest`: route 탐색과 평가의 canonical input
  - key fields: `request_id`, `pol_code`, `pod_code`, `cargo_type`, `container_type`, `quantity`, `dims_cm`, `gross_weight_kg`, `cog_cm`, `etd_target`, `required_delivery_date`, `incoterm`, `priority`, `hs_code`, `destination_site`, `docs_available`
- `RouteOption`: 후보 route 1건
  - key fields: `id`, `route_code`, `mode_mix`, `feasible`, `blocked`, `risk_level`, `reason_codes_jsonb`, `assumption_notes_jsonb`, `evidence_ref_jsonb`, `rule_set_version_id`
- `RouteLeg`: route의 leg 단위 상세
  - key fields: `seq`, `mode`, `origin_node`, `destination_node`, `carrier_code`, `service_code`, `base_days`, `restrictions_jsonb`
- `CostBreakdown`: route별 비용 상세
  - key fields: `base_freight_aed`, `origin_charges_aed`, `destination_charges_aed`, `surcharge_aed`, `dem_det_estimated_aed`, `inland_aed`, `handling_aed`, `special_equipment_aed`, `buffer_cost_aed`, `total_cost_aed`, `components_jsonb`
- `TransitEstimate`: route별 ETA 계산 결과
  - key fields: `etd_target`, `transit_days`, `eta`, `deadline_slack_days`, `buffers_jsonb`
- `ConstraintEvaluation`: 제약 평가 결과
  - key fields: `deadline_ok`, `wh_ok`, `docs_ok`, `customs_ok`, `connection_ok`, `wh_impact_level`, `docs_completeness_pct`, `reason_codes_jsonb`, `input_required_codes_jsonb`
- `OptimizationResult`: 최종 추천 결과
  - key fields: `status`, `recommended_route_option_id`, `decision_logic_jsonb`, `feasible_count`, `total_count`, `reason_codes_jsonb`, `assumptions_jsonb`, `input_required_codes_jsonb`, `evidence_ref_jsonb`, `execution_eligible`
- `DecisionLog`: 생성/평가/최적화/승인/보류/오버라이드 이력
  - key fields: `event_type`, `actor_id`, `actor_role`, `note`, `payload_jsonb`, `created_at`
- `ApprovalLog`: 승인/보류 이력
  - key fields: `approval_state`, `actor_id`, `actor_role`, `note`, `acknowledge_assumptions`, `created_at`
- `DecisionOverrideLog`: 수동 override 이력
  - key fields: `override_type`, `override_reason_code`, `override_note`, `actor_id`, `created_at`
- `WHCapacitySnapshot`: site/date 기준 capacity snapshot
  - key fields: `site_code`, `date_bucket`, `inbound_capacity`, `allocated_qty`, `remaining_capacity`, `snapshot_at`
- `RuleSetVersion`: rule artifact version 묶음
  - key fields: `route_rules_version`, `cost_rules_version`, `transit_rules_version`, `doc_rules_version`, `risk_rules_version`, `effective_at`, `is_active`

## Interfaces & Contracts
### Input Contract
```ts
interface ShipmentRequest {
  request_id: string;
  pol_code: string;
  pod_code: string;
  cargo_type: 'GENERAL' | 'OOG' | 'HEAVY_LIFT';
  container_type: string;
  quantity: number;
  dims_cm: { length: number; width: number; height: number };
  gross_weight_kg: number;
  cog_cm?: { x: number; y: number; z: number };
  etd_target: string; // ISO datetime
  required_delivery_date: string; // ISO date
  incoterm: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  hs_code: string;
  destination_site: string;
  docs_available?: string[];
  remarks?: string;
}
```

### Output Contract
```ts
type RouteStatus = 'OK' | 'REVIEW' | 'AMBER' | 'BLOCKED' | 'ZERO';

interface RouteOptionView {
  route_option_id: string;
  route_code: 'SEA_DIRECT' | 'SEA_TRANSSHIP' | 'SEA_LAND';
  rank: number | null;
  feasible: boolean;
  blocked: boolean;
  eta: string | null;
  transit_days: number | null;
  deadline_slack_days: number | null;
  total_cost_aed: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  risk_penalty: number | null;
  wh_impact_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  docs_completeness_pct: number;
  reason_codes: string[];
  assumption_notes: string[];
  evidence_ref: string[];
}

interface DecisionLogicView {
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  weights: {
    cost: number;
    time: number;
    risk: number;
    wh: number;
  };
  normalization_method: 'min_max';
  tie_breaker: string[];
  penalties_applied: Array<{
    code: string;
    value: number;
    description: string;
  }>;
}

interface OptimizeResponse {
  request_id: string;
  status: RouteStatus;
  recommended_route_id: string | null;
  recommended_route_code: 'SEA_DIRECT' | 'SEA_TRANSSHIP' | 'SEA_LAND' | null;
  options: RouteOptionView[];
  decision_logic: DecisionLogicView;
  reason_codes: string[];
  assumptions: string[];
  input_required_codes: string[];
  evidence_ref: string[];
  rule_version: {
    route_rules: string;
    cost_rules: string;
    transit_rules: string;
    doc_rules: string;
    risk_rules: string;
  };
  feasible_count: number;
  total_count: number;
  approval_state: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'HELD';
  execution_eligible: boolean;
  generated_at: string;
}
```

### API Surface
- `POST /api/route/generate`: feasible route candidate generation
- `POST /api/route/evaluate`: cost/transit/risk/constraint evaluation
- `POST /api/route/optimize`: final optimization result generation
- `POST /api/route/approve`: approval persistence and `execution_eligible=true`
- `POST /api/route/hold`: hold persistence and re-evaluation trigger
- `GET /api/route/dashboard/[request_id]`: Workbench summary, comparison, logic, evidence, approval trace, override trace, last evaluated timestamp

### Rule Contracts
```yaml
# route_rules.yaml
version: v2026.04
supported_routes: [SEA_DIRECT, SEA_TRANSSHIP, SEA_LAND]
```

```yaml
# cost_rules.yaml
version: v2026.04
currency: AED
rounding: 2
priority_weights:
  NORMAL:   { cost: 0.50, time: 0.25, risk: 0.15, wh: 0.10 }
  URGENT:   { cost: 0.25, time: 0.50, risk: 0.15, wh: 0.10 }
  CRITICAL: { cost: 0.15, time: 0.60, risk: 0.15, wh: 0.10 }
```

```yaml
# transit_rules.yaml
version: v2026.04
buffers:
  customs_days: 2.00
  transship_days: 4.00
  inland_days_default: 3.00
```

```yaml
# doc_rules.yaml
version: v2026.04
route_docs:
  SEA_DIRECT: [CI, PL, BL, COO]
  SEA_TRANSSHIP: [CI, PL, BL, COO, HUB_DOC]
  SEA_LAND: [CI, PL, BL, COO, INLAND_DO]
```

### Canonical Reason Codes
- `LANE_UNSUPPORTED`
- `MANDATORY_DOC_MISSING`
- `WH_CAPACITY_BLOCKED`
- `DEADLINE_MISS`
- `HS_CODE_MISSING`
- `CUSTOMS_INPUT_MISSING`
- `FX_NORMALIZED_AED_REQUIRED`
- `WH_SNAPSHOT_STALE`
- `HUB_RESTRICTED_FOR_OOG`
- `WEIGHT_LIMIT_EXCEEDED`
- `COG_DATA_REQUIRED`
- `CONNECTION_RISK_HIGH`
- `DEM_DET_EXPOSURE_ESTIMATED`
- `CUSTOMS_REVIEW_REQUIRED`

### UI Contract
- Primary target: `desktop >= 1280px`
- Desktop layout: `Header 64px`, `Decision Bar 56px`, `Context Rail 280px`, `Compare Canvas min 720px`, `Decision Rail 360px`, `Evidence Drawer 520px`
- View modes: `overview`, `compare`, `audit`
- Scenario modes: `recommended`, `cheapest`, `fastest`
- Evidence tabs: `overview`, `legs`, `cost`, `transit`, `docs`, `wh`, `evidence`, `trace`

## Assumptions & Dependencies
### Assumptions
- A1: 모든 비용 입력은 evaluation 이전에 AED로 normalize되어 있다.
- A2: 활성 rule set은 단일 `rule_set_version`으로 pinning 가능하다.
- A3: `wh_capacity_snapshot`은 `site_code + date_bucket` 기준으로 제공된다.
- A4: `DEM/DET`는 MVP에서 exposure-based estimation을 허용한다.
- A5: recommendation과 execution은 동일 시스템 안에서도 별도 단계로 저장된다.
- A6: MVP route 범위는 `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND`로 고정한다.
- A7: `REVIEW`, `AMBER`, `ZERO` 구분은 본 문서의 canonical 상태 정의를 따른다.
- A8: Workbench는 desktop-first이며 `<1024px`에서는 triage 중심 축소 UI를 허용한다.

### Dependencies
- D1: Next.js App Router 기반 API 및 Workbench 구현 환경
- D2: PostgreSQL with relational constraints and `jsonb` support
- D3: `route_rules`, `cost_rules`, `transit_rules`, `doc_rules`, `risk_rules` artifact 관리 체계
- D4: `rate_table` data steward
- D5: `wh_capacity_snapshot` publishing job or source system
- D6: role/auth identity provider
- D7: approval actor provisioning for `LOGISTICS_APPROVER` and `OPS_ADMIN`
- D8: E2E test environment with representative route, docs, and WH datasets

## Success Criteria
### Measurable Outcomes
- SC-001: optimize 응답의 100%가 `status`를 포함한다.
- SC-002: `recommended_route_code != null` 인 응답의 100%가 비어 있지 않은 `evidence_ref`를 포함한다.
- SC-003: `BLOCKED`, `REVIEW`, `AMBER`, `ZERO` 응답의 100%가 최소 1개의 `reason_code`를 포함한다.
- SC-004: `AMBER` 응답의 100%가 assumption note를 포함한다.
- SC-005: `ZERO` 응답의 100%가 `input_required_codes`를 포함한다.
- SC-006: 동일 입력 + 동일 `rule_version` + 동일 snapshot에 대한 replay 테스트에서 결과 일치율 100%를 달성한다.
- SC-007: approval 이전 `execution_eligible=true` 인 결과는 0건이어야 한다.
- SC-008: `POST /api/route/generate` p95 `<= 800ms`, `POST /api/route/evaluate` p95 `<= 1500ms`, `POST /api/route/optimize` p95 `<= 2000ms`, `GET /api/route/dashboard/[request_id]` p95 `<= 1200ms`를 충족한다.
- SC-009: 단위 테스트는 최소 `route generation`, `cost formula`, `transit formula`, `constraint evaluation`, `ranking tie-breaker`, `status mapping`을 포함한다.
- SC-010: 통합 테스트는 최소 `generate→evaluate→optimize`, `optimize→approve`, `optimize→hold→re-evaluate`, `ZERO/BLOCKED` 시나리오를 통과한다.
- SC-011: E2E 테스트는 최소 `Workbench load`, `route row click → drawer open`, `approval modal confirm`, `blocked state no-approve`, `amber acknowledge then approve`를 통과한다.
- SC-012: 품질 기준으로 `unit coverage >= 80%`를 달성한다.
- SC-013: UI는 `keyboard path`, `focus not obscured`, `screen reader status/reason readout`, `Esc close`, `high contrast state identification` 테스트를 모두 통과한다.
- SC-014: Workbench는 `status`, `recommended_route`, `options`, `decision_logic`, `evidence_ref`, `approval trace`를 100% 접근 가능하게 제공한다.

## Open Questions & Clarifications
### Open Questions
- None blocking `v1.0.0` development start.

### Clarifications Log
- 2026-04-09 Session:
  - Q: 최종 Owner / role 모델은 무엇인가? -> A: `OPS_ADMIN`, `LOGISTICS_APPROVER`, `LOGISTICS_REVIEWER`, `LOGISTICS_VIEWER`로 고정.
  - Q: `AMBER`, `REVIEW`, `ZERO` 차이는 무엇인가? -> A: `REVIEW`는 입력 충분 + 사람 판단 필요, `AMBER`는 추정/가정 의존, `ZERO`는 고위험 필수 입력 부족으로 고정.
  - Q: `WH snapshot freshness` 기준은 무엇인가? -> A: `<=24h normal`, `24~72h AMBER`, `>72h or missing ZERO`로 고정.
  - Q: FX handling은 어떻게 하는가? -> A: MVP는 runtime FX 미지원, non-AED input은 `ZERO`로 고정.
  - Q: `CRITICAL` exclusion threshold는 무엇인가? -> A: `eta > required_delivery_date` 또는 `deadline_slack_days < 0.00`이면 즉시 제외로 고정.
  - Q: tie-breaker는 무엇인가? -> A: `deadline_slack_days_desc → risk_penalty_asc → total_cost_aed_asc → transit_days_asc → route_code_asc`로 고정.
  - Q: manual override schema는 무엇인가? -> A: `decision_override_log` 필수 필드 계약으로 고정.
  - Q: 이전 Draft spec의 `[NEEDS CLARIFICATION]` 항목은 어떻게 처리하는가? -> A: 본 문서에서 모두 해소되어 `Approved` 상태로 전환.

## Risks & Mitigations
- R1: `rate_table` 최신성 부족 -> Mitigation: version pinning, effective date 검증, stale artifact 차단
- R2: transit 변동성으로 ETA 오차 발생 -> Mitigation: replay 가능한 `transit_estimate` 저장, 추후 rolling correction 확장
- R3: multimodal connection 실패 -> Mitigation: `connection_ok` 평가와 `CONNECTION_RISK_HIGH` reason code 반영
- R4: `WH snapshot` stale 또는 부재 -> Mitigation: canonical freshness rule로 `AMBER/ZERO` fail-safe 적용
- R5: docs/customs 정보 미완전 -> Mitigation: `MANDATORY_DOC_MISSING`, `CUSTOMS_REVIEW_REQUIRED`, `ZERO`/`REVIEW`/`AMBER` 상태로 명시 노출
- R6: recommendation과 execution 혼동 -> Mitigation: `execution_eligible`를 승인 후에만 true로 허용하고 execution CTA를 UI에서 제거
- R7: ranking tie 또는 opaque decision -> Mitigation: `Decision Logic`, tie-breaker, `Evidence Drawer`, `Audit` 모드로 근거를 노출
- R8: semistructured payload 확장으로 인한 무결성 저하 -> Mitigation: `jsonb` 저장 + CHECK/PK/FK 제약 병행
- R9: 승인 우회 또는 무권한 접근 -> Mitigation: role-based authorization과 audit log 강제

## Traceability
| Item | Links to |
|---|---|
| User Story 1 | FR-001, FR-007, FR-010, FR-016, FR-019, FR-041, FR-048, SC-001, SC-002, SC-006 |
| User Story 2 | FR-038, FR-041, FR-042, FR-043, SC-006 |
| User Story 3 | FR-022, FR-023, FR-024, FR-029, FR-030, FR-031, FR-032, FR-033, FR-034, FR-035, SC-003, SC-004, SC-005 |
| User Story 4 | FR-045, FR-052, FR-053, FR-054, FR-055, FR-070, FR-072, SC-007, SC-010, SC-011 |
| User Story 5 | FR-057, FR-058, FR-060, FR-062, FR-067, FR-068, FR-069, NFR-008, NFR-009, SC-011, SC-013, SC-014 |
| FR-042 | User Story 2 Acceptance Scenario 2 |
| FR-052 | User Story 4 Acceptance Scenario 1 |
| FR-068 | User Story 5 Acceptance Scenario 1, 2 |
| NFR-001 | SC-008 |
| NFR-008 | SC-013 |

## Changelog
- v1.0.0 (2026-04-09): `plan.patched.final.v2026.04.md`와 `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`를 반영해 Draft spec을 개발 착수 가능 `Approved` 계약 문서로 재작성.
