# AGENTS.md
## Source of Truth
- Primary SSOT: `plan.patched.final.v2026.04.md`
- Supporting contracts: `Multi-Route-Optimization-Spec.md`, `ROUTE_WORKBENCH_LAYOUT_SPEC_v2026.04.md`
- Treat the patched plan as the final build-start contract unless repo code intentionally supersedes it.
- Do not invent commands, paths, thresholds, enums, owners, or workflow behavior beyond confirmed sources.
- If implementation and SSOT diverge, surface the mismatch explicitly.

## Commands
- Repository commands are still unverified from repo evidence.
- Before changing code, inspect package manager files, CI workflows, build scripts, and tool configs to extract real `install`, `dev`, `build`, `test`, `lint`, and `format` commands.
- Do not assume `npm`, `pnpm`, `uv`, `pytest`, `docker`, or deployment commands without direct repo evidence.

## Product Identity
- This product is an **operations decision engine**, not a booking automation system.
- MVP scope is fixed to `SEA_DIRECT`, `SEA_TRANSSHIP`, and `SEA_LAND`.
- Non-goals: booking execution, carrier negotiation automation, customs filing automation, real-time congestion prediction, and operational AIR-family support.

## Non-negotiable Invariants
- Allowed statuses: `OK`, `REVIEW`, `AMBER`, `BLOCKED`, `ZERO`.
- Store recommendation and actual execution separately.
- Preserve `Dry-run -> Approval -> Execution Eligible` separation.
- Never expose an execution CTA before approval.
- All recommendation outputs require `evidence_ref`.
- Money: `AED` with 2 decimals. Time: `days` with 2 decimals. Datetime: ISO 8601 UTC.

## Roles and Access
- Roles: `OPS_ADMIN`, `LOGISTICS_APPROVER`, `LOGISTICS_REVIEWER`, `LOGISTICS_VIEWER`.
- `generate`, `evaluate`, `optimize`: reviewer/approver/admin.
- `approve`, `hold`: approver/admin.
- `dashboard`: viewer/reviewer/approver/admin.
- `override`: admin only.

## Core APIs
- `POST /api/route/generate`
- `POST /api/route/evaluate`
- `POST /api/route/optimize`
- `POST /api/route/approve`
- `POST /api/route/hold`
- `GET /api/route/dashboard/[request_id]`

## Core Modules and Rule Files
- Modules: `route_generator()`, `cost_calculator()`, `transit_estimator()`, `constraint_evaluator()`, `ranking_engine()`, `decision_logger()`.
- Rule files: `route_rules.yaml`, `cost_rules.yaml`, `transit_rules.yaml`, `doc_rules.yaml`, `risk_rules.yaml`.

## Request / Response Contract
- Required shipment fields: `request_id`, `pol_code`, `pod_code`, `cargo_type`, `container_type`, `quantity`, `dims_cm`, `gross_weight_kg`, `etd_target`, `required_delivery_date`, `incoterm`, `priority`, `hs_code`, `destination_site`.
- Optional fields: `cog_cm`, `docs_available`, `remarks`.
- `priority` enum is fixed: `NORMAL`, `URGENT`, `CRITICAL`.
- Optimize output must include `status`, `recommended_route_id`, `recommended_route_code`, `options`, `decision_logic`, `reason_codes`, `assumptions`, `input_required_codes`, `evidence_ref`, `rule_version`, `feasible_count`, `total_count`, `approval_state`, `execution_eligible`, `generated_at`.

## Status Rules
- `REVIEW`: input is sufficient, but human operational/commercial judgment is still required.
- `AMBER`: feasible result exists, but medium-risk assumptions or estimates remain.
- `ZERO`: high-risk required input is missing; stop evaluation.
- `BLOCKED`: feasible route count is zero or all routes violate hard constraints.
- `AMBER` requires at least 1 assumption note.
- `ZERO` requires at least 1 `input_required_code`.
- `BLOCKED / REVIEW / AMBER / ZERO` require at least 1 reason code.

## Hard Domain Rules
- Only generate routes allowed by `POL/POD`, cargo rules, and hub restrictions.
- `SEA_LAND` requires an inland final leg.
- Exclude routes violating size, weight, COG, OOG, heavy-lift, or hub restrictions.
- `CRITICAL` excludes routes when `eta > required_delivery_date` or `deadline_slack_days < 0.00`.
- WH freshness: `<=24h` normal, `>24h and <=72h` => `AMBER`, `>72h` or missing => `ZERO`.
- MVP does **not** do runtime FX conversion. Costs must already be AED-normalized; non-AED input triggers `ZERO` with `FX_NORMALIZED_AED_REQUIRED`.

