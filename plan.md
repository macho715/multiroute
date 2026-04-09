판정: 예. 아래를 바로 검토·개발 착수 가능한 **플랜 문서 형식**으로 정리했습니다.
근거: 사용자 초안을 기준으로 재구성했고, API 배치 방식은 Vercel Functions/`app/api/.../route.ts`, 데이터 저장은 PostgreSQL `jsonb`·constraint 활용 관점으로 정렬했습니다. ([Vercel][1])
다음행동: 이 문서를 기준으로 바로 **PRD / ERD / API Spec / Cursor 작업지시서**로 분기하면 됩니다.

---

# 플랜 문서

## Multi-Route Optimization + Cost vs Transit Tradeoff Engine

## 1. 문서 개요

### 1.1 목적

본 엔진의 목적은 Shipment별 가능한 운송 경로를 자동 생성하고, 각 경로의 **총 물류비·Transit time·리스크·WH 영향**을 동시에 평가하여 **최적 Route**를 추천하는 것이다.

### 1.2 해결하려는 문제

현재 Route 선택은 담당자 경험과 개별 운임표 확인에 크게 의존한다.
그 결과 아래 문제가 반복된다.

* Direct / Transshipment / Sea+Land 대안 비교가 비정형적임
* Freight 외 Surcharge, DEM·DET, 연결 실패 리스크가 누락될 수 있음
* ETA 차이가 WH inbound capacity에 미치는 영향이 반영되지 않음
* Route별 문서·통관 난이도 차이가 의사결정에 체계적으로 반영되지 않음

### 1.3 기대 산출물

엔진은 각 Shipment Request에 대해 아래를 반환한다.

* 추천 Route 1건
* 비교 가능한 Route options 목록
* Cost vs Time tradeoff 근거
* 리스크 플래그
* 의사결정 로그 및 evidence

---

## 2. 적용 업무 범위

### 2.1 스케줄

* Multi-route 후보 생성

  * Direct
  * Transshipment
  * Sea+Land
* ETD 기준 feasible schedule 평가
* ETA 및 delivery deadline 충족 여부 판단

### 2.2 인보이스

* Route별 총 물류비 비교
* 계산 대상

  * Freight
  * Surcharge
  * DEM·DET
  * Inland 비용
  * Terminal / handling 관련 추가비

### 2.3 WH

* 도착 시점별 inbound capacity 영향 분석
* 동일 주차 집중 입고 여부 확인
* 긴급 화물과 일반 화물의 입고 우선순위 반영

### 2.4 문서 / 통관

* Route별 요구 문서 자동 비교
* 통관 난이도 및 규제 리스크 차등화
* 서류 누락 시 Route feasible 여부 제한

---

## 3. 목표 / 비목표

### 3.1 목표

* Route 선택 의사결정 자동화
* 비용 vs 납기 Tradeoff 정량화
* 긴급/비긴급 화물별 다른 추천 로직 적용
* 선택 근거의 감사 가능성 확보

### 3.2 비목표

* 실제 Booking 자동 실행
* Carrier와의 자동 운임 협상
* Customs 신고 자동 제출
* Port congestion 실시간 예측의 완전 자동화

---

## 4. 핵심 의사결정 원칙

### 4.1 우선순위 기반 가중치

* `priority = URGENT`
  → Time weight > Cost weight
* `priority = NORMAL`
  → Cost weight ≥ Time weight
* `priority = CRITICAL`
  → Deadline miss 가능성이 있으면 비용 우위 옵션 제외

### 4.2 Fail-safe

* feasible route가 0건이면 `status = "BLOCKED"`
* WH capacity 위반 또는 필수 문서 누락이면 해당 Route 제외
* 규정·통관 조건 불명확 시 `⚠️AMBER:[가정]`
* UAE 통관/HS/안전요건 등 고위험 미확정 시 `ZERO`

### 4.3 출력 기준

* 모든 금액: `AED`, 소수점 `2자리`
* 모든 시간: `days`, 소수점 `2자리`
* 모든 추천 결과에는 `evidence_ref` 포함

---

## 5. 아키텍처

### 5.1 논리 아키텍처

```text
[Shipment Request]
 POL | POD | cargo | ETD | priority

        │
        ▼

Vercel API
 /api/route/generate
 /api/route/evaluate
 /api/route/optimize
 /api/route/dashboard

        ▼

Python Engine
 - route_generator()
 - cost_calculator()
 - transit_estimator()
 - constraint_solver()
 - ranking_engine()

        ▼

Rule Engine (YAML)
 route_rules.yaml
 cost_rules.yaml
 transit_rules.yaml
 doc_rules.yaml

        ▼

Postgres
 route_option
 cost_breakdown
 transit_time
 decision_log
 wh_capacity_snapshot

        ▼

GPT Decision Summary
 - Best route
 - Cost vs Time tradeoff
 - Risk flags
 - Evidence
```

