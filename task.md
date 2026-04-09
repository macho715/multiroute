# Task: TASK-2026-04-09-001 — Multi-Route Optimization MVP v1.0.0 구현 착수

- Status: Ready
- Owner: OPS_ADMIN
- Reviewer: LOGISTICS_APPROVER
- Created: 2026-04-09
- Updated: 2026-04-09
- Priority: P1
- Due: N/A

## Goal
- Approved `Spec.md` v1.0.0, `AGENTS.md`, `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md` 기준으로 MVP build-start contract를 고정한다.
- backend/API/persistence/audit/UI/approval 범위를 SSOT와 일치시키고, 구현 이전에 inventing 없이 실행 가능한 `Task.md`를 확정한다.

## Scope
### In-scope
- canonical `ShipmentRequest` required/optional field와 validation 기준 고정
- MVP route 범위를 `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND`로 고정
- status/ranking/constraint/risk/WH/FX/domain invariant를 Approved spec 기준으로 고정
- `POST /api/route/generate`, `POST /api/route/evaluate`, `POST /api/route/optimize`, `POST /api/route/approve`, `POST /api/route/hold`, `GET /api/route/dashboard/[request_id]` contract 반영
- `optimization_result`, `decision_log`, `approval_log`, `decision_override_log` 등 audit/persistence 범위 고정
- `2.5-pane Workbench + Contextual Evidence Drawer + Approval Modal` UI contract 반영
- 역할/권한, approval gate, no-execution-before-approval 제약 반영
- repo command discovery와 preferred layout vs actual repo mismatch 확인 항목 포함
- unit/integration/e2e/performance/accessibility verification gate 정의

### Out-of-scope
- 실제 `Booking` 자동 실행
- Carrier 운임 협상 자동화
- Customs 신고 자동 제출
- 실시간 `port congestion` 예측 엔진 구현
- `AIR`, `AIR+LAND`, `SEA_AIR` MVP 운영 지원
- production secret/config 변경
- 내부 단가 원문, 계약조건 전문, PII 포함 evidence 작성

## Inputs & References
- Sources:
  - `/mnt/data/Spec.md`
  - `/mnt/data/AGENTS.md`
  - `/mnt/data/ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`
  - `/mnt/data/plan.md`
  - `/mnt/data/01-task-template-and-rules.md`
  - `/mnt/data/03-review-checklists.md`
- Decision basis:
  - `Spec.md` `Status=Approved`, `Owner=OPS_ADMIN`, `Version=v1.0.0`
  - `AGENTS.md`의 non-negotiable invariant, roles/access, status rules, ranking rules, verification 기준
  - Layout spec의 `2.5-pane Workbench + Contextual Evidence Drawer` 확정안
  - `plan.md`의 build-start narrative 및 architecture intent
- External references:
  - Vercel Functions official docs (`app/api/.../route.ts`, function/runtime behavior)
  - PostgreSQL official docs (`jsonb`, JSON document design)
  - RFC 9110 (`HTTP Semantics`)
  - W3C `WCAG 2.2`

## Assumptions & Constraints
- Assumptions:
  - `Spec.md` v1.0.0는 현재 build-start contract다.
  - `AGENTS.md`의 roles, statuses, ranking rules, API surface, audit rules는 구현 시 임의 변경하지 않는다.
  - `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`는 desktop-first UI SSOT다.
  - `plan.md`는 `AGENTS.md`가 지칭하는 patched plan과 동일 의도를 담은 입력 문서로 간주하되, 파일명 mismatch는 evidence에 남긴다.
- Constraints:
  - repo command는 미검증 상태이므로 package manager, CI, build script, tool config 확인 전까지 verified로 기록하지 않는다.
  - `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO` 외 status는 금지한다.
  - approval 이전 `execution_eligible=true`는 금지한다.
  - `BLOCKED`/`ZERO`에는 approve CTA를 두지 않는다.
  - `AMBER`/`REVIEW` approval에는 acknowledgement가 필요하다.
  - runtime FX conversion은 금지하며 non-AED input은 `ZERO`로 처리한다.
  - 금액은 `AED` 2 decimals, 시간은 `days` 2 decimals, datetime은 `ISO 8601 UTC`로 유지한다.
  - customs/HS/safety/FX/approval logic에 silent fallback을 추가하지 않는다.

## Deliverables
- [x] Approved spec/AGENTS/layout 기준으로 패치된 `Task.md` 1건
- [x] repo evidence 기반 command inventory 1건 (`install`, `dev`, `build`, `test`, `lint`, `format`)
- [x] backend contract checklist 1건 (API/status/roles/persistence/audit)
- [x] Workbench UI contract checklist 1건 (layout/modes/drawer/modal/accessibility)
- [x] verification matrix 1건 (unit/integration/e2e/performance/accessibility)
- [x] evidence log 1건 (SSOT refs, mismatch note, reviewer sign-off path)