## Ranking Rules
- Normalize feasible candidates with `min_max`.
- Risk penalty: `LOW=0.00`, `MEDIUM=0.10`, `HIGH=0.25`, `BLOCKED=excluded`.
- WH penalty: `LOW=0.00`, `MEDIUM=0.10`, `HIGH=0.20`, `BLOCKED=excluded`.
- Priority weights:
  - `NORMAL`: cost `0.50`, time `0.25`, risk `0.15`, wh `0.10`
  - `URGENT`: cost `0.25`, time `0.50`, risk `0.15`, wh `0.10`
  - `CRITICAL`: cost `0.15`, time `0.60`, risk `0.15`, wh `0.10`
- Tie-breaker:
  1. `deadline_slack_days` desc
  2. `risk_penalty` asc
  3. `total_cost_aed` asc
  4. `transit_days` asc
  5. `route_code` asc

## Reason Codes
- Use the fixed codes; do not invent near-duplicate enums.
- Canonical set: `LANE_UNSUPPORTED`, `MANDATORY_DOC_MISSING`, `WH_CAPACITY_BLOCKED`, `DEADLINE_MISS`, `HS_CODE_MISSING`, `CUSTOMS_INPUT_MISSING`, `FX_NORMALIZED_AED_REQUIRED`, `WH_SNAPSHOT_STALE`, `HUB_RESTRICTED_FOR_OOG`, `WEIGHT_LIMIT_EXCEEDED`, `COG_DATA_REQUIRED`, `CONNECTION_RISK_HIGH`, `DEM_DET_EXPOSURE_ESTIMATED`, `CUSTOMS_REVIEW_REQUIRED`.

## Data and Audit Rules
- Persist route legs, costs, transit, constraints, optimization result, decision log, approval log, override log, WH snapshot, and rule set version separately.
- Manual intervention must be logged in `decision_override_log`; do not overwrite optimization history.
- Keep `rule_version` pinned on every evaluation result.
- Preserve replayability for same input + same rule version + same snapshot.

## Preferred Repo Layout
- API handlers: `src/app/api/route/{generate,evaluate,optimize,approve,hold}/route.ts`
- Dashboard route: `src/app/api/route/dashboard/[request_id]/route.ts`
- Workbench page: `src/app/workbench/[request_id]/page.tsx`
- Domain/application/infrastructure/UI split under `src/modules/route-optimization/`
- Rule files under `rules/`; tests under `tests/unit`, `tests/integration`, `tests/e2e`.
- If the actual repo already differs, follow real repo structure over this recommendation.

## UI Constraints
- Workbench layout is fixed to **2.5-pane + Contextual Evidence Drawer**.
- Required surfaces: `Header`, `Decision Bar`, `Context Rail`, `Compare Canvas`, `Decision Rail`, `Contextual Evidence Drawer`, `Approval Modal`.
- Required modes: `Overview`, `Compare`, `Audit`.
- `Compare Canvas` is the primary comparison surface; do not bury route comparison below the fold.
- `Decision Rail` owns recommendation, assumptions, and approval controls.
- `BLOCKED` and `ZERO` must not expose an approve CTA.
- `AMBER` and `REVIEW` approval requires an acknowledgement checkbox.
- Never place approval and execution on the same surface.

## Boundaries
- Prefer minimal diffs and existing patterns.
- Ask before changing schema, auth, approval flow, deployment config, secrets handling, or production-sensitive behavior.
- Do not hardcode secrets, private URLs, internal rates, or PII.
- Do not add silent fallbacks for customs, HS, safety, FX, or approval logic.
- Do not downgrade explicit blocked/zero behavior into best-effort recommendations.

## Verification
- Minimum acceptance:
  - relevant checks pass
  - status enum stays within 5 allowed values
  - `evidence_ref` is present where required
  - `execution_eligible` is `false` before approval and `true` only after approval
  - `BLOCKED / REVIEW / AMBER / ZERO` paths expose required reason/assumption/input-needed fields
  - money stays `AED`/2 decimals and time stays `days`/2 decimals
- Required tests:
  - unit: route generation, cost formula, transit formula, constraint evaluation, tie-breaker, status mapping
  - integration: `generate -> evaluate -> optimize`, `optimize -> approve`, `optimize -> hold -> re-evaluate`
  - e2e: workbench load, row click -> drawer, approval modal, blocked no-approve, amber acknowledge then approve
- Performance targets: `/generate` p95 `<=800ms`, `/evaluate` `<=1500ms`, `/optimize` `<=2000ms`, `/dashboard` `<=1200ms`.

## Output Contract
- Summarize what changed.
- List files touched.
- List commands actually run and their results.
- Call out any unverified repo commands or structure mismatches.