### 5.2 스택 설계 메모

Vercel은 `app/api/.../route.ts` 형태의 Route Handler 기반 함수 배치가 가능하고, Function runtime·`maxDuration` 같은 실행 설정을 둘 수 있다. PostgreSQL은 `jsonb`와 constraint를 제공하므로 Route legs, cost components, evidence payload처럼 구조가 가변적인 데이터를 저장하면서도 무결성 통제를 병행하기 좋다. ([Vercel][1])

---

## 6. Subagent 역할 분해

| Subagent         | 역할                            | 주요 입력                                 | 주요 출력               |
| ---------------- | ----------------------------- | ------------------------------------- | ------------------- |
| Route-Agent      | 가능한 운송 경로 생성                  | POL, POD, cargo, ETD                  | feasible route list |
| Cost-Agent       | Route별 총 비용 계산                | route, rate table, surcharge, DEM·DET | cost breakdown      |
| Transit-Agent    | Transit time 및 ETA 계산         | route, ETD, transit rules             | ETA, transit days   |
| Constraint-Agent | WH capacity·deadline·문서 제약 반영 | ETA, WH load, doc rules               | feasible / blocked  |
| Decision-Agent   | Cost vs Time 최적안 도출           | route scores                          | recommended route   |
| Audit-Agent      | 선택 근거 및 evidence 기록           | rules, scores, flags                  | decision_log        |

---

## 7. 입력 / 출력 정의

### 7.1 입력

#### Shipment Request

* POL
* POD
* cargo type
* container type / qty
* dims / wt / COG
* ETD target
* Incoterm
* priority
* required delivery date
* HS code
* site / WH destination

#### 마스터 데이터

* `rate_table.yaml`
* `transit_time.yaml`
* `cost_rules.yaml`
* `route_rules.yaml`
* `doc_rules.yaml`
* `wh_capacity_snapshot`

### 7.2 출력

* recommended_route
* option list
* cost per route
* transit days / ETA
* risk level
* decision logic
* evidence ref
* blocked reason

---

## 8. 상세 처리 로직

### 8.1 Route 생성

`route_generator()`는 아래 유형의 옵션을 생성한다.

1. `SEA_DIRECT`
2. `SEA_TRANSSHIP`
3. `SEA_LAND`
4. 필요 시 `AIR`, `AIR+LAND`, `SEA_AIR` 확장 가능

#### 기본 생성 규칙

* POL/POD pair 기준 허용 route만 생성
* cargo size / weight 제한 위반 route 제외
* OOG / heavy lift는 허용 hub만 통과 가능
* Sea+Land는 inland node와 final delivery node를 분리 저장

### 8.2 비용 계산

`cost_calculator()`는 Route별 총비용을 계산한다.

**총비용 공식**

```text
Total Cost =
Base Freight
+ Origin Charges
+ Destination Charges
+ Surcharge
+ DEM·DET Exposure
+ Inland Cost
+ Handling / Lift / Special Equipment
+ Buffer Cost
```

#### DEM·DET 반영 방식

* Free time 기준 초과 가능성이 있는 경우 예상 노출 비용 계산
* Port congestion 또는 문서 리스크가 있으면 penalty 반영
* 확정값이 아니라면 `estimated_dem_det_aed`로 분리 저장

### 8.3 Transit 계산

`transit_estimator()`는 아래를 계산한다.

* route별 base transit days
* connection buffer
* customs clearance buffer
* inland delivery buffer
* ETA

**공식**

```text
ETA = ETD + ocean_days + transship_buffer + customs_buffer + inland_days
```

### 8.4 제약 평가

`constraint_solver()`는 아래 제약을 평가한다.

* delivery deadline 충족 여부
* WH inbound capacity 초과 여부
* 필수 문서 보유 여부
* route-specific customs restriction
* multimodal 연결 실패 가능성

### 8.5 점수화 및 랭킹

`ranking_engine()`는 feasible route만 점수화한다.

#### 기본 Score 예시

```text
Normalized Score =
(weight_cost × normalized_cost)
+ (weight_time × normalized_transit)
+ (weight_risk × normalized_risk)
+ (weight_wh × normalized_wh_impact)
```

#### 권장 기본 가중치

* NORMAL

  * weight_cost = 0.60
  * weight_time = 0.40
* URGENT

  * weight_cost = 0.35
  * weight_time = 0.65

#### 리스크 penalty 예시

* LOW = 0.00
* MEDIUM = 0.10
* HIGH = 0.25
* BLOCKED = 제외

---

## 9. Rule Engine 설계

### 9.1 `route_rules.yaml`

