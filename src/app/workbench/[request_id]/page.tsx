'use client';

import React, { useState, useCallback } from 'react';
import { useWorkbenchState } from '../../hooks/useWorkbenchState';
import { WorkbenchHeader } from '../components/WorkbenchHeader';
import { DecisionBar } from '../components/DecisionBar';
import { ContextRail } from '../components/ContextRail';
import { CompareCanvas } from '../components/CompareCanvas';
import { DecisionRail } from '../components/DecisionRail';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { ApprovalModal } from '../components/ApprovalModal';
import type { OptimizeResponse, RouteOptionView, DrawerTab } from '../types';

interface WorkbenchPageProps {
  requestId: string;
  initialData: OptimizeResponse;
}

function mockShipment() {
  return {
    polCode: 'CNSHA',
    podCode: 'AEJEA',
    cargoType: 'GENERAL',
    containerType: '20GP',
    quantity: 2,
    dimsCm: { length: 120, width: 100, height: 80 },
    grossWeightKg: 5000,
    etdTarget: '2026-04-15',
    requiredDeliveryDate: '2026-05-10',
    incoterm: 'CIF',
    destinationSite: 'Jebel Ali WH',
  };
}

function mockMissingInputs() {
  return [
    { code: 'HS_CODE', description: 'HS code not provided' },
    { code: 'WH_SNAPSHOT_STALE', description: 'Snapshot older than 24h' },
  ];
}

function mockHardConstraints() {
  return [
    { code: 'DEADLINE_MISS', description: 'Required delivery before earliest feasible ETA' },
  ];
}

export default function WorkbenchPage({ requestId, initialData }: WorkbenchPageProps) {
  const [optimizeResult] = useState<OptimizeResponse>(initialData);
  const {
    state,
    setViewMode,
    setScenarioMode,
    selectRoute,
    closeDrawer,
    setDrawerTab,
    openApprovalModal,
    closeApprovalModal,
    openHoldModal,
    closeHoldModal,
    setFilter,
    resetFilters,
  } = useWorkbenchState();

  const selectedRoute = state.selectedRouteId
    ? optimizeResult.options.find((o) => o.route_option_id === state.selectedRouteId) ?? null
    : null;

  const handleReevaluate = useCallback(() => {
    window.location.reload();
  }, []);

  const handleOpenRequest = useCallback(() => {
    window.open(`/requests/${requestId}`, '_blank');
  }, [requestId]);

  const handleViewLogs = useCallback(() => {
    window.open(`/logs?request_id=${requestId}`, '_blank');
  }, [requestId]);

  const handleViewDetails = useCallback(
    (routeId: string) => {
      selectRoute(routeId);
      setDrawerTab('overview');
    },
    [selectRoute, setDrawerTab]
  );

  const handleApprove = useCallback(() => {
    openApprovalModal();
  }, [openApprovalModal]);

  const handleHold = useCallback(() => {
    openHoldModal();
  }, [openHoldModal]);

  const handleApprovalConfirm = useCallback(
    (acknowledgeAssumptions: boolean) => {
      closeApprovalModal();
      console.info('Approval confirmed', {
        requestId,
        routeId: optimizeResult.recommended_route_id,
        acknowledgeAssumptions,
      });
    },
    [closeApprovalModal, requestId, optimizeResult.recommended_route_id]
  );

  const handleSortChange = useCallback((_sort: 'rank' | 'cost' | 'transit' | 'risk') => {
    // Sort change handled in CompareCanvas internally
  }, []);

  const ruleVersion = [
    optimizeResult.rule_version.route_rules,
    optimizeResult.rule_version.cost_rules,
    optimizeResult.rule_version.transit_rules,
    optimizeResult.rule_version.doc_rules,
    optimizeResult.rule_version.risk_rules,
  ].join(' / ');

  return (
    <div className="flex flex-col h-screen bg-white">
      <WorkbenchHeader
        requestId={requestId}
        polCode={mockShipment().polCode}
        podCode={mockShipment().podCode}
        priority={optimizeResult.decision_logic.priority}
        ruleVersion={ruleVersion}
        onReevaluate={handleReevaluate}
        onOpenRequest={handleOpenRequest}
        onViewLogs={handleViewLogs}
      />

      <DecisionBar
        status={optimizeResult.status}
        recommendedRouteCode={optimizeResult.recommended_route_code}
        feasibleCount={optimizeResult.feasible_count}
        totalCount={optimizeResult.total_count}
        reasonCount={optimizeResult.reason_codes.length}
        assumptionCount={optimizeResult.assumptions.length}
        evidenceCount={optimizeResult.evidence_ref.length}
        lastEvaluatedAt={optimizeResult.last_evaluated_at ?? null}
        incompleteInputCount={optimizeResult.incomplete_input_count ?? 0}
      />

      <div className="flex-1 flex overflow-hidden">
        <ContextRail
          shipment={mockShipment()}
          missingInputs={mockMissingInputs()}
          hardConstraints={mockHardConstraints()}
          feasibleOnly={state.filters.feasibleOnly}
          docsReadyOnly={state.filters.docsReadyOnly}
          whSafeOnly={state.filters.whSafeOnly}
          lowRiskOnly={state.filters.lowRiskOnly}
          onFilterChange={setFilter}
          onEditRequest={handleOpenRequest}
        />

        <CompareCanvas
          viewMode={state.viewMode}
          scenarioMode={state.scenarioMode}
          routes={optimizeResult.options}
          selectedRouteId={state.selectedRouteId}
          recommendedRouteId={optimizeResult.recommended_route_id}
          feasibleOnly={state.filters.feasibleOnly}
          docsReadyOnly={state.filters.docsReadyOnly}
          whSafeOnly={state.filters.whSafeOnly}
          lowRiskOnly={state.filters.lowRiskOnly}
          sortBy="rank"
          onSortChange={handleSortChange}
          onSelectRoute={selectRoute}
          onViewDetails={handleViewDetails}
        />

        <DecisionRail
          optimizeResult={optimizeResult}
          selectedRoute={selectedRoute}
          onApprove={handleApprove}
          onHold={handleHold}
          onReevaluate={handleReevaluate}
        />
      </div>

      <EvidenceDrawer
        isOpen={state.isDrawerOpen}
        route={selectedRoute}
        activeTab={state.activeDrawerTab}
        onClose={closeDrawer}
        onTabChange={setDrawerTab}
      />

      <ApprovalModal
        isOpen={state.isApprovalModalOpen}
        optimizeResult={optimizeResult}
        onConfirm={handleApprovalConfirm}
        onCancel={closeApprovalModal}
      />
    </div>
  );
}
