'use client';

import React, { useEffect, useRef } from 'react';
import type { RouteOptionView, DrawerTab } from '../types';

interface EvidenceDrawerProps {
  isOpen: boolean;
  route: RouteOptionView | null;
  activeTab: DrawerTab;
  onClose: () => void;
  onTabChange: (tab: DrawerTab) => void;
}

type TabId = 'overview' | 'legs' | 'cost' | 'transit' | 'docs' | 'wh' | 'evidence' | 'trace';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'legs', label: 'Route Legs' },
  { id: 'cost', label: 'Cost Breakdown' },
  { id: 'transit', label: 'Transit & Buffers' },
  { id: 'docs', label: 'Docs & Customs' },
  { id: 'wh', label: 'WH Impact' },
  { id: 'evidence', label: 'Evidence & Rule Version' },
  { id: 'trace', label: 'Approval Trace' },
];

function TabPanel({ tab, route }: { tab: DrawerTab; route: RouteOptionView }) {
  switch (tab) {
    case 'overview':
      return (
        <div className="space-y-3">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Route</dt>
              <dd className="font-medium text-gray-900">{route.route_code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Rank</dt>
              <dd className="font-medium text-gray-900">{route.rank ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Feasible</dt>
              <dd className={route.feasible ? 'text-green-600' : 'text-red-600'}>
                {route.feasible ? 'Yes' : 'No'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">ETA</dt>
              <dd className="text-gray-900">{route.eta ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Transit</dt>
              <dd className="text-gray-900">
                {route.transit_days !== null ? `${route.transit_days.toFixed(2)}d` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Risk</dt>
              <dd className="text-gray-900">{route.risk_level}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">WH Impact</dt>
              <dd className="text-gray-900">{route.wh_impact_level}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Docs Completeness</dt>
              <dd className="text-gray-900">{route.docs_completeness_pct}%</dd>
            </div>
          </dl>
          {route.reason_codes.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Reason codes</p>
              <ul className="space-y-0.5">
                {route.reason_codes.map((code) => (
                  <li key={code} className="text-xs text-red-700 flex items-center gap-1">
                    <span className="text-red-400">•</span>
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case 'legs':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Route legs — populate from route option data
          </p>
        </div>
      );
    case 'cost':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Cost breakdown — populate from cost_breakdown entity
          </p>
        </div>
      );
    case 'transit':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Transit &amp; buffers — populate from transit_estimate entity
          </p>
        </div>
      );
    case 'docs':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Docs &amp; customs — populate from constraint evaluation
          </p>
        </div>
      );
    case 'wh':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            WH impact — populate from wh_capacity_snapshot
          </p>
        </div>
      );
    case 'evidence':
      return (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Evidence references</p>
            <ul className="space-y-0.5">
              {route.evidence_ref.map((ref, i) => (
                <li key={i} className="text-xs text-gray-700 font-mono">
                  {ref}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Assumption notes</p>
            <ul className="space-y-0.5">
              {route.assumption_notes.map((note, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case 'trace':
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Approval trace — populate from approval_log / decision_log
          </p>
        </div>
      );
    default:
      return null;
  }
}

export function EvidenceDrawer({
  isOpen,
  route,
  activeTab,
  onClose,
  onTabChange,
}: EvidenceDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const focusable = drawerRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Evidence drawer"
      className="fixed inset-y-0 right-0 w-[520px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">
          Route Evidence
          {route && (
            <span className="ml-2 text-gray-500 font-normal">— {route.route_code}</span>
          )}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          aria-label="Close drawer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id as DrawerTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {route ? (
          <TabPanel tab={activeTab} route={route} />
        ) : (
          <p className="text-sm text-gray-500">Select a route to view evidence.</p>
        )}
      </div>
    </div>
  );
}