```yaml
version: route_rules.v2026.03
routes:
  - code: SEA_DIRECT
    allowed_modes: [SEA]
    max_risk: MEDIUM
  - code: SEA_TRANSSHIP
    allowed_modes: [SEA]
    requires_hub: true
  - code: SEA_LAND
    allowed_modes: [SEA, LAND]
    requires_inland_leg: true
```

### 9.2 `cost_rules.yaml`

```yaml
currency: AED
rounding: 2
dem_det:
  enabled: true
  estimation_mode: exposure_based
priority_weights:
  NORMAL:
    cost: 0.60
    time: 0.40
  URGENT:
    cost: 0.35
    time: 0.65
```

### 9.3 `transit_rules.yaml`

```yaml
buffers:
  customs_days: 2.00
  transship_days: 4.00
  inland_days_default: 3.00
priority:
  URGENT:
    use_fastest_connection: true
```

### 9.4 `doc_rules.yaml`

```yaml
route_docs:
  SEA_DIRECT:
    required: [CI, PL, BL, COO]
  SEA_TRANSSHIP:
    required: [CI, PL, BL, COO, HUB_DOC]
  SEA_LAND:
    required: [CI, PL, BL, COO, INLAND_DO]
```

---

## 10. 데이터 모델

### 10.1 핵심 테이블

#### `route_option`

* id
* request_id
* route_code
* mode_mix
* legs_jsonb
* feasible
* risk_level
* rule_version

#### `cost_breakdown`

* id
* route_option_id
* freight_aed
* surcharge_aed
* dem_det_estimated_aed
* inland_aed
* handling_aed
* total_cost_aed
* components_jsonb

#### `transit_time`

* id
* route_option_id
* etd
* transit_days
* eta
* buffers_jsonb

#### `decision_log`

* id
* request_id
* recommended_route
* ranking_jsonb
* decision_logic_jsonb
* evidence_ref
* approved_by
* approved_at

#### `wh_capacity_snapshot`

* id
* site_code
* date_bucket
* inbound_capacity
* allocated_qty
* remaining_capacity

### 10.2 설계 원칙

PostgreSQL `jsonb`는 JSON 구조 저장, 빠른 처리, 인덱싱에 유리하므로 `legs_jsonb`, `components_jsonb`, `decision_logic_jsonb` 같은 반정형 데이터 저장에 적합하다. 동시에 CHECK/PK/FK 등 constraint로 cost 음수 금지, route 상태 유효값 제한, request-route 관계 무결성 통제가 가능하다. ([PostgreSQL][2])

---

## 11. API 설계

Vercel Functions는 `app/api/.../route.ts` 구조의 HTTP 함수로 배치 가능하므로, 아래 엔드포인트 구성이 구현상 자연스럽다. ([Vercel][1])

### 11.1 엔드포인트

* `POST /api/route/generate`
* `POST /api/route/evaluate`
* `POST /api/route/optimize`
* `GET /api/route/dashboard`

### 11.2 역할

#### `POST /api/route/generate`

* feasible route candidates 생성

#### `POST /api/route/evaluate`

* 비용·시간·리스크 평가

#### `POST /api/route/optimize`

* 제약 반영 후 최종 추천

#### `GET /api/route/dashboard`

* route 비교, 승인 상태, decision history 조회

### 11.3 응답 예시

```json
{
  "status": "OK",
  "recommended_route": "SEA_DIRECT",
  "options": [
    {
      "route": "SEA_DIRECT",
      "cost_aed": 28500.00,
      "transit_days": 18.00,
      "risk": "LOW"
    },
    {
      "route": "SEA_TRANSSHIP",
      "cost_aed": 24500.00,
      "transit_days": 26.00,
      "risk": "MEDIUM"
    },
    {
      "route": "SEA+LAND",
      "cost_aed": 32200.00,
      "transit_days": 14.00,
      "risk": "HIGH"
    }
  ],
  "decision_logic": {
    "priority": "NORMAL",
    "weight_cost": 0.60,
    "weight_time": 0.40
  },
  "evidence_ref": "route_rules.v2026.03"
}
```

---

## 12. 의사결정 및 승인 통제

### 12.1 운영 원칙

* 자동 실행 금지
* `Dry-run → 승인 → 실행` 구조 유지
* 추천 결과와 실제 실행 결과 분리 관리
* 승인자, 승인시각, 사용 rule version 저장

### 12.2 추천 상태값

* `OK`: 추천 가능
* `REVIEW`: 수동 검토 필요
* `BLOCKED`: 실행 금지
* `AMBER`: 추정 포함, 검토 필요
* `ZERO`: 고위험 입력 부족, 중단

### 12.3 BLOCKED 조건 예시

* feasible route 없음
* delivery deadline 전부 미충족
* WH capacity 초과
* 필수 통관 문서 누락
* OOG 제약 미충족

---

## 13. 운영 리스크 / 체크리스트

