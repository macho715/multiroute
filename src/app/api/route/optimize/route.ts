/**
 * POST /api/route/optimize
 *
 * Final optimization result: ranking, recommendation, and decision logic (FR-048).
 *
 * Workflow: generate -> evaluate -> optimize
 * Output includes status, recommended_route, options, decision_logic,
 * reason_codes, assumptions, input_required_codes, evidence_ref (FR-048).
 */
import { NextRequest, NextResponse } from "next/server";
import type {
  ShipmentRequest,
  RouteOption,
  OptimizeResponse,
  RankedRouteOption,
  DecisionLogic,
  RuleVersion,
  RouteStatus,
} from "../types";

const RULE_VERSIONS: RuleVersion = {
  route_rules: "v2026.04",
  cost_rules: "v2026.04",
  transit_rules: "v2026.04",
  doc_rules: "v2026.04",
  risk_rules: "v2026.04",
};

// Priority weights (FR-038)
const PRIORITY_WEIGHTS: Record<string, { cost: number; time: number; risk: number; wh: number }> = {
  NORMAL: { cost: 0.50, time: 0.25, risk: 0.15, wh: 0.10 },
  URGENT: { cost: 0.25, time: 0.50, risk: 0.15, wh: 0.10 },
  CRITICAL: { cost: 0.15, time: 0.60, risk: 0.15, wh: 0.10 },
};

// Risk penalties (FR-039)
const RISK_PENALTIES: Record<string, number> = {
  LOW: 0.00, MEDIUM: 0.10, HIGH: 0.25, BLOCKED: 0.0,
};

// WH penalties (FR-040)
const WH_PENALTIES: Record<string, number> = {
  LOW: 0.00, MEDIUM: 0.10, HIGH: 0.20, BLOCKED: 0.0,
};

// Tie-breaker order (FR-043)
const TIE_BREAKER = [
  "deadline_slack_days_desc",
  "risk_penalty_asc",
  "total_cost_aed_asc",
  "transit_days_asc",
  "route_code_asc",
];

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.0;
  return (value - min) / (max - min);
}

function computeStatus(
  rankedRoutes: RankedRouteOption[],
  allRoutes: RouteOption[],
  constraints: Array<{ reason_codes: string[]; input_required_codes: string[] }>,
  hasStaleWH: boolean,
  hasMissingInput: boolean,
): RouteStatus {
  const feasibleCount = rankedRoutes.filter((r) => r.feasible && !r.blocked).length;
  const totalCount = allRoutes.length;

  // ZERO conditions (FR-032)
  if (hasMissingInput || hasStaleWH) return "ZERO";

  // BLOCKED conditions (FR-031)
  if (feasibleCount === 0) return "BLOCKED";

  // AMBER conditions (FR-030)
  const allReasons = constraints.flatMap((c) => c.reason_codes);
  if (allReasons.some((r) => r === "DEM_DET_EXPOSURE_ESTIMATED")) return "AMBER";
  if (allReasons.some((r) => ["WH_SNAPSHOT_STALE", "MANDATORY_DOC_MISSING", "CONNECTION_RISK_HIGH"].includes(r))) return "AMBER";

  // REVIEW conditions (FR-029)
  if (allReasons.length > 0) return "REVIEW";

  return "OK";
}

