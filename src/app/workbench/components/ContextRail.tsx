import React from 'react';

interface ShipmentSummary {
  polCode: string;
  podCode: string;
  cargoType: string;
  containerType: string;
  quantity: number;
  dimsCm: { length: number; width: number; height: number };
  grossWeightKg: number;
  etdTarget: string;
  requiredDeliveryDate: string;
  incoterm: string;
  destinationSite: string;
}

interface MissingInput {
  code: string;
  description: string;
}

interface HardConstraint {
  code: string;
  description: string;
}

interface ContextRailProps {
  shipment: ShipmentSummary;
  missingInputs: MissingInput[];
  hardConstraints: HardConstraint[];
  feasibleOnly: boolean;
  docsReadyOnly: boolean;
  whSafeOnly: boolean;
  lowRiskOnly: boolean;
  onFilterChange: (key: 'feasibleOnly' | 'docsReadyOnly' | 'whSafeOnly' | 'lowRiskOnly', value: boolean) => void;
  onEditRequest: () => void;
}

export function ContextRail({
  shipment,
  missingInputs,
  hardConstraints,
  feasibleOnly,
  docsReadyOnly,
  whSafeOnly,
  lowRiskOnly,
  onFilterChange,
  onEditRequest,
}: ContextRailProps) {
  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto p-4 bg-gray-50 border-r border-gray-200">
      {/* Shipment Summary */}
      <section className="bg-white rounded border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipment Summary</h3>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">POL / POD</dt>
            <dd className="font-medium text-gray-900">
              {shipment.polCode} → {shipment.podCode}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Cargo</dt>
            <dd className="font-medium text-gray-900">{shipment.cargoType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Container</dt>
            <dd className="font-medium text-gray-900">
              {shipment.containerType} × {shipment.quantity}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Dims / Weight</dt>
            <dd className="font-medium text-gray-900">
              {shipment.dimsCm.length}×{shipment.dimsCm.width}×{shipment.dimsCm.height} cm /{' '}
              {shipment.grossWeightKg} kg
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">ETD Target</dt>
            <dd className="font-medium text-gray-700">{shipment.etdTarget}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Required Delivery</dt>
            <dd className="font-medium text-gray-700">{shipment.requiredDeliveryDate}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Incoterm</dt>
            <dd className="font-medium text-gray-900">{shipment.incoterm}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Destination</dt>
            <dd className="font-medium text-gray-900">{shipment.destinationSite}</dd>
          </div>
        </dl>
      </section>

      {/* Missing / Stale Inputs */}
      {missingInputs.length > 0 && (
        <section className="bg-white rounded border border-amber-200 p-4">
          <h3 className="text-sm font-semibold text-amber-700 mb-3">Missing / Stale Inputs</h3>
          <ul className="space-y-1.5">
            {missingInputs.map((input) => (
              <li key={input.code} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-500">•</span>
                <span>
                  <span className="font-medium">{input.code}</span>
                  {input.description && ` — ${input.description}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hard Constraints */}
      {hardConstraints.length > 0 && (
        <section className="bg-white rounded border border-red-200 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-3">Hard Constraints</h3>
          <ul className="space-y-1.5">
            {hardConstraints.map((constraint) => (
              <li key={constraint.code} className="text-xs text-red-800 flex items-start gap-1.5">
                <span className="text-red-500">⊗</span>
                <span>
                  <span className="font-medium">{constraint.code}</span>
                  {constraint.description && ` — ${constraint.description}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filters */}
      <section className="bg-white rounded border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
        <div className="space-y-2">
          {[
            { key: 'feasibleOnly' as const, label: 'Feasible only' },
            { key: 'docsReadyOnly' as const, label: 'Docs-ready only' },
            { key: 'whSafeOnly' as const, label: 'WH-safe only' },
            { key: 'lowRiskOnly' as const, label: 'Low-risk only' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  key === 'feasibleOnly'
                    ? feasibleOnly
                    : key === 'docsReadyOnly'
                    ? docsReadyOnly
                    : key === 'whSafeOnly'
                    ? whSafeOnly
                    : lowRiskOnly
                }
                onChange={(e) => onFilterChange(key, e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Edit Request CTA */}
      <button
        onClick={onEditRequest}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Edit request
      </button>
    </aside>
  );
}