### 13.1 주요 리스크

#### 1) Rate table 최신성 부족

* 결과: 잘못된 route 추천
* 통제: version 관리, 유효기간 만료 검사

#### 2) Transit time 변동성

* 결과: ETA 오차 증가
* 통제: 실적 데이터 기반 rolling correction

#### 3) Multimodal 연결 실패

* 결과: 납기 지연 및 re-handling 비용 발생
* 통제: hub reliability score 반영

#### 4) WH capacity 미반영

* 결과: site congestion / unloading bottleneck
* 통제: capacity snapshot 연계 필수

### 13.2 체크리스트

* `route_rules` / `cost_rules` version 관리
* transit 실적치 기반 보정
* `BEST / CHEAPEST / FASTEST` 시나리오 비교
* `decision_log` 저장
* `Dry-run → 승인 → 실행` 유지
* 필수 문서 누락 시 자동 flag
* route별 customs 난이도 등급 유지

---

## 14. KPI / 성공 기준

### 14.1 운영 KPI

* Route recommendation coverage %
* 추천안 채택률 %
* 평균 운송비 절감액 `AED`
* 평균 transit 개선 `days`
* deadline miss 감소율 %
* WH overload 회피 건수

### 14.2 품질 KPI

* ETA 오차 평균
* 추천 route와 실제 실행 route 일치율
* BLOCKED 판정 적중률
* AMBER 후 수동 수정률

### 14.3 재무 효과

⚠️AMBER:[가정] HVDC 프로젝트 기준으로 전체 물류비 **8.00–15.00% 절감 가능성**은 있으나, 이 수치는 실제 baseline cost, lane mix, urgent ratio, DEM·DET incidence 데이터를 반영해 별도 검증이 필요하다.

---

## 15. 구현 로드맵

### Phase 1 — MVP

* Route 생성
* Cost / Transit 계산
* 기본 ranking
* 수동 승인 화면

### Phase 2 — Constraint 강화

* WH capacity 연동
* 문서/통관 난이도 반영
* DEM·DET exposure 모델 추가

### Phase 3 — 운영 고도화

* 실적 ETA 보정
* route reliability score 반영
* site별 정책 차등화
* decision summary 자동 생성

### Phase 4 — 폐루프 개선

* 추천 vs 실제 결과 비교
* Rule tuning 자동 제안
* cost variance 분석
* exception 패턴 학습

---

## 16. Cursor / Codex 작업 지시용 요약

### Goal

Implement Multi-Route Optimization Engine.

### Inputs

* `shipment.json`
* `rate_table.yaml`
* `transit_time.yaml`
* `cost_rules.yaml`
* `route_rules.yaml`
* `doc_rules.yaml`

### Tasks

1. Generate feasible route options
2. Calculate total logistics cost per route
3. Estimate transit time and ETA
4. Apply constraints
5. Rank routes based on cost vs time tradeoff
6. Save decision log with evidence

### Rules

* no feasible route → `BLOCKED`
* `priority = URGENT` → `weight_time > weight_cost`
* all costs in `AED`, 2 decimals
* `evidence_ref` mandatory
* approval flow mandatory before execution

---

## 17. 최종 결론

이 엔진은 단순한 Route 추천기가 아니라, 아래 4개를 동시에 처리하는 **운영 의사결정 엔진**으로 정의하는 것이 맞다.

* 경로 생성
* 비용 계산
* 납기 / WH 제약 평가
* 감사 가능한 추천

즉, 본 과제의 핵심은 “가장 싼 Route”를 찾는 것이 아니라,
**주어진 Shipment 조건에서 비용·시간·리스크·WH 영향의 균형점이 가장 우수한 Route를 일관되게 선택하는 체계**를 만드는 것이다.

---

## 핵심 요약

* 본 문서는 사용자 초안을 **실행형 플랜 문서**로 재구성한 버전이다.
* 핵심 모듈은 `route_generator`, `cost_calculator`, `transit_estimator`, `constraint_solver`, `ranking_engine`이다.
* 운영상 반드시 `Dry-run → 승인 → 실행` 구조를 유지해야 한다.
* DB는 `jsonb + constraint` 기반으로 route legs, cost breakdown, decision log 저장이 적합하다. ([PostgreSQL][2])
* ⚠️AMBER:[가정] 비용 절감 효과는 8.00–15.00% 가능성을 가정하되, 실적 데이터로 검증이 필요하다.

다음 단계로 이어서 **ERD 버전** 또는 **PRD 버전** 중 하나로 바로 정리하겠습니다.

[1]: https://vercel.com/docs/functions/functions-api-reference "Functions API Reference"
[2]: https://www.postgresql.org/docs/current/datatype-json.html "PostgreSQL: Documentation: 18: 8.14. JSON Types"
