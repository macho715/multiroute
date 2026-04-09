'use client';

/**
 * Compare Canvas Component
 * Multi-Route Optimization MVP v1.0.0
 *
 * Min Width: 720px (fluid)
 * Purpose: Primary comparison surface for all route options
 *
 * Features:
 * - View Mode Tabs: Overview | Compare | Audit
 * - Scenario Toggle: Recommended | Cheapest | Fastest
 * - Sort: rank | cost | transit | risk
 * - Filter chips: feasible, docs-ready, wh-safe, low-risk
 * - Row-card hybrid for route display
 * - Recommended row pinned at top
 */

import React from 'react';
import type { RouteOptionView, WorkbenchViewMode, ScenarioMode, WorkbenchFilters } from '../types';

interface RouteCompareRowProps {
  route: RouteOptionView;
  isSelected: boolean;
  isRecommended: boolean;
  viewMode: WorkbenchViewMode;
  onSelect: () => void;
  onViewDetails: () => void;
}

function riskColor(level: string): string {
  const map: Record<string, string> = {
    LOW: 'text-green-700 bg-green-100',
    MEDIUM: 'text-yellow-700 bg-yellow-100',
    HIGH: 'text-orange-700 bg-orange-100',
    BLOCKED: 'text-red-700 bg-red-100',
  };
  return map[level] || 'text-gray-700 bg-gray-100';
}

function whImpactColor(level: string): string {
  const map: Record<string, string> = {
    LOW: 'text-green-700 bg-green-50',
    MEDIUM: 'text-yellow-700 bg-yellow-50',
    HIGH: 'text-orange-700 bg-orange-50',
    BLOCKED: 'text-red-700 bg-red-50',
  };
  return map[level] || 'text-gray-700 bg-gray-50';
}

export function RouteCompareRow({
  route,
  isSelected,
  isRecommended,
  viewMode,
  onSelect,
  onViewDetails,
}: RouteCompareRowProps) {
  return (
    <div
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex items-center gap-4 p-4 rounded border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : isRecommended
          ? 'border-blue-300 bg-blue-50/50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {/* Route badge */}
      <div className="flex-shrink-0">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
            isRecommended ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {route.route_code.replace('_', ' ')}
        </span>
      </div>

      {/* Rank */}
      <div className="w-10 flex-shrink-0 text-center">
        <span className="text-sm font-medium text-gray-900">
          {route.rank !== null ? `#${route.rank}` : '—'}
        </span>
      </div>

      {/* Feasibility */}
      <div className="w-20 flex-shrink-0 text-center">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            route.feasible ? 'text-green-600' : 'text-red-600'
          }`}
        >
          <span aria-hidden="true">{route.feasible ? '✓' : '⊗'}</span>
          {route.feasible ? 'Feasible' : 'Blocked'}
        </span>
      </div>

      {/* ETA */}
      <div className="w-28 flex-shrink-0">
        <span className="text-sm text-gray-700">
          {route.eta || '—'}
        </span>
      </div>

      {/* Transit days */}
      <div className="w-20 flex-shrink-0 text-right">
        <span className="text-sm font-medium text-gray-900">
          {route.transit_days !== null ? `${route.transit_days.toFixed(2)}d` : '—'}
        </span>
      </div>

      {/* Total cost */}
      <div className="w-28 flex-shrink-0 text-right">
        <span className="text-sm font-medium text-gray-900">
          {route.total_cost_aed !== null ? `AED ${route.total_cost_aed.toFixed(2)}` : '—'}
        </span>
      </div>

      {/* Risk level */}
      <div className="w-16 flex-shrink-0 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${riskColor(route.risk_level)}`}
        >
          {route.risk_level}
        </span>
      </div>

      {/* WH impact */}
      <div className="w-16 flex-shrink-0 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${whImpactColor(route.wh_impact_level)}`}
        >
          {route.wh_impact_level}
        </span>
      </div>

      {/* Docs completeness */}
      <div className="w-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${route.docs_completeness_pct}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{route.docs_completeness_pct}%</span>
        </div>
      </div>

      {/* Reason/Evidence chips (hidden in overview mode) */}
      {viewMode !== 'overview' && (
        <>
          <div className="w-16 flex-shrink-0 text-center">
            <span className="text-xs text-gray-600">
              {route.reason_codes.length} reasons
            </span>
          </div>
          <div className="w-16 flex-shrink-0 text-center">
            <span className="text-xs text-gray-600">
              {route.evidence_ref.length} refs
            </span>
          </div>
        </>
      )}

      {/* View details button */}
      <div className="flex-shrink-0 ml-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View details
        </button>
      </div>
    </div>
  );
}

