/**
 * POST /api/route/evaluate
 *
 * Evaluate generated routes: cost, transit, risk, and feasibility.
 * Returns cost breakdown, transit estimate, and constraint evaluation (FR-047).
 */
import { NextRequest, NextResponse } from "next/server";
import type {
  ShipmentRequest,
  RouteOption,
  EvaluateResponse,
  CostBreakdown,
  TransitEstimate,
  ConstraintEvaluation,
} from "../types";

// In production, these would call the Python engine modules:
// - cost_calculator.py::calculate_route_cost
// - transit_estimator.py::estimate_transit
// - constraint_evaluator.py::evaluate_constraints

const RULE_VERSIONS = {
  route_rules: "v2026.04",
  cost_rules: "v2026.04",
  transit_rules: "v2026.04",
  doc_rules: "v2026.04",
  risk_rules: "v2026.04",
};

const BUFFER_CUSTOMs = 2.0;
const BUFFER_TRANSSHIP = 4.0;
const BUFFER_INLAND = 3.0;

// ─── Cost Calculator (mirrors Python cost_calculator.py) ─────────────────────

const BASE_FREIGHT_RATES: Record<string, Record<string, number>> = {
  SEA_DIRECT: { "20GP": 2800, "40GP": 5200, "40HC": 5600, LCL: 180 },
  SEA_TRANSSHIP: { "20GP": 2400, "40GP": 4500, "40HC": 4900, LCL: 150 },
  SEA_LAND: { "20GP": 2600, "40GP": 4800, "40HC": 5200, LCL: 160 },
};

const ORIGIN_CHARGES: Record<string, number> = {
  AE: 320, SA: 380, QA: 350, BH: 340, OM: 360, DEFAULT: 400,
};

const DEST_CHARGES: Record<string, number> = {
  AE: 280, SA: 320, QA: 300, BH: 290, OM: 310, DEFAULT: 350,
};

const SURCHARGE_TOTAL = 400; // BAF + CAF + PSS + WRS per container

function calculateRouteCost(route: RouteOption, shipment: ShipmentRequest, transitDays: number): CostBreakdown {
  const ct = shipment.container_type.toUpperCase();
  const rateTable = BASE_FREIGHT_RATES[route.route_code] || BASE_FREIGHT_RATES["SEA_DIRECT"];
  let baseFreight = rateTable[ct] ?? rateTable["20GP"] ?? 2500;
  baseFreight *= Math.max(1, shipment.quantity);

  const originRegion = shipment.pol_code.slice(0, 2).toUpperCase();
  const originCharges = (ORIGIN_CHARGES[originRegion] ?? ORIGIN_CHARGES["DEFAULT"]) * Math.max(1, shipment.quantity);

  const destRegion = shipment.pod_code.slice(0, 2).toUpperCase();
  const destCharges = (DEST_CHARGES[destRegion] ?? DEST_CHARGES["DEFAULT"]) * Math.max(1, shipment.quantity);

  const surcharge = SURCHARGE_TOTAL * Math.max(1, shipment.quantity);

  // DEM/DET
  const freeDays = 5;
  let demDet = 0;
  let demDetEstimated = false;
  if (transitDays > freeDays) {
    const excessDays = transitDays - freeDays;
    const dailyRate = ct.includes("40") ? 150 : 85;
    demDet = excessDays * dailyRate * Math.max(1, shipment.quantity);
    demDetEstimated = true;
  }

  // Inland (SEA_LAND only)
  let inland = 0;
  if (route.route_code === "SEA_LAND") {
    inland = Math.max(180, (shipment.gross_weight_kg / 100) * 1.2 * Math.max(1, shipment.quantity));
  }

  // Handling
  const handling = (ct.includes("40") ? 380 : 220) * Math.max(1, shipment.quantity) + 95 * Math.max(1, shipment.quantity);

  // Special equipment
  let special = 0;
  if (shipment.cargo_type === "OOG") special = 450 * Math.max(1, shipment.quantity);
  if (shipment.cargo_type === "HEAVY_LIFT") special = 680 * Math.max(1, shipment.quantity);

  // Buffer 5%
  const subtotal = baseFreight + originCharges + destCharges + surcharge + demDet + inland + handling + special;
  const bufferCost = Math.round(subtotal * 0.05 * 100) / 100;
  const total = Math.round((subtotal + bufferCost) * 100) / 100;

  return {
    base_freight_aed: Math.round(baseFreight * 100) / 100,
    origin_charges_aed: Math.round(originCharges * 100) / 100,
    destination_charges_aed: Math.round(destCharges * 100) / 100,
    surcharge_aed: Math.round(surcharge * 100) / 100,
    dem_det_estimated_aed: Math.round(demDet * 100) / 100,
    inland_aed: Math.round(inland * 100) / 100,
    handling_aed: Math.round(handling * 100) / 100,
    special_equipment_aed: Math.round(special * 100) / 100,
    buffer_cost_aed: bufferCost,
    total_cost_aed: total,
  };
}

// ─── Transit Estimator (mirrors Python transit_estimator.py) ─────────────────

