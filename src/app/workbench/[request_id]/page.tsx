'use client';

/**
 * Workbench Page Component
 * Multi-Route Optimization MVP v1.0.0
 *
 * Route: /workbench/[request_id]
 * Purpose: Main workbench page assembling all components
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { WorkbenchHeader } from '../components/WorkbenchHeader';
import { DecisionBar } from '../components/DecisionBar';
import { ContextRail } from '../components/ContextRail';
import { CompareCanvas } from '../components/CompareCanvas';
import { DecisionRail } from '../components/DecisionRail';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { ApprovalModal } from '../components/ApprovalModal';
import { useWorkbenchState } from '../hooks/useWorkbenchState';
import type { OptimizeResponse, ShipmentSummary, MissingInput, HardConstraint, RouteStatus } from '../types';

export default function WorkbenchPage() {
  const params = useParams();
  const requestId = params.request_id as string;

  const {
    viewMode,
    setViewMode,
    scenarioMode,
    setScenarioMode,
    selectedRouteId,
    selectRoute,
    isDrawerOpen,
    activeDrawerTab,
    openDrawer,
    closeDrawer,
    setDrawerTab,
    isApprovalModalOpen,
    openApprovalModal,
    closeApprovalModal,
    filters,
    toggleFilter,
    optimizationResult,
    setOptimizationResult,
    filteredOptions,
    selectedRoute,
    canApprove,
    requiresAcknowledgement,
    sortBy,
    setSortBy,
    handleApprove,
    handleHold,
    handleReevaluate,
  } = useWorkbenchState();

  // Mock data for demonstration - in production this would come from API
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading optimization result
    const loadData = async () => {
      try {
        const response = await fetch(`/api/route/dashboard/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          setOptimizationResult(data);
        } else {
          // Use mock data for demo
          setOptimizationResult(getMockOptimizeResponse(requestId));
        }
      } catch {
        // Use mock data for demo
        setOptimizationResult(getMockOptimizeResponse(requestId));
      }
      setIsLoading(false);
    };

    loadData();
  }, [requestId, setOptimizationResult]);

  // Mock handlers for demo
  const handleViewLogs = () => {
    console.log('View logs clicked');
  };

  const handleOpenRequest = () => {
    console.log('Open request clicked');
  };

  const handleEditRequest = () => {
    console.log('Edit request clicked');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading workbench...</p>
        </div>
      </div>
    );
  }

  if (!optimizationResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-gray-500">No optimization result found.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Build context rail data from optimization result
  const shipment: ShipmentSummary = {
    pol_code: 'SIN',
    pod_code: 'DXB',
    cargo_type: 'GENERAL',
    container_type: '20GP',
    quantity: 1,
    dims_cm: { length: 100, width: 100, height: 100 },
    gross_weight_kg: 5000,
    etd_target: optimizationResult.generated_at,
    required_delivery_date: '2026-04-25',
    incoterm: 'CIF',
    destination_site: 'DXB-WH',
  };

  const missingInputs: MissingInput[] = optimizationResult.input_required_codes.map((code) => ({
    type: code,
    description: '',
    severity: 'high',
  }));

  const hardConstraints: HardConstraint[] = optimizationResult.reason_codes
    .filter((code) => ['DEADLINE_MISS', 'WH_CAPACITY_BLOCKED', 'LANE_UNSUPPORTED'].includes(code))
    .map((code) => ({
      code,
      description: '',
      blocked: true,
    }));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <WorkbenchHeader
        requestId={requestId}
        polCode={shipment.pol_code}
        podCode={shipment.pod_code}
        priority="NORMAL"
        ruleVersion={optimizationResult.rule_version.route_rules}
        onReevaluate={handleReevaluate}
        onOpenRequest={handleOpenRequest}
        onViewLogs={handleViewLogs}
      />

      {/* Decision Bar */}
      <DecisionBar
        status={optimizationResult.status}
        recommendedRouteCode={optimizationResult.recommended_route_code}
        feasibleCount={optimizationResult.feasible_count}
        totalCount={optimizationResult.total_count}
        reasonCount={optimizationResult.reason_codes.length}
        assumptionCount={optimizationResult.assumptions.length}
        evidenceCount={optimizationResult.evidence_ref.length}
        lastEvaluatedAt={optimizationResult.generated_at}
        incompleteInputCount={optimizationResult.input_required_codes.length}
        shortReason={optimizationResult.reason_codes[0]}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Context Rail */}
        <ContextRail
          shipment={shipment}
          missingInputs={missingInputs}
          hardConstraints={hardConstraints}
          filters={filters}
          onFilterChange={toggleFilter}
          onEditRequest={handleEditRequest}
        />

        {/* Compare Canvas */}
        <CompareCanvas
          viewMode={viewMode}
          scenarioMode={scenarioMode}
          routes={filteredOptions}
          selectedRouteId={selectedRouteId}
          recommendedRouteId={optimizationResult.recommended_route_id}
          filters={filters}
          sortBy={sortBy}
          onViewModeChange={setViewMode}
          onScenarioModeChange={setScenarioMode}
          onSortChange={setSortBy}
          onFilterChange={toggleFilter}
          onSelectRoute={selectRoute}
          onViewDetails={openDrawer}
        />

        {/* Decision Rail */}
        <DecisionRail
          optimizeResult={optimizationResult}
          selectedRoute={selectedRoute}
          canApprove={canApprove}
          requiresAcknowledgement={requiresAcknowledgement}
          onApprove={openApprovalModal}
          onHold={openApprovalModal}
          onReevaluate={handleReevaluate}
        />
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        route={selectedRoute}
        optimizeResult={optimizationResult}
        activeTab={activeDrawerTab}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onTabChange={setDrawerTab}
      />

      {/* Approval Modal */}
      <ApprovalModal
        optimizeResult={optimizationResult}
        status={optimizationResult.status}
        requiresAcknowledgement={requiresAcknowledgement}
        isOpen={isApprovalModalOpen}
        onClose={closeApprovalModal}
        onApprove={handleApprove}
        onHold={handleHold}
      />
    </div>
  );
}

