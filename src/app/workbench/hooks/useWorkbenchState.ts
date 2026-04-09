'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  WorkbenchViewMode,
  ScenarioMode,
  DrawerTab,
  WorkbenchFilters,
  RouteOptionView,
  OptimizeResponse,
} from '../types';

export interface UseWorkbenchStateReturn {
  viewMode: WorkbenchViewMode;
  setViewMode: (mode: WorkbenchViewMode) => void;
  scenarioMode: ScenarioMode;
  setScenarioMode: (mode: ScenarioMode) => void;
  selectedRouteId: string | null;
  selectRoute: (routeId: string | null) => void;
  isDrawerOpen: boolean;
  activeDrawerTab: DrawerTab;
  openDrawer: (routeId: string) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: DrawerTab) => void;
  isApprovalModalOpen: boolean;
  openApprovalModal: () => void;
  closeApprovalModal: () => void;
  filters: WorkbenchFilters;
  toggleFilter: (key: keyof WorkbenchFilters) => void;
  resetFilters: () => void;
  optimizationResult: OptimizeResponse | null;
  setOptimizationResult: (result: OptimizeResponse | null) => void;
  filteredOptions: RouteOptionView[];
  selectedRoute: RouteOptionView | null;
}

export function useWorkbenchState(): UseWorkbenchStateReturn {
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>('overview');
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>('recommended');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTab>('overview');
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [filters, setFilters] = useState<WorkbenchFilters>({
    feasibleOnly: false,
    docsReadyOnly: false,
    whSafeOnly: false,
    lowRiskOnly: false,
  });
  const [optimizationResult, setOptimizationResult] = useState<OptimizeResponse | null>(null);

  const selectRoute = useCallback((routeId: string | null) => {
    setSelectedRouteId(routeId);
  }, []);

  const openDrawer = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
    setIsDrawerOpen(true);
    setActiveDrawerTab('overview');
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const openApprovalModal = useCallback(() => {
    setIsApprovalModalOpen(true);
  }, []);

  const closeApprovalModal = useCallback(() => {
    setIsApprovalModalOpen(false);
  }, []);

  const toggleFilter = useCallback((key: keyof WorkbenchFilters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      feasibleOnly: false,
      docsReadyOnly: false,
      whSafeOnly: false,
      lowRiskOnly: false,
    });
  }, []);

  const filteredOptions = useMemo(() => {
    if (!optimizationResult) return [];

    let options = [...optimizationResult.options];

    if (filters.feasibleOnly) {
      options = options.filter(opt => opt.feasible);
    }
    if (filters.docsReadyOnly) {
      options = options.filter(opt => opt.docs_completeness_pct === 100);
    }
    if (filters.whSafeOnly) {
      options = options.filter(opt => opt.wh_impact_level === 'LOW');
    }
    if (filters.lowRiskOnly) {
      options = options.filter(opt => opt.risk_level === 'LOW');
    }

    if (scenarioMode === 'cheapest') {
      options.sort((a, b) => {
        if (a.total_cost_aed === null && b.total_cost_aed === null) return 0;
        if (a.total_cost_aed === null) return 1;
        if (b.total_cost_aed === null) return -1;
        return a.total_cost_aed - b.total_cost_aed;
      });
    } else if (scenarioMode === 'fastest') {
      options.sort((a, b) => {
        if (a.transit_days === null && b.transit_days === null) return 0;
        if (a.transit_days === null) return 1;
        if (b.transit_days === null) return -1;
        return a.transit_days - b.transit_days;
      });
    } else {
      options.sort((a, b) => {
        if (a.rank === null && b.rank === null) return 0;
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });
    }

    return options;
  }, [optimizationResult, filters, scenarioMode]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId || !optimizationResult) return null;
    return optimizationResult.options.find(opt => opt.route_option_id === selectedRouteId) || null;
  }, [selectedRouteId, optimizationResult]);

  return {
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
    resetFilters,
    optimizationResult,
    setOptimizationResult,
    filteredOptions,
    selectedRoute,
  };
}

export type { WorkbenchViewMode, ScenarioMode, DrawerTab, WorkbenchFilters };