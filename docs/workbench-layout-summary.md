# Workbench Layout Summary

최종 Workbench 레이아웃은 **2.5-pane + Contextual Evidence Drawer**다.

## Fixed Surfaces
- Header
- Decision Bar
- Context Rail
- Compare Canvas
- Decision Rail
- Contextual Evidence Drawer
- Approval Modal

## Fixed Modes
- `Overview`
- `Compare`
- `Audit`

## Compare Canvas Requirements
각 route row는 최소 아래를 노출해야 한다.
- `route_code`
- `rank`
- `feasible`
- `ETA`
- `transit_days`
- `total_cost_aed`
- `risk_level`
- `wh_impact_level`
- `docs_completeness_pct`
- `reason chip count`
- `evidence chip count`

## Evidence Drawer Tabs
1. Overview
2. Route Legs
3. Cost Breakdown
4. Transit & Buffers
5. Docs & Customs
6. WH Impact
7. Evidence & Rule Version
8. Approval Trace

## Critical UI Constraints
- comparison is the primary interaction surface
- recommended row is pinned at top
- `BLOCKED` and `ZERO` do not expose approve CTA
- `AMBER` and `REVIEW` approval requires acknowledgement checkbox
- approval and execution must never be on the same surface
- `Esc` closes the drawer and returns focus safely