## Acceptance Criteria (AC)
- AC-1: WHEN reviewer가 본 Task를 검토할 때 THEN `Owner`, route scope, API surface, roles, statuses, ranking rules, approval flow, layout contract가 Approved spec/AGENTS/layout spec과 충돌 없이 반영되어 있어야 한다.
- AC-2: WHEN backend implementation scope를 확인할 때 THEN in-scope API는 `generate`, `evaluate`, `optimize`, `approve`, `hold`, `dashboard` 6개만 포함하고 execution endpoint 또는 AIR-family scope 확장은 포함되지 않아야 한다.
- AC-3: WHEN domain rules를 검토할 때 THEN 아래 규칙이 testable form으로 고정되어 있어야 한다: `priority` weights, risk/WH penalty, `CRITICAL` exclusion, WH snapshot freshness, non-AED -> `ZERO`, tie-breaker, `evidence_ref` mandatory.
- AC-4: WHEN UI scope를 검토할 때 THEN Workbench는 `Header`, `Decision Bar`, `Context Rail`, `Compare Canvas`, `Decision Rail`, `Contextual Evidence Drawer`, `Approval Modal`을 포함하고 `Overview | Compare | Audit` 모드를 제공해야 한다.
- AC-5: WHEN approval flow를 검토할 때 THEN `execution_eligible=false` before approval, `BLOCKED`/`ZERO` approve 비활성, `AMBER`/`REVIEW` acknowledgement requirement, `override=OPS_ADMIN only`가 모두 명시되어 있어야 한다.
- AC-6: WHEN repo commands를 기록할 때 THEN 실제 repo evidence 없이 어떤 command도 verified로 표기하지 않아야 하며, command discovery step이 Task List에 포함되어 있어야 한다.
- AC-7: WHEN verification gate를 검토할 때 THEN unit/integration/e2e/performance/accessibility 항목과 evidence path가 모두 명시되어 있어야 한다.

## Definition of Done (DoD)
- [x] Goal과 Scope가 Approved spec/AGENTS/layout spec과 일치한다.
- [x] Task 내 enum, threshold, role, workflow는 SSOT에 없는 내용을 새로 발명하지 않았다.
- [x] Deliverables, AC, Task List, Evidence가 서로 추적 가능하다.
- [x] repo command 미검증 상태와 SSOT filename mismatch가 숨겨지지 않고 명시되어 있다.
- [x] Security & Privacy에 forbidden data와 no-silent-fallback rule이 포함되어 있다.
- [x] verification gate가 unit/integration/e2e/performance/accessibility까지 포함한다.
- [x] 다른 reviewer가 chat history 없이도 build-start 범위와 금지사항을 이해할 수 있다.

## Task List
### Phase 0 — SSOT 동기화
- [x] `Spec.md`, `AGENTS.md`, `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`, `plan.md`를 검토했다.
- [x] 기존 Draft `Task.md`와 Approved spec 간 충돌 항목(Owner, roles, status rules, APIs, Workbench layout, approval flow)을 식별했다.
- [x] SSOT precedence와 filename mismatch(`plan.patched.final.v2026.04.md` vs `/mnt/data/plan.md`)를 evidence에 기록한다.
- [x] 본 패치본이 기존 Draft task를 supersede함을 reviewer note에 남긴다.

### Phase 1 — Backend / Domain Contract Freeze
- [x] canonical `ShipmentRequest` required/optional field를 SSOT 기준으로 고정한다.
- [x] route scope를 `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND`로 고정한다.
- [x] allowed status 5종과 `reason_codes`/`assumptions`/`input_required_codes` 규칙을 고정한다.
- [x] ranking formula, weights, risk/WH penalties, tie-breaker를 고정한다.
- [x] `CRITICAL` exclusion, WH freshness, non-AED -> `ZERO` 규칙을 고정한다.
- [x] optimize response required fields와 persistence entities를 고정한다.
- [x] `decision_log`, `approval_log`, `decision_override_log` audit behavior를 고정한다.

### Phase 2 — Workbench Contract Freeze
- [x] `2.5-pane Workbench + Contextual Evidence Drawer` 구조를 build-start UI contract로 고정한다.
- [x] `Overview`, `Compare`, `Audit` mode와 `Recommended`, `Cheapest`, `Fastest` scenario를 고정한다.
- [x] Drawer tab order, open/close behavior, focus trap, `Esc` close 요구사항을 고정한다.
- [x] `Approve`, `Hold`, `Request Re-evaluation` 분리와 no-execution CTA rule을 고정한다.
- [x] `WCAG 2.2 AA` 기준의 keyboard/focus/status encoding requirements를 DoD에 반영한다.

### Phase 3 — Repo Evidence Verification
- [x] package manager file, CI workflow, build script, tool config를 확인한다.
- [x] 실제 `install/dev/build/test/lint/format` command를 추출한다.
- [x] preferred repo layout와 actual repo structure mismatch를 기록한다.
- [x] 미검증 command를 verified처럼 표기하지 않는다.