// Mock data for demonstration
function getMockOptimizeResponse(requestId: string): OptimizeResponse {
  return {
    request_id: requestId,
    status: 'OK' as RouteStatus,
    recommended_route_id: 'route-1',
    recommended_route_code: 'SEA_DIRECT',
    options: [
      {
        route_option_id: 'route-1',
        route_code: 'SEA_DIRECT',
        rank: 1,
        feasible: true,
        blocked: false,
        eta: '2026-04-20',
        transit_days: 12.0,
        deadline_slack_days: 5.0,
        total_cost_aed: 4250.00,
        risk_level: 'LOW',
        risk_penalty: 0.0,
        wh_impact_level: 'LOW',
        docs_completeness_pct: 85,
        reason_codes: [],
        assumption_notes: [],
        evidence_ref: ['evidence-1', 'evidence-2'],
      },
      {
        route_option_id: 'route-2',
        route_code: 'SEA_TRANSSHIP',
        rank: 2,
        feasible: true,
        blocked: false,
        eta: '2026-04-22',
        transit_days: 14.0,
        deadline_slack_days: 3.0,
        total_cost_aed: 3950.00,
        risk_level: 'MEDIUM',
        risk_penalty: 0.1,
        wh_impact_level: 'MEDIUM',
        docs_completeness_pct: 70,
        reason_codes: ['CONNECTION_RISK_HIGH'],
        assumption_notes: ['WH snapshot 48h stale'],
        evidence_ref: ['evidence-3'],
      },
      {
        route_option_id: 'route-3',
        route_code: 'SEA_LAND',
        rank: 3,
        feasible: false,
        blocked: true,
        eta: null,
        transit_days: null,
        deadline_slack_days: null,
        total_cost_aed: null,
        risk_level: 'HIGH',
        risk_penalty: 0.25,
        wh_impact_level: 'HIGH',
        docs_completeness_pct: 50,
        reason_codes: ['MANDATORY_DOC_MISSING', 'WH_CAPACITY_BLOCKED'],
        assumption_notes: [],
        evidence_ref: [],
      },
    ],
    decision_logic: {
      priority: 'NORMAL',
      weights: { cost: 0.5, time: 0.25, risk: 0.15, wh: 0.1 },
      normalization_method: 'min_max',
      tie_breaker: ['deadline_slack_days', 'risk_penalty', 'total_cost_aed', 'transit_days', 'route_code'],
      penalties_applied: [],
    },
    reason_codes: ['DEM_DET_EXPOSURE_ESTIMATED'],
    assumptions: ['WH snapshot 48h stale — verify before execution'],
    input_required_codes: [],
    evidence_ref: ['rule-v2026.04', 'rate-table-snapshot'],
    rule_version: {
      route_rules: 'v2026.04',
      cost_rules: 'v2026.04',
      transit_rules: 'v2026.04',
      doc_rules: 'v2026.04',
      risk_rules: 'v2026.04',
    },
    feasible_count: 2,
    total_count: 3,
    approval_state: 'NOT_REQUESTED',
    execution_eligible: false,
    generated_at: new Date().toISOString(),
  };
}