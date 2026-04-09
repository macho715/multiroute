-- Multi-Route Optimization MVP v1.0.0
-- PostgreSQL Schema with jsonb + constraints

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE route_code AS ENUM ('SEA_DIRECT', 'SEA_TRANSSHIP', 'SEA_LAND');
CREATE TYPE route_status AS ENUM ('OK', 'REVIEW', 'AMBER', 'BLOCKED', 'ZERO');
CREATE TYPE approval_state AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'HELD');
CREATE TYPE priority AS ENUM ('NORMAL', 'URGENT', 'CRITICAL');
CREATE TYPE cargo_type AS ENUM ('GENERAL', 'OOG', 'HEAVY_LIFT');
CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');
CREATE TYPE wh_impact_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');
CREATE TYPE decision_event_type AS ENUM ('GENERATED', 'EVALUATED', 'OPTIMIZED', 'APPROVED', 'HELD', 'OVERRIDDEN', 'RE_EVALUATED');
CREATE TYPE leg_mode AS ENUM ('SEA', 'INLAND', 'AIR');
CREATE TYPE override_type AS ENUM ('ROUTE_CHANGE', 'STATUS_OVERRIDE', 'FORCE_APPROVE', 'REMOVE_HOLD');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Shipment Request
CREATE TABLE shipment_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(64) NOT NULL UNIQUE,
    pol_code VARCHAR(10) NOT NULL,
    pod_code VARCHAR(10) NOT NULL,
    cargo_type cargo_type NOT NULL,
    container_type VARCHAR(32) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    dims_cm JSONB NOT NULL,
    gross_weight_kg DECIMAL(10,2) NOT NULL CHECK (gross_weight_kg > 0),
    cog_cm JSONB,
    etd_target TIMESTAMPTZ NOT NULL,
    required_delivery_date DATE NOT NULL,
    incoterm VARCHAR(8) NOT NULL,
    priority priority NOT NULL,
    hs_code VARCHAR(12) NOT NULL,
    destination_site VARCHAR(128) NOT NULL,
    docs_available JSONB,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipment_request_request_id ON shipment_request(request_id);

-- Rule Set Version
CREATE TABLE rule_set_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_rules_version VARCHAR(32) NOT NULL,
    cost_rules_version VARCHAR(32) NOT NULL,
    transit_rules_version VARCHAR(32) NOT NULL,
    doc_rules_version VARCHAR(32) NOT NULL,
    risk_rules_version VARCHAR(32) NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rule_set_version_active ON rule_set_version(is_active, effective_at);