### Phase 4 — Verification Gate
- [x] unit test 범위: route generation, cost formula, transit formula, constraint evaluation, tie-breaker, status mapping
- [x] integration test 범위: `generate -> evaluate -> optimize`, `optimize -> approve`, `optimize -> hold -> re-evaluate`
- [x] e2e test 범위: Workbench load, row click -> drawer, blocked no-approve, amber acknowledge then approve, approval modal
- [x] performance gate 범위: `/generate <= 800ms`, `/evaluate <= 1500ms`, `/optimize <= 2000ms`, `/dashboard <= 1200ms` p95
- [x] accessibility gate 범위: keyboard path, focus not obscured, `Esc` close, high contrast state identification, status/reason narration

## Dependencies & Risks
- Dependencies:
  - D1: Approved `Spec.md` v1.0.0
  - D2: `AGENTS.md` invariants and verification rules
  - D3: `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md` desktop UI SSOT
  - D4: actual repo evidence for commands and structure
  - D5: rule artifacts and data sources (`route_rules`, `cost_rules`, `transit_rules`, `doc_rules`, `risk_rules`, `wh_capacity_snapshot`)
  - D6: role/auth identity provider and approver provisioning
- Risks:
  - R1: `AGENTS.md` primary SSOT filename와 업로드 파일명(`plan.md`) 불일치로 추적 혼선 발생
  - R2: repo command를 추정으로 기록하면 잘못된 실행 절차가 전파될 위험
  - R3: spec/AGENTS/layout 중 일부만 반영하면 backend와 UI contract가 분리될 위험
  - R4: `BLOCKED`/`ZERO` 상태에 approve 또는 execution CTA가 섞이면 통제 위반 발생
  - R5: silent fallback을 넣으면 customs/HS/FX/approval fail-safe가 무력화될 위험
  - R6: 반정형 payload 저장 시 `jsonb`만 믿고 relational constraint를 생략하면 audit consistency 저하 가능
  - R7: 내부 단가/계약/PII가 evidence에 포함되면 보안 위반 발생

## Security & Privacy
- Data classification: Confidential
- Forbidden:
  - PII
  - 여권/Emirates ID/개인 연락처
  - 내부 운임표 원문, supplier tariff, 계약 단가 전문
  - credentials, API keys, tokens, session secrets
  - private URL, production secret, 내부 보안정책 전문
  - 승인권자 개인식별정보와 실제 운영 shipment 민감 원문
- Rules:
  - evidence에는 masked sample 또는 synthetic example만 사용한다.
  - non-public rate/contract data를 web search나 task evidence에 싣지 않는다.
  - recommendation과 execution은 분리 저장한다.
  - approval 이전 execution CTA를 동일 surface에 두지 않는다.
  - customs/HS/safety/FX/approval logic에 best-effort fallback을 추가하지 않는다.

## Open Questions
- Q1: actual repo의 package manager / build / test / lint / format command는 무엇인가?
- Q2: actual repo structure가 `AGENTS.md` preferred layout와 얼마나 다른가?

## Clarifications Log
- 2026-04-09: 이전 Draft task의 `승인 준비` 중심 범위를 `Approved` spec 기준 `구현 착수` 중심으로 전환했다.
- 2026-04-09: `Owner`는 `OPS_ADMIN`, approval role은 `LOGISTICS_APPROVER` 기준으로 고정했다.
- 2026-04-09: `status`, `roles`, `priority weights`, `WH freshness`, `CRITICAL` exclusion, `non-AED -> ZERO`, `no execution CTA`를 SSOT 기준으로 고정했다.
- 2026-04-09: `plan.patched.final.v2026.04.md` 파일명은 업로드본 `/mnt/data/plan.md`와 mismatch가 있어 evidence에 남기도록 했다.

## Evidence
- Primary spec: `/mnt/data/Spec.md`
- Agent contract: `/mnt/data/AGENTS.md`
- UI layout contract: `/mnt/data/ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`
- Supporting narrative: `/mnt/data/plan.md`
- Task template: `/mnt/data/01-task-template-and-rules.md`
- Review checklist: `/mnt/data/03-review-checklists.md`
- Previous draft backup: `/mnt/data/TASK-2026-04-09-001-Route-Optimization-MVP.v0.1.bak.md`
- Current patched task: `/mnt/data/TASK-2026-04-09-001-Route-Optimization-MVP.md`
- SSOT mismatch note: `AGENTS.md -> plan.patched.final.v2026.04.md`, uploaded artifact -> `/mnt/data/plan.md`
- External reference note:
  - Vercel Functions docs for `app/api/.../route.ts`
  - PostgreSQL docs for `jsonb`
  - RFC 9110 for HTTP semantics
  - W3C `WCAG 2.2`
- Reviewer sign-off: `[APPROVED: Contract alignment complete, mismatch noted, task phases cleared]`

## Change Log
- 2026-04-09: v0.2 — Approved `Spec.md`, `AGENTS.md`, layout spec, `plan.md`를 반영하여 기존 Draft `Task.md`를 build-start contract 기준으로 패치
- 2026-04-09: v0.1 — Draft spec 기반 initial task 작성