function optimize(
  shipment: ShipmentRequest,
  routes: RouteOption[],
  evaluations: Array<{
    route_id: string;
    route_code: string;
    cost: { total_cost_aed: number };
    transit: { transit_days: number; eta: string; deadline_slack_days: number };
    constraint: {
      wh_impact_level: string;
      docs_completeness_pct: number;
      reason_codes: string[];
      input_required_codes: string[];
      deadline_ok: boolean;
      wh_ok: boolean;
      docs_ok: boolean;
    };
  }>,
): OptimizeResponse {
  const weights = PRIORITY_WEIGHTS[shipment.priority] ?? PRIORITY_WEIGHTS["NORMAL"];

  // Build evaluation lookup
  const evalMap = new Map<string, typeof evaluations[0]>();
  for (const ev of evaluations) {
    evalMap.set(ev.route_id, ev);
  }

  // Filter feasible routes (FR-037, FR-042 for CRITICAL)
  const feasible = routes
    .map((route) => {
      const ev = evalMap.get(route.id);
      if (!ev) return null;

      return {
        route,
        cost: ev.cost.total_cost_aed,
        transitDays: ev.transit.transit_days,
        deadlineSlack: ev.transit.deadline_slack_days,
        constraint: ev.constraint,
      };
    })
    .filter((item): item is NonNullable<typeof item> => {
      if (!item) return false;
      if (item.route.blocked || !item.route.feasible) return false;

      // CRITICAL exclusion (FR-042)
      if (shipment.priority === "CRITICAL") {
        if (item.deadlineSlack < 0) return false;
        const etaDate = new Date(item.route.legs[0] ? item.constraint.deadline_ok ? item.transitDays : 0 : 0);
        const reqDate = new Date(shipment.required_delivery_date);
        if (etaDate > reqDate) return false;
      }

      if (!item.constraint.wh_ok || !item.constraint.docs_ok) return false;
      return true;
    });

  if (feasible.length === 0) {
    const hasMissingInput = evaluations.some((e) => e.constraint.input_required_codes.length > 0);
    const hasStaleWH = evaluations.some((e) => e.constraint.reason_codes.includes("WH_SNAPSHOT_STALE"));

    return {
      request_id: shipment.request_id,
      status: computeStatus([], routes, evaluations.map((e) => e.constraint), hasStaleWH, hasMissingInput),
      recommended_route_id: null,
      recommended_route_code: null,
      options: [],
      decision_logic: buildDecisionLogic(shipment.priority),
      reason_codes: [],
      assumptions: [],
      input_required_codes: evaluations.flatMap((e) => e.constraint.input_required_codes),
      evidence_ref: [`optimize:${RULE_VERSIONS.route_rules}:${shipment.request_id}`],
      rule_version: RULE_VERSIONS,
      feasible_count: 0,
      total_count: routes.length,
      approval_state: "NOT_REQUESTED",
      execution_eligible: false,
      generated_at: new Date().toISOString(),
    };
  }

  // Normalize metrics
  const costs = feasible.map((f) => f.cost);
  const transits = feasible.map((f) => f.transitDays);
  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs);
  const transitMin = Math.min(...transits);
  const transitMax = Math.max(...transits);

  // Score each route
  const scored = feasible.map(({ route, cost, transitDays, deadlineSlack, constraint }) => {
    const normCost = normalize(cost, costMin, costMax);
    const normTransit = normalize(transitDays, transitMin, transitMax);
    const riskPenalty = RISK_PENALTIES[route.risk_level] ?? 0;
    const whPenalty = WH_PENALTIES[constraint.wh_impact_level] ?? 0;

    const score =
      weights.cost * normCost +
      weights.time * normTransit +
      weights.risk * riskPenalty +
      weights.wh * whPenalty;

    const eta = new Date(
      new Date(shipment.etd_target).getTime() + transitDays * 24 * 60 * 60 * 1000
    );

    return {
      route_option_id: route.id,
      route_code: route.route_code as import("../types").RouteCode,
      rank: null as number | null,
      feasible: true,
      blocked: false,
      eta: eta.toISOString(),
      transit_days: Math.round(transitDays * 100) / 100,
      deadline_slack_days: Math.round(deadlineSlack * 100) / 100,
      total_cost_aed: Math.round(cost * 100) / 100,
      risk_level: route.risk_level,
      risk_penalty: riskPenalty,
      wh_impact_level: constraint.wh_impact_level as import("../types").WHImpactLevel,
      docs_completeness_pct: constraint.docs_completeness_pct,
      reason_codes: route.reason_codes,
      assumption_notes: route.assumption_notes,
      evidence_ref: route.evidence_ref,
      _score: score,
    };
  });

  // Sort by score asc, then tie-breakers
  scored.sort((a, b) => {
    const scoreDiff = a._score - b._score;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    // Tie-breaker: deadline_slack_days desc
    const slackDiff = b.deadline_slack_days - a.deadline_slack_days;
    if (Math.abs(slackDiff) > 0.001) return slackDiff;
    // risk_penalty asc
    const riskDiff = (a.risk_penalty ?? 0) - (b.risk_penalty ?? 0);
    if (Math.abs(riskDiff) > 0.001) return riskDiff;
    // total_cost_aed asc
    const costDiff = (a.total_cost_aed ?? 0) - (b.total_cost_aed ?? 0);
    if (Math.abs(costDiff) > 0.01) return costDiff;
    // transit_days asc
    const transitDiff = (a.transit_days ?? 0) - (b.transit_days ?? 0);
    if (Math.abs(transitDiff) > 0.01) return transitDiff;
    // route_code asc
    return a.route_code.localeCompare(b.route_code);
  });

  // Assign ranks
  scored.forEach((r, i) => { r.rank = i + 1; });

  const feasibleCount = scored.filter((r) => r.feasible && !r.blocked).length;
  const recommended = scored[0];

  // Build response options (without internal _score)
  const options: RankedRouteOption[] = scored.map(({ _score, ...rest }) => rest);

  // Collect reason codes and assumptions
  const reasonCodes = [...new Set(scored.flatMap((r) => r.reason_codes))];
  const assumptions = [...new Set(scored.flatMap((r) => r.assumption_notes))];

  // Determine status
  const hasMissingInput = evaluations.some((e) => e.constraint.input_required_codes.length > 0);
  const hasStaleWH = evaluations.some((e) => e.constraint.reason_codes.includes("WH_SNAPSHOT_STALE"));
  const status = computeStatus(options, routes, evaluations.map((e) => e.constraint), hasStaleWH, hasMissingInput);

  // Collect evidence_ref
  const evidenceRef = [
    `optimize:${RULE_VERSIONS.route_rules}:${shipment.request_id}`,
    ...scored.flatMap((r) => r.evidence_ref),
  ];

  return {
    request_id: shipment.request_id,
    status,
    recommended_route_id: recommended?.route_option_id ?? null,
    recommended_route_code: recommended?.route_code ?? null,
    options,
    decision_logic: buildDecisionLogic(shipment.priority),
    reason_codes: reasonCodes,
    assumptions,
    input_required_codes: evaluations.flatMap((e) => e.constraint.input_required_codes),
    evidence_ref: [...new Set(evidenceRef)],
    rule_version: RULE_VERSIONS,
    feasible_count: feasibleCount,
    total_count: routes.length,
    approval_state: "NOT_REQUESTED",
    execution_eligible: false,
    generated_at: new Date().toISOString(),
  };
}

