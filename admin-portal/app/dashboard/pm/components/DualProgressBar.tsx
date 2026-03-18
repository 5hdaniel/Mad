'use client';

/**
 * DualProgressBar - Toggleable Status/Effort progress bar
 *
 * Displays a progress bar that can toggle between two modes:
 * - Status mode: completed/total items as green bar with status breakdown legend
 * - Effort mode: actual/estimated tokens as blue bar (red when over budget)
 *
 * Used on sprint detail and project detail pages.
 */

import { useState } from 'react';
import type { ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS } from '@/lib/pm-types';
import { formatTokens } from '@/lib/pm-utils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface DualProgressBarProps {
  /** Number of completed items (status mode). */
  completed: number;
  /** Total number of items (status mode). */
  total: number;
  /** Item counts by status key, e.g. { pending: 5, in_progress: 3 }. */
  byStatus?: Record<string, number>;

  /** Total estimated tokens (effort mode). */
  estTokens: number;
  /** Total actual tokens consumed (effort mode). */
  actualTokens: number;

  /** Which mode to show initially. Defaults to 'status'. */
  defaultMode?: 'status' | 'effort';
  /** Show the Status/Effort toggle buttons. Defaults to true. */
  showToggle?: boolean;
  /** Show the compact legend below the bar. Defaults to true. */
  showLegend?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

export function DualProgressBar({
  completed,
  total,
  byStatus,
  estTokens,
  actualTokens,
  defaultMode = 'status',
  showToggle = true,
  showLegend = true,
  className,
}: DualProgressBarProps) {
  const [mode, setMode] = useState<'status' | 'effort'>(defaultMode);

  const statusPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const effortPct =
    estTokens > 0 ? Math.round((actualTokens / estTokens) * 100) : 0;
  const isOverBudget = actualTokens > estTokens && estTokens > 0;

  return (
    <div className={className}>
      {/* Toggle */}
      {showToggle && (
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setMode('status')}
            className={`px-2 py-0.5 text-xs rounded-l-md border ${
              mode === 'status'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-500'
            }`}
          >
            Status
          </button>
          <button
            onClick={() => setMode('effort')}
            className={`px-2 py-0.5 text-xs rounded-r-md border border-l-0 ${
              mode === 'effort'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-500'
            }`}
          >
            Effort
          </button>
        </div>
      )}

      {/* Bar */}
      {mode === 'status' ? (
        <>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium text-gray-700">
              {completed}/{total} items ({statusPct}%)
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${statusPct}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Effort</span>
            <span
              className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-700'}`}
            >
              {formatTokens(actualTokens)} / {formatTokens(estTokens)} (
              {effortPct}%)
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(effortPct, 100)}%` }}
            />
          </div>
        </>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          {mode === 'status' &&
            byStatus &&
            Object.entries(byStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <span key={status}>
                  {STATUS_LABELS[status as ItemStatus] || status}: {count}
                </span>
              ))}
          {mode === 'effort' && (
            <>
              <span>Est: {formatTokens(estTokens)}</span>
              <span>Actual: {formatTokens(actualTokens)}</span>
              <span
                className={isOverBudget ? 'text-red-500' : 'text-green-600'}
              >
                Variance:{' '}
                {estTokens > 0
                  ? `${((actualTokens - estTokens) / estTokens * 100).toFixed(0)}%`
                  : 'N/A'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