function estimateTransit(route: RouteOption, etdTarget: Date): { transitDays: number; eta: Date } {
  const totalBaseDays = route.legs.reduce((sum, leg) => sum + leg.base_days, 0);

  let transshipBuffer = 0;
  let inlandBuffer = 0;

  if (route.route_code === "SEA_TRANSSHIP") transshipBuffer = BUFFER_TRANSSHIP;
  if (route.route_code === "SEA_LAND") inlandBuffer = BUFFER_INLAND;

  const transitDays = totalBaseDays + transshipBuffer + BUFFER_CUSTOMs + inlandBuffer;
  const etaMs = etdTarget.getTime() + transitDays * 24 * 60 * 60 * 1000;

  return { transitDays, eta: new Date(etaMs) };
}

// ─── Constraint Evaluator (mirrors Python constraint_evaluator.py) ───────────

const REQUIRED_DOCS: Record<string, string[]> = {
  SEA_DIRECT: ["CI", "PL", "BL", "COO"],
  SEA_TRANSSHIP: ["CI", "PL", "BL", "COO", "HUB_DOC"],
  SEA_LAND: ["CI", "PL", "BL", "COO", "INLAND_DO"],
};

function evaluateConstraints(
  route: RouteOption,
  shipment: ShipmentRequest,
  eta: Date,
  deadlineSlackDays: number,
  whSnapshotAgeHours: number | null,
): ConstraintEvaluation {
  const result: ConstraintEvaluation = {
    deadline_ok: true,
    wh_ok: true,
    docs_ok: true,
    customs_ok: true,
    connection_ok: true,
    wh_impact_level: "LOW",
    docs_completeness_pct: 100.0,
    reason_codes: [],
    input_required_codes: [],
  };

  // Deadline
  if (deadlineSlackDays < 0) {
    result.deadline_ok = false;
    result.reason_codes.push("DEADLINE_MISS");
  }

  // WH Capacity
  if (whSnapshotAgeHours === null) {
    result.wh_ok = false;
    result.wh_impact_level = "BLOCKED";
    result.reason_codes.push("WH_CAPACITY_BLOCKED");
  } else if (whSnapshotAgeHours > 72) {
    result.wh_ok = false;
    result.wh_impact_level = "BLOCKED";
    result.reason_codes.push("WH_SNAPSHOT_STALE");
  } else if (whSnapshotAgeHours > 24) {
    result.wh_impact_level = "MEDIUM";
  }

  // Docs
  const required = REQUIRED_DOCS[route.route_code] ?? [];
  const available = new Set(shipment.docs_available ?? []);
  const provided = required.filter((d) => available.has(d));
  const completeness = required.length > 0 ? (provided.length / required.length) * 100 : 100;

  if (provided.length < required.length) {
    result.docs_ok = false;
    result.docs_completeness_pct = Math.round(completeness * 100) / 100;
    result.reason_codes.push("MANDATORY_DOC_MISSING");
  } else {
    result.docs_completeness_pct = 100.0;
  }

  // Customs / HS
  if (!shipment.hs_code || !/^\d{6,12}$/.test(shipment.hs_code)) {
    result.customs_ok = false;
    result.reason_codes.push("HS_CODE_MISSING");
    result.input_required_codes.push("HS_CODE_MISSING");
  }

  if (shipment.cargo_type !== "GENERAL" && !shipment.cog_cm) {
    result.reason_codes.push("COG_DATA_REQUIRED");
    result.input_required_codes.push("COG_DATA_REQUIRED");
  }

  return result;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      shipment: ShipmentRequest;
      routes: RouteOption[];
      wh_snapshot_age_hours?: number | null;
    };

    if (!body.shipment?.request_id || !body.routes) {
      return NextResponse.json(
        { error: "Missing shipment or routes" },
        { status: 400 }
      );
    }

    const etdTarget = new Date(body.shipment.etd_target);
    const requiredDelivery = new Date(body.shipment.required_delivery_date);

    const evaluations = body.routes.map((route) => {
      const { transitDays, eta } = estimateTransit(route, etdTarget);

      // Compute deadline slack
      const slackMs = requiredDelivery.getTime() - eta.getTime();
      const deadlineSlackDays = Math.round((slackMs / (24 * 60 * 60 * 1000)) * 100) / 100;

      const cost = calculateRouteCost(route, body.shipment, transitDays);

      const transit: TransitEstimate = {
        etd_target: body.shipment.etd_target,
        transit_days: Math.round(transitDays * 100) / 100,
        eta: eta.toISOString(),
        deadline_slack_days: deadlineSlackDays,
        buffers_jsonb: {
          customs_days: BUFFER_CUSTOMs,
          transship_days: route.route_code === "SEA_TRANSSHIP" ? BUFFER_TRANSSHIP : 0,
          inland_days: route.route_code === "SEA_LAND" ? BUFFER_INLAND : 0,
          base_days: route.legs.reduce((s, l) => s + l.base_days, 0),
          total_transit_days: transitDays,
        },
      };

      const constraint = evaluateConstraints(
        route,
        body.shipment,
        eta,
        deadlineSlackDays,
        body.wh_snapshot_age_hours ?? null,
      );

      return {
        route_id: route.id,
        route_code: route.route_code,
        cost,
        transit,
        constraint,
      };
    });

    const response: EvaluateResponse = {
      request_id: body.shipment.request_id,
      evaluations,
      evaluated_at: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[/api/route/evaluate]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