-- Route Option
CREATE TABLE route_option (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_code route_code NOT NULL,
    mode_mix VARCHAR(32) NOT NULL,
    feasible BOOLEAN NOT NULL DEFAULT FALSE,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    risk_level risk_level NOT NULL DEFAULT 'MEDIUM',
    reason_codes_jsonb JSONB NOT NULL DEFAULT '[]',
    assumption_notes_jsonb JSONB NOT NULL DEFAULT '[]',
    evidence_ref_jsonb JSONB NOT NULL DEFAULT '[]',
    rule_set_version_id UUID REFERENCES rule_set_version(id),
    shipment_request_id UUID NOT NULL REFERENCES shipment_request(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_route_option_request ON route_option(shipment_request_id);
CREATE INDEX idx_route_option_code ON route_option(route_code);

-- Route Leg
CREATE TABLE route_leg (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_option_id UUID NOT NULL REFERENCES route_option(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL CHECK (seq >= 1 AND seq <= 4),
    mode leg_mode NOT NULL,
    origin_node VARCHAR(64) NOT NULL,
    destination_node VARCHAR(64) NOT NULL,
    carrier_code VARCHAR(16),
    service_code VARCHAR(32),
    base_days DECIMAL(5,2) NOT NULL CHECK (base_days >= 0),
    restrictions_jsonb JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(route_option_id, seq)
);

CREATE INDEX idx_route_leg_option ON route_leg(route_option_id);

-- Cost Breakdown
CREATE TABLE cost_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_option_id UUID NOT NULL UNIQUE REFERENCES route_option(id) ON DELETE CASCADE,
    base_freight_aed DECIMAL(12,2) NOT NULL CHECK (base_freight_aed >= 0),
    origin_charges_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (origin_charges_aed >= 0),
    destination_charges_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (destination_charges_aed >= 0),
    surcharge_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (surcharge_aed >= 0),
    dem_det_estimated_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (dem_det_estimated_aed >= 0),
    inland_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (inland_aed >= 0),
    handling_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (handling_aed >= 0),
    special_equipment_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (special_equipment_aed >= 0),
    buffer_cost_aed DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (buffer_cost_aed >= 0),
    total_cost_aed DECIMAL(12,2) NOT NULL CHECK (total_cost_aed >= 0),
    components_jsonb JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transit Estimate
CREATE TABLE transit_estimate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_option_id UUID NOT NULL UNIQUE REFERENCES route_option(id) ON DELETE CASCADE,
    etd_target TIMESTAMPTZ NOT NULL,
    transit_days DECIMAL(5,2) NOT NULL CHECK (transit_days >= 0),
    eta TIMESTAMPTZ NOT NULL,
    deadline_slack_days DECIMAL(6,2) NOT NULL,
    buffers_jsonb JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint Evaluation
CREATE TABLE constraint_evaluation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_option_id UUID NOT NULL UNIQUE REFERENCES route_option(id) ON DELETE CASCADE,
    deadline_ok BOOLEAN NOT NULL DEFAULT FALSE,
    wh_ok BOOLEAN NOT NULL DEFAULT FALSE,
    docs_ok BOOLEAN NOT NULL DEFAULT FALSE,
    customs_ok BOOLEAN NOT NULL DEFAULT FALSE,
    connection_ok BOOLEAN NOT NULL DEFAULT FALSE,
    wh_impact_level wh_impact_level NOT NULL DEFAULT 'LOW',
    docs_completeness_pct DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (docs_completeness_pct >= 0 AND docs_completeness_pct <= 100),
    reason_codes_jsonb JSONB NOT NULL DEFAULT '[]',
    input_required_codes_jsonb JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Result
CREATE TABLE optimization_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_request_id UUID NOT NULL UNIQUE REFERENCES shipment_request(id) ON DELETE CASCADE,
    status route_status NOT NULL,
    recommended_route_option_id UUID REFERENCES route_option(id),
    decision_logic_jsonb JSONB NOT NULL DEFAULT '{}',
    feasible_count INTEGER NOT NULL DEFAULT 0 CHECK (feasible_count >= 0),
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    reason_codes_jsonb JSONB NOT NULL DEFAULT '[]',
    assumptions_jsonb JSONB NOT NULL DEFAULT '[]',
    input_required_codes_jsonb JSONB NOT NULL DEFAULT '[]',
    evidence_ref_jsonb JSONB NOT NULL DEFAULT '[]',
    approval_state approval_state NOT NULL DEFAULT 'NOT_REQUESTED',
    execution_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    rule_set_version_id UUID REFERENCES rule_set_version(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimization_result_request ON optimization_result(shipment_request_id);
CREATE INDEX idx_optimization_result_status ON optimization_result(status);

-- Decision Log
CREATE TABLE decision_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(64) NOT NULL,
    route_option_id UUID,
    event_type decision_event_type NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    note TEXT,
    payload_jsonb JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decision_log_request ON decision_log(request_id);
CREATE INDEX idx_decision_log_event ON decision_log(event_type);
CREATE INDEX idx_decision_log_created ON decision_log(created_at);

-- Approval Log
CREATE TABLE approval_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(64) NOT NULL,
    route_option_id UUID,
    approval_state approval_state NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    note TEXT,
    acknowledge_assumptions BOOLEAN NOT NULL DEFAULT FALSE,
    hold_reason_code VARCHAR(64),
    hold_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_log_request ON approval_log(request_id);
CREATE INDEX idx_approval_log_created ON approval_log(created_at);

-- Decision Override Log
CREATE TABLE decision_override_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(64) NOT NULL,
    route_option_id UUID REFERENCES route_option(id),
    override_type override_type NOT NULL,
    override_reason_code VARCHAR(64) NOT NULL,
    override_note TEXT,
    actor_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decision_override_log_request ON decision_override_log(request_id);
CREATE INDEX idx_decision_override_log_created ON decision_override_log(created_at);

-- WH Capacity Snapshot
CREATE TABLE wh_capacity_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_code VARCHAR(64) NOT NULL,
    date_bucket DATE NOT NULL,
    inbound_capacity INTEGER NOT NULL CHECK (inbound_capacity >= 0),
    allocated_qty INTEGER NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    remaining_capacity INTEGER NOT NULL CHECK (remaining_capacity >= 0),
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_code, date_bucket)
);

CREATE INDEX idx_wh_capacity_snapshot_site_date ON wh_capacity_snapshot(site_code, date_bucket);
CREATE INDEX idx_wh_capacity_snapshot_snapshot_at ON wh_capacity_snapshot(snapshot_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_shipment_request_updated_at
    BEFORE UPDATE ON shipment_request
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimization_result_updated_at
    BEFORE UPDATE ON optimization_result
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Snapshot freshness check function
CREATE OR REPLACE FUNCTION get_wh_snapshot_freshness(p_site_code VARCHAR, p_date_bucket DATE)
RETURNS JSONB AS $$
DECLARE
    v_snapshot wh_capacity_snapshot%ROWTYPE;
    v_age_hours NUMERIC;
    v_freshness VARCHAR;
BEGIN
    SELECT * INTO v_snapshot
    FROM wh_capacity_snapshot
    WHERE site_code = p_site_code AND date_bucket = p_date_bucket;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'ZERO',
            'reason', 'WH_SNAPSHOT_STALE',
            'message', 'No warehouse capacity snapshot found'
        );
    END IF;

    v_age_hours := EXTRACT(EPOCH FROM (NOW() - v_snapshot.snapshot_at)) / 3600;

    IF v_age_hours <= 24 THEN
        v_freshness := 'OK';
    ELSIF v_age_hours <= 72 THEN
        v_freshness := 'AMBER';
    ELSE
        v_freshness := 'ZERO';
    END IF;

    RETURN jsonb_build_object(
        'status', v_freshness,
        'age_hours', ROUND(v_age_hours, 2),
        'snapshot_at', v_snapshot.snapshot_at
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CONSTRAINTS
-- ============================================================

-- pol_code != pod_code should be enforced at application level
-- but we add a trigger for data integrity
CREATE OR REPLACE FUNCTION check_pol_pod_diff()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pol_code = NEW.pod_code THEN
        RAISE EXCEPTION 'pol_code and pod_code must be different';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_shipment_pol_pod
    BEFORE INSERT OR UPDATE ON shipment_request
    FOR EACH ROW EXECUTE FUNCTION check_pol_pod_diff();

-- Ensure required_delivery_date >= etd_target::date
CREATE OR REPLACE FUNCTION check_delivery_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.required_delivery_date < NEW.etd_target::date THEN
        RAISE EXCEPTION 'required_delivery_date must be >= etd_target date';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_shipment_delivery_date
    BEFORE INSERT OR UPDATE ON shipment_request
    FOR EACH ROW EXECUTE FUNCTION check_delivery_date();

-- Transit days validation
CREATE OR REPLACE FUNCTION check_transit_days()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transit_days < 0 THEN
        RAISE EXCEPTION 'transit_days cannot be negative';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transit_estimate_days
    BEFORE INSERT OR UPDATE ON transit_estimate
    FOR EACH ROW EXECUTE FUNCTION check_transit_days();
