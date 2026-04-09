import React from 'react';
import type { RouteStatus } from '../types';

interface DecisionBarProps {
  status: RouteStatus;
  recommendedRouteCode: string | null;
  feasibleCount: number;
  totalCount: number;
  reasonCount: number;
  assumptionCount: number;
  evidenceCount: number;
  lastEvaluatedAt: string | null;
  incompleteInputCount: number;
  shortReason?: string;
}

function StatusBadge({
  status,
  shortReason,
}: {
  status: RouteStatus;
  shortReason?: string;
}) {
  const config: Record<
    RouteStatus,
    { label: string; color: string; bg: string; icon: string }
  > = {
    OK: {
      label: 'OK',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: '✓',
    },
    REVIEW: {
      label: 'Review Required',
      color: 'text-blue-700',
      bg: 'bg-blue-100',
      icon: '⚠',
    },
    AMBER: {
      label: 'AMBER',
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      icon: '⚡',
    },
    BLOCKED: {
      label: 'BLOCKED',
      color: 'text-red-700',
      bg: 'bg-red-100',
      icon: '⊗',
    },
    ZERO: {
      label: 'ZERO',
      color: 'text-gray-700',
      bg: 'bg-gray-200',
      icon: '∅',
    },
  };

  const c = config[status];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${c.bg} ${c.color}`}>
      <span className="font-bold">{c.icon}</span>
      <span className={`font-semibold ${c.color}`}>{c.label}</span>
      {shortReason && status === 'BLOCKED' && (
        <span className="text-xs text-red-600 ml-1">— {shortReason}</span>
      )}
      {status === 'AMBER' && shortReason && (
        <span className="text-xs text-amber-700 ml-1">가정: {shortReason}</span>
      )}
    </div>
  );
}

export function DecisionBar({
  status,
  recommendedRouteCode,
  feasibleCount,
  totalCount,
  reasonCount,
  assumptionCount,
  evidenceCount,
  lastEvaluatedAt,
  incompleteInputCount,
  shortReason,
}: DecisionBarProps) {
  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center gap-6">
        <StatusBadge status={status} shortReason={shortReason} />

        {recommendedRouteCode && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Recommended:</span>
            <span className="font-medium text-gray-900">{recommendedRouteCode}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Feasible:</span>
          <span className="font-medium text-gray-900">
            {feasibleCount}/{totalCount}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>Reasons: {reasonCount}</span>
          {assumptionCount > 0 && <span>Assumptions: {assumptionCount}</span>}
          <span>Evidence: {evidenceCount}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        {incompleteInputCount > 0 && (
          <span className="text-amber-600 font-medium">
            ⚠ {incompleteInputCount} incomplete input{incompleteInputCount !== 1 ? 's' : ''}
          </span>
        )}
        {lastEvaluatedAt && (
          <span className="text-gray-500">
            Last evaluated:{' '}
            <span className="font-mono text-gray-700">{lastEvaluatedAt}</span>
          </span>
        )}
      </div>
    </div>
  );
}
