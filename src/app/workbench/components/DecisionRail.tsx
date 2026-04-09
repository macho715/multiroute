'use client';

/**
 * Decision Rail Component
 * Multi-Route Optimization MVP v1.0.0
 *
 * Width: 360px (sticky)
 * Purpose: Bundle "what is recommended, why, and what to do now" in one area
 *
 * Block Order:
 * 1. Recommended Route Summary
 * 2. Decision Logic
 * 3. Reason / Assumption Summary
 * 4. Approval Controls
 * 5. Safe Next Step
 *
 * Forbidden:
 * - booking submit
 * - customs submit
 * - carrier action
 * - payment/contract action
 */

import React from 'react';
import type { OptimizeResponse, RouteOptionView, RouteStatus } from '../types';

interface DecisionRailProps {
  optimizeResult: OptimizeResponse | null;
  selectedRoute: RouteOptionView | null;
  canApprove: boolean;
  requiresAcknowledgement: boolean;
  onApprove: () => void;
  onHold: () => void;
  onReevaluate: () => void;
}

function getStatusApprovalConfig(status: RouteStatus): {
  approveEnabled: boolean;
  holdEnabled: boolean;
  safeStep: string;
  badgeClass: string;
} {
  switch (status) {
    case 'OK':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Approved → execution eligible only',
        badgeClass: 'border-green-200 bg-green-50',
      };
    case 'REVIEW':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Review required',
        badgeClass: 'border-blue-200 bg-blue-50',
      };
    case 'AMBER':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Acknowledge assumptions before approving',
        badgeClass: 'border-amber-200 bg-amber-50',
      };
    case 'BLOCKED':
      return {
        approveEnabled: false,
        holdEnabled: false,
        safeStep: 'Blocked — no execution possible',
        badgeClass: 'border-red-200 bg-red-50',
      };
    case 'ZERO':
      return {
        approveEnabled: false,
        holdEnabled: false,
        safeStep: 'Input required — add required inputs',
        badgeClass: 'border-gray-200 bg-gray-100',
      };
  }
}

export function DecisionRail({
  optimizeResult,
  selectedRoute,
  canApprove,
  requiresAcknowledgement,
  onApprove,
  onHold,
  onReevaluate,
}: DecisionRailProps) {
  if (!optimizeResult) {
    return (
      <aside
        role="complementary"
        aria-label="Decision rail"
        className="w-[360px] flex-shrink-0 flex flex-col overflow-y-auto bg-gray-50 border-l border-gray-200"
      >
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-gray-500">No optimization result loaded.</p>
        </div>
      </aside>
    );
  }

  const { status, recommended_route_code, options, decision_logic, reason_codes, assumptions } = optimizeResult;
  const config = getStatusApprovalConfig(status);

  // Find recommended route
  const recommended = recommended_route_code
    ? options.find((o) => o.route_code === recommended_route_code && o.feasible)
    : null;

  const topReasons = reason_codes.slice(0, 3);

  return (
    <aside
      role="complementary"
      aria-label="Decision rail"
      className="w-[360px] flex-shrink-0 flex flex-col overflow-y-auto bg-gray-50 border-l border-gray-200"
    >
      <div className="flex-1 p-4 space-y-4">
        {/* Recommended Route Summary */}
        <section className="bg-white rounded border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recommended Route</h3>
          {recommended ? (
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500">Route</dt>
                <dd className="font-medium text-gray-900">{recommended.route_code}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Rank</dt>
                <dd className="font-medium text-gray-900">
                  #{recommended.rank !== null ? recommended.rank : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Cost</dt>
                <dd className="font-medium text-gray-900">
                  {recommended.total_cost_aed !== null
                    ? `AED ${recommended.total_cost_aed.toFixed(2)}`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Transit</dt>
                <dd className="font-medium text-gray-900">
                  {recommended.transit_days !== null
                    ? `${recommended.transit_days.toFixed(2)}d`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ETA</dt>
                <dd className="font-medium text-gray-900">{recommended.eta || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Risk</dt>
                <dd className="font-medium text-gray-900">{recommended.risk_level}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Feasibility</dt>
                <dd
                  className={`font-medium ${
                    recommended.feasible ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {recommended.feasible ? 'Feasible' : 'Blocked'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-gray-500">
              {status === 'BLOCKED' || status === 'ZERO'
                ? 'No feasible route available.'
                : 'No recommendation yet.'}
            </p>
          )}
        </section>

        {/* Decision Logic */}
        <section className="bg-white rounded border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Decision Logic</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-500">Priority</dt>
              <dd className="font-medium text-gray-900">{decision_logic.priority}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Cost weight</dt>
              <dd className="font-medium text-gray-900">
                {decision_logic.weights.cost.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Time weight</dt>
              <dd className="font-medium text-gray-900">
                {decision_logic.weights.time.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Risk weight</dt>
              <dd className="font-medium text-gray-900">
                {decision_logic.weights.risk.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">WH weight</dt>
              <dd className="font-medium text-gray-900">
                {decision_logic.weights.wh.toFixed(2)}
              </dd>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <dt className="text-gray-500 mb-1">Normalization</dt>
              <dd className="font-medium text-gray-700">
                {decision_logic.normalization_method}
              </dd>
            </div>
          </dl>
          {decision_logic.penalties_applied.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <dt className="text-xs text-gray-500 mb-1">Penalties applied</dt>
              <dd className="space-y-1">
                {decision_logic.penalties_applied.map((p) => (
                  <div key={p.code} className="text-xs text-gray-700">
                    <span className="font-medium text-red-600">{p.code}</span>: {p.description}
                  </div>
                ))}
              </dd>
            </div>
          )}
        </section>

        {/* Reason / Assumption Summary */}
        <section className="bg-white rounded border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Reason / Assumption Summary
          </h3>
          {topReasons.length > 0 ? (
            <ul className="space-y-1 mb-3" role="list" aria-label="Top reason codes">
              {topReasons.map((code) => (
                <li key={code} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span className="font-medium">{code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 mb-3">No reason codes.</p>
          )}
          {assumptions.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-1">Assumptions:</p>
              <ul className="space-y-1" role="list" aria-label="Active assumptions">
                {assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">⚡</span>
                    {a}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Approval Controls */}
        <section className="bg-white rounded border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Approval Controls</h3>
          <div className="space-y-2">
            <button
              onClick={onApprove}
              disabled={!canApprove}
              className={`w-full px-4 py-2 text-sm font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                canApprove
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Approve
            </button>
            <button
              onClick={onHold}
              disabled={!canApprove}
              className={`w-full px-4 py-2 text-sm font-medium border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                canApprove
                  ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
              }`}
            >
              Hold
            </button>
            <button
              onClick={onReevaluate}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Request Re-evaluation
            </button>
          </div>
          {requiresAcknowledgement && (
            <p className="mt-2 text-xs text-amber-600">
              Acknowledgement required for {status} status.
            </p>
          )}
        </section>

        {/* Safe Next Step */}
        <section className={`rounded border p-4 ${config.badgeClass}`}>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Safe Next Step</h3>
          <p className="text-xs text-gray-700">{config.safeStep}</p>
        </section>
      </div>
    </aside>
  );
}

export default DecisionRail;