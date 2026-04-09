import React from 'react';

interface WorkbenchHeaderProps {
  requestId: string;
  polCode: string;
  podCode: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITICAL';
  ruleVersion: string;
  onReevaluate: () => void;
  onOpenRequest: () => void;
  onViewLogs: () => void;
}

export function WorkbenchHeader({
  requestId,
  polCode,
  podCode,
  priority,
  ruleVersion,
  onReevaluate,
  onOpenRequest,
  onViewLogs,
}: WorkbenchHeaderProps) {
  const priorityColors: Record<string, string> = {
    NORMAL: 'bg-blue-100 text-blue-800',
    URGENT: 'bg-yellow-100 text-yellow-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-semibold text-gray-900">Route Workbench</h1>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">Request ID:</span>
          <span className="font-mono font-medium text-gray-900">{requestId}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">POL → POD:</span>
          <span className="font-medium text-gray-900">
            {polCode} → {podCode}
          </span>
        </div>

        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            priorityColors[priority] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {priority}
        </span>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Rule:</span>
          <span className="font-mono text-xs text-gray-600">{ruleVersion}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReevaluate}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Re-evaluate
        </button>
        <button
          onClick={onOpenRequest}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Open request
        </button>
        <button
          onClick={onViewLogs}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View logs
        </button>
      </div>
    </header>
  );
}