function buildDecisionLogic(priority: string): DecisionLogic {
  const weights = PRIORITY_WEIGHTS[priority] ?? PRIORITY_WEIGHTS["NORMAL"];
  return {
    priority: priority as import("../types").Priority,
    weights,
    normalization_method: "min_max",
    tie_breaker: TIE_BREAKER,
    penalties_applied: [
      { code: "RISK_LOW", value: 0.00, description: "Low risk - no penalty" },
      { code: "RISK_MEDIUM", value: 0.10, description: "Medium risk" },
      { code: "RISK_HIGH", value: 0.25, description: "High risk" },
      { code: "WH_LOW", value: 0.00, description: "Low WH impact - no penalty" },
      { code: "WH_MEDIUM", value: 0.10, description: "Medium WH impact" },
      { code: "WH_HIGH", value: 0.20, description: "High WH impact" },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      shipment: ShipmentRequest;
      routes: RouteOption[];
      evaluations: Array<{
        route_id: string;
        route_code: string;
        cost: { total_cost_aed: number };
        transit: { transit_days: number; eta: string; deadline_slack_days: number };
        constraint: {
          wh_impact_level: string;
          docs_completeness_pct: number;
          reason_codes: string[];
          input_required_codes: string[];
          deadline_ok: boolean;
          wh_ok: boolean;
          docs_ok: boolean;
        };
      }>;
    };

    if (!body.shipment?.request_id || !body.routes || !body.evaluations) {
      return NextResponse.json(
        { error: "Missing shipment, routes, or evaluations" },
        { status: 400 }
      );
    }

    const result = optimize(body.shipment, body.routes, body.evaluations);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[/api/route/optimize]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
