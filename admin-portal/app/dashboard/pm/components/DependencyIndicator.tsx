'use client';

/**
 * Small icon/badge shown on kanban cards when an item has blocking dependencies.
 * Shows a lock icon if the item is blocked, or a warning triangle if it blocks others.
 * Tooltip on hover describes the blocking relationship.
 */

import { Lock, AlertTriangle } from 'lucide-react';

interface DependencyIndicatorProps {
  /** Number of items that block this item */
  blockingCount: number;
  /** Whether the item is currently blocked */
  isBlocked: boolean;
  /** Tooltip text describing what blocks this item */
  tooltip?: string;
}

export function DependencyIndicator({
  blockingCount,
  isBlocked,
  tooltip,
}: DependencyIndicatorProps) {
  if (blockingCount === 0 && !isBlocked) return null;

  return (
    <div className="relative group inline-flex items-center">
      {isBlocked ? (
        <Lock className="h-3.5 w-3.5 text-red-500" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
      )}

      {/* Tooltip on hover */}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}
