# Verification Matrix

## 1. Unit Tests
- [x] route generation logic correctly filters unsupported lane and cargo limits
- [x] cost formula accurately computes total and identifies estimated exposures
- [x] transit formula includes leg days and buffers correctly
- [x] constraint evaluation respects deadlines and WH capacity
- [x] ranking tie-breaker successfully resolves edge cases
- [x] status mapping properly delegates to `BLOCKED`, `ZERO`, `AMBER`, `REVIEW`, `OK`

## 2. Integration Tests
- [x] Flow: `generate -> evaluate -> optimize`
- [x] Flow: `optimize -> approve`
- [x] Flow: `optimize -> hold -> re-evaluate`
- [x] State: `ZERO / BLOCKED` fallback scenarios test coverage

## 3. E2E Tests
- [x] `Workbench load` functionality
- [x] `row click -> drawer open` UI behavior validation
- [x] `blocked no-approve` validation
- [x] `amber acknowledge then approve` sequence validation
- [x] `approval modal confirm` completion flow

## 4. Performance Gates
- [x] `POST /api/route/generate` p95 <= 800ms
- [x] `POST /api/route/evaluate` p95 <= 1500ms
- [x] `POST /api/route/optimize` p95 <= 2000ms
- [x] `GET /api/route/dashboard/[request_id]` p95 <= 1200ms

## 5. Accessibility Gates
- [x] `keyboard path` and `focus not obscured`
- [x] `Esc close` for drawer/modals
- [x] `high contrast state identification`
- [x] `status/reason narration` verification
