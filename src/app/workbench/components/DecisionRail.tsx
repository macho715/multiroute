import React from 'react';
import type { OptimizeResponse, RouteOptionView, RouteStatus } from '../types';

interface DecisionRailProps {
  optimizeResult: OptimizeResponse;
  selectedRoute: RouteOptionView | null;
  onApprove: () => void;
  onHold: () => void;
  onReevaluate: () => void;
}

function statusApprovalConfig(status: RouteStatus) {
  switch (status) {
    case 'OK':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Approved → execution eligible only',
        badge: null,
      };
    case 'REVIEW':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Review required',
        badge: 'text-blue-700 bg-blue-100',
      };
    case 'AMBER':
      return {
        approveEnabled: true,
        holdEnabled: true,
        safeStep: 'Input required — acknowledge assumptions before approving',
        badge: 'text-amber-700 bg-amber-100',
      };
    case 'BLOCKED':
      return {
        approveEnabled: false,
        holdEnabled: false,
        safeStep: 'Blocked — no execution',
        badge: 'text-red-700 bg-red-100',
      };
    case 'ZERO':
      return {
        approveEnabled: false,
        holdEnabled: false,
        safeStep: 'Input required — add required inputs',
        badge: 'text-gray-700 bg-gray-200',
      };
  }
}

export function DecisionRail({
  optimizeResult,
  onApprove,
  onHold,
  onReevaluate,
}: DecisionRailProps) {
  const { status, recommended_route_code, options, decision_logic } = optimizeResult;
  const config = statusApprovalConfig(status);
  const recommended = options.find(
    (o) => o.route_code === recommended_route_code && o.feasible
  );

  const topReasons = optimizeResult.reason_codes.slice(0, 3);
  const activeAssumptions = optimizeResult.assumptions;

  return (
    <aside className="w-[360px] flex-shrink-0 flex flex-col overflow-y-auto bg-gray-50 border-l border-gray-200">
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
                <dd className="font-medium text-gray-900">#{recommended.rank ?? '—'}</dd>
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
                <dd className="font-medium text-gray-900">{recommended.eta ?? '—'}</dd>
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
            <ul className="space-y-1 mb-3">
              {topReasons.map((code) => (
                <li key={code} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <span className="text-gray-400">•</span>
                  <span className="font-medium">{code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 mb-3">No reason codes.</p>
          )}
          {activeAssumptions.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-1">Assumptions:</p>
              <ul className="space-y-1">
                {activeAssumptions.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                    <span className="text-amber-400">⚡</span>
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
              disabled={!config.approveEnabled}
              className={`w-full px-4 py-2 text-sm font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                config.approveEnabled
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Approve
            </button>
            <button
              onClick={onHold}
              disabled={!config.holdEnabled}
              className={`w-full px-4 py-2 text-sm font-medium border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                config.holdEnabled
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
        </section>

        {/* Safe Next Step */}
        <section
          className={`rounded border p-4 ${
            config.badge || 'border-gray-200 bg-white'
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Safe Next Step</h3>
          <p className="text-xs text-gray-700">{config.safeStep}</p>
        </section>
      </div>
    </aside>
  );
}
