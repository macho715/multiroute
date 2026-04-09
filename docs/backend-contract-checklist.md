# Backend Contract Checklist

## 1. ShipmentRequest & Route Scope
- [x] canonical `ShipmentRequest` required/optional fields validated (`request_id`, `pol_code`, `pod_code`, `priority`, etc.)
- [x] Route generation restricted to MVP routes: `SEA_DIRECT`, `SEA_TRANSSHIP`, `SEA_LAND`

## 2. Status & Ranking Rules
- [x] Status mapping verified to strictly use: `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO`
- [x] Ranking normalization logic matches `min_max` implementation
- [x] Priority weights matched for `NORMAL`, `URGENT`, `CRITICAL`
- [x] `CRITICAL` exclusion, WH freshness, and non-AED to `ZERO` rules applied securely
- [x] Tie-breaker sequence correctly followed

## 3. API Surface & Persistence
- [x] API Endpoints conform to contract (`/generate`, `/evaluate`, `/optimize`, `/approve`, `/hold`, `/dashboard`)
- [x] Required fields (`status`, `decision_logic`, `evidence_ref`, `reason_codes`, etc.) included in optimization response
- [x] Audit entities (`decision_log`, `approval_log`, `decision_override_log`) successfully persisted
