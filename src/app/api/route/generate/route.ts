/**
 * POST /api/route/generate
 *
 * Generate feasible route candidates for a shipment request.
 * Returns route options without final recommendation (FR-046).
 */
import { NextRequest, NextResponse } from "next/server";
import type { ShipmentRequest, GenerateResponse } from "../types";

// NOTE: In production, this would import from the Python route engine
// via an API call to a FastAPI/Faust service, or via subprocess.
// For MVP, we implement a simplified generation inline.
//
// Production architecture:
//   Next.js API Route → Python Route Engine (via HTTP/IPC)
//   Route: /api/route/generate
//   Python: src/backend/route_engine/route_generator.py::generate_routes

const ROUTE_RULES_VERSION = "v2026.04";

/**
 * Simplified route generator (mirrors Python route_generator.py).
 * In production, this would call the Python engine.
 */
function generate_routes(req: ShipmentRequest) {
  const routes: import("../types").RouteOption[] = [];

  // Hub nodes for transshipment
  const hubNodes: Record<string, string> = {
    DXB: "Jebel Ali",
    DUB: "Jebel Ali",
    AUH: "Khalifa",
  };

  const hub = hubNodes[req.pol_code] || "Jebel Ali";

  // SEA_DIRECT
  if (req.cargo_type === "OOG" || req.cargo_type === "HEAVY_LIFT") {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_DIRECT",
      mode_mix: ["SEA"],
      legs: [],
      feasible: false,
      blocked: true,
      risk_level: "BLOCKED",
      reason_codes: ["HUB_RESTRICTED_FOR_OOG"],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_DIRECT:oog_restricted`],
    });
  } else if (req.gross_weight_kg > 30000) {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_DIRECT",
      mode_mix: ["SEA"],
      legs: [],
      feasible: false,
      blocked: true,
      risk_level: "BLOCKED",
      reason_codes: ["WEIGHT_LIMIT_EXCEEDED"],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_DIRECT:weight_exceeded`],
    });
  } else {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_DIRECT",
      mode_mix: ["SEA"],
      legs: [
        {
          seq: 1,
          mode: "SEA",
          origin_node: req.pol_code,
          destination_node: req.pod_code,
          carrier_code: "MAERSK",
          service_code: "SEALAND_DIRECT",
          base_days: 12.0,
        },
      ],
      feasible: true,
      blocked: false,
      risk_level: "LOW",
      reason_codes: [],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_DIRECT:${req.pol_code}:${req.pod_code}`],
    });
  }

  // SEA_TRANSSHIP
  if (req.gross_weight_kg > 25000) {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_TRANSSHIP",
      mode_mix: ["SEA", "SEA"],
      legs: [],
      feasible: false,
      blocked: true,
      risk_level: "BLOCKED",
      reason_codes: ["WEIGHT_LIMIT_EXCEEDED"],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_TRANSSHIP:weight_exceeded`],
    });
  } else {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_TRANSSHIP",
      mode_mix: ["SEA", "SEA"],
      legs: [
        {
          seq: 1,
          mode: "SEA",
          origin_node: req.pol_code,
          destination_node: hub,
          carrier_code: "MAERSK",
          service_code: "FEEDER_EAST",
          base_days: 5.0,
        },
        {
          seq: 2,
          mode: "SEA",
          origin_node: hub,
          destination_node: req.pod_code,
          carrier_code: "MSC",
          service_code: "MAIN_LINE",
          base_days: 8.0,
        },
      ],
      feasible: true,
      blocked: false,
      risk_level: "MEDIUM",
      reason_codes: [],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_TRANSSHIP:${req.pol_code}:DXB:${req.pod_code}`],
    });
  }

  // SEA_LAND
  if (req.gross_weight_kg > 25000) {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_LAND",
      mode_mix: ["SEA", "LAND"],
      legs: [],
      feasible: false,
      blocked: true,
      risk_level: "BLOCKED",
      reason_codes: ["WEIGHT_LIMIT_EXCEEDED"],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_LAND:weight_exceeded`],
    });
  } else {
    routes.push({
      id: crypto.randomUUID(),
      route_code: "SEA_LAND",
      mode_mix: ["SEA", "LAND"],
      legs: [
        {
          seq: 1,
          mode: "SEA",
          origin_node: req.pol_code,
          destination_node: hub,
          carrier_code: "MAERSK",
          service_code: "FEEDER_GULF",
          base_days: 5.0,
        },
        {
          seq: 2,
          mode: "LAND",
          origin_node: hub,
          destination_node: req.destination_site,
          carrier_code: "LOCAL_TRUCK",
          service_code: "INLAND_DELIVERY",
          base_days: 3.0,
        },
      ],
      feasible: true,
      blocked: false,
      risk_level: "MEDIUM",
      reason_codes: [],
      assumption_notes: [],
      evidence_ref: [`route_gen:${ROUTE_RULES_VERSION}:SEA_LAND:${req.pol_code}:DXB:${req.destination_site}`],
    });
  }

  return routes;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ShipmentRequest;

    // Validate required fields (FR-001 to FR-009)
    if (!body.request_id || !body.pol_code || !body.pod_code) {
      return NextResponse.json(
        { error: "Missing required fields: request_id, pol_code, pod_code" },
        { status: 400 }
      );
    }

    if (body.pol_code === body.pod_code) {
      return NextResponse.json(
        { error: "pol_code and pod_code must be different", code: "LANE_UNSUPPORTED" },
        { status: 400 }
      );
    }

    if (!body.dims_cm || body.gross_weight_kg <= 0 || body.quantity <= 0) {
      return NextResponse.json(
        { error: "Invalid dimensions or weight/quantity", code: "ZERO" },
        { status: 400 }
      );
    }

    // Generate routes
    const routes = generate_routes(body);

    const response: GenerateResponse = {
      request_id: body.request_id,
      routes,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[/api/route/generate]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