interface CompareCanvasProps {
  viewMode: WorkbenchViewMode;
  scenarioMode: ScenarioMode;
  routes: RouteOptionView[];
  selectedRouteId: string | null;
  recommendedRouteId: string | null;
  filters: WorkbenchFilters;
  sortBy: 'rank' | 'cost' | 'transit' | 'risk';
  onViewModeChange: (mode: WorkbenchViewMode) => void;
  onScenarioModeChange: (mode: ScenarioMode) => void;
  onSortChange: (sort: 'rank' | 'cost' | 'transit' | 'risk') => void;
  onFilterChange: (key: keyof WorkbenchFilters, value: boolean) => void;
  onSelectRoute: (routeId: string) => void;
  onViewDetails: (routeId: string) => void;
}

export function CompareCanvas({
  viewMode,
  scenarioMode,
  routes,
  selectedRouteId,
  recommendedRouteId,
  filters,
  sortBy,
  onViewModeChange,
  onScenarioModeChange,
  onSortChange,
  onFilterChange,
  onSelectRoute,
  onViewDetails,
}: CompareCanvasProps) {
  const filtered = routes.filter((r) => {
    if (filters.feasibleOnly && !r.feasible) return false;
    if (filters.docsReadyOnly && r.docs_completeness_pct < 100) return false;
    if (filters.whSafeOnly && r.wh_impact_level === 'HIGH') return false;
    if (filters.lowRiskOnly && r.risk_level === 'HIGH') return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Always put recommended first in recommended mode
    if (scenarioMode === 'recommended' && recommendedRouteId) {
      if (a.route_option_id === recommendedRouteId) return -1;
      if (b.route_option_id === recommendedRouteId) return 1;
    }

    if (scenarioMode === 'cheapest') {
      return (a.total_cost_aed ?? Infinity) - (b.total_cost_aed ?? Infinity);
    }
    if (scenarioMode === 'fastest') {
      return (a.transit_days ?? Infinity) - (b.transit_days ?? Infinity);
    }

    // Sort by selected criteria
    switch (sortBy) {
      case 'cost':
        return (a.total_cost_aed ?? Infinity) - (b.total_cost_aed ?? Infinity);
      case 'transit':
        return (a.transit_days ?? Infinity) - (b.transit_days ?? Infinity);
      case 'risk': {
        const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'BLOCKED'];
        return riskOrder.indexOf(a.risk_level) - riskOrder.indexOf(b.risk_level);
      }
      default:
        return (a.rank ?? 999) - (b.rank ?? 999);
    }
  });

  return (
    <main
      role="main"
      className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white"
    >
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50">
        {/* View mode tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded p-0.5" role="tablist" aria-label="View mode">
          {(['overview', 'compare', 'audit'] as WorkbenchViewMode[]).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                viewMode === mode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Scenario toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded p-0.5" role="group" aria-label="Scenario">
            {(['recommended', 'cheapest', 'fastest'] as ScenarioMode[]).map((s) => (
              <button
                key={s}
                onClick={() => onScenarioModeChange(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  scenarioMode === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label htmlFor="sort-select" className="text-gray-500">Sort:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
              className="px-2 py-1 border border-gray-300 rounded text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rank">Rank</option>
              <option value="cost">Cost</option>
              <option value="transit">Transit</option>
              <option value="risk">Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500">Filters:</span>
        {(
          [
            { key: 'feasibleOnly', label: 'Feasible' },
            { key: 'docsReadyOnly', label: 'Docs-ready' },
            { key: 'whSafeOnly', label: 'WH-safe' },
            { key: 'lowRiskOnly', label: 'Low-risk' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onFilterChange(key, !filters[key])}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filters[key]
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Route rows */}
      <div
        role="grid"
        aria-label="Route comparison"
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500" role="status">
            No routes match the current filters.
          </div>
        ) : (
          sorted.map((route) => (
            <RouteCompareRow
              key={route.route_option_id}
              route={route}
              isSelected={route.route_option_id === selectedRouteId}
              isRecommended={route.route_option_id === recommendedRouteId}
              viewMode={viewMode}
              onSelect={() => onSelectRoute(route.route_option_id)}
              onViewDetails={() => onViewDetails(route.route_option_id)}
            />
          ))
        )}
      </div>
    </main>
  );
}

export default CompareCanvas;