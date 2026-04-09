'use client';

import React, { useEffect, useRef } from 'react';
import type { OptimizeResponse, RouteStatus } from '../types';

interface ApprovalModalProps {
  isOpen: boolean;
  optimizeResult: OptimizeResponse;
  onConfirm: (acknowledgeAssumptions: boolean) => void;
  onCancel: () => void;
}

function statusIcon(status: RouteStatus): string {
  switch (status) {
    case 'OK':
      return '✓';
    case 'REVIEW':
      return '⚠';
    case 'AMBER':
      return '⚡';
    case 'BLOCKED':
      return '⊗';
    case 'ZERO':
      return '∅';
  }
}

export function ApprovalModal({
  isOpen,
  optimizeResult,
  onConfirm,
  onCancel,
}: ApprovalModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [acknowledge, setAcknowledge] = React.useState(false);

  const { status, recommended_route_code, rule_version, evidence_ref } = optimizeResult;
  const reasonSummary = optimizeResult.reason_codes.slice(0, 3).join(', ');
  const assumptionSummary = optimizeResult.assumptions.join('; ');

  const requiresAcknowledge = status === 'AMBER' || status === 'REVIEW';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusable = modalRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setAcknowledge(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Approval confirmation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white rounded shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <span className="text-2xl">{statusIcon(status)}</span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Confirm Route Approval
            </h2>
            <p className="text-xs text-gray-500">
              Request: {optimizeResult.request_id}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Execution summary */}
          <div className="bg-gray-50 rounded border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Recommended Route
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Route</dt>
                <dd className="font-medium text-gray-900">
                  {recommended_route_code ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900">{status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Rule version</dt>
                <dd className="font-mono text-xs text-gray-700">
                  {rule_version.route_rules}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Evidence refs</dt>
                <dd className="text-gray-900">{evidence_ref.length}</dd>
              </div>
            </dl>
          </div>

          {/* Risk / reversibility */}
          <div className="bg-gray-50 rounded border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Risk &amp; Reversibility
            </h3>
            <p className="text-xs text-gray-600">
              {status === 'OK' && 'Route is feasible with no blocking constraints.'}
              {status === 'REVIEW' && 'Route is feasible but requires manual review of operational or policy judgement.'}
              {status === 'AMBER' && 'Route relies on estimated values or assumptions. Review the assumptions before approving.'}
              {status === 'BLOCKED' && 'Route has no feasible options. Do not proceed with execution.'}
              {status === 'ZERO' && 'Critical input is missing. Do not proceed until required inputs are provided.'}
            </p>
          </div>

          {/* Reason/assumption summary */}
          {(reasonSummary || assumptionSummary) && (
            <div className="space-y-2">
              {reasonSummary && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Top reason codes</p>
                  <p className="text-sm text-red-700">{reasonSummary}</p>
                </div>
              )}
              {assumptionSummary && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Assumptions</p>
                  <p className="text-sm text-amber-700">{assumptionSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* Evidence link */}
          {evidence_ref.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>{evidence_ref.length} evidence reference{evidence_ref.length !== 1 ? 's' : ''} attached</span>
            </div>
          )}

          {/* Acknowledgement checkbox (AMBER/REVIEW) */}
          {requiresAcknowledge && (
            <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-800">
                I acknowledge the assumptions and risks associated with this route approval.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(acknowledge)}
            disabled={requiresAcknowledge && !acknowledge}
            className={`px-4 py-2 text-sm font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              requiresAcknowledge && !acknowledge
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Confirm Approval
          </button>
        </div>
      </div>
    </div>
  );
}
