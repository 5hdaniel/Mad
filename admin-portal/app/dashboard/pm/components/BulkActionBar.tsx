'use client';

/**
 * Floating action bar that appears when multiple items are selected on the board.
 * Shows selected count + bulk actions: Change Status (dropdown), Assign Sprint, Delete.
 * Fixed at the bottom of the viewport with dark styling.
 */

import { useState } from 'react';
import { X, ChevronUp, Calendar, Trash2 } from 'lucide-react';
import type { ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';

const STATUS_OPTIONS: ItemStatus[] = [
  'pending',
  'in_progress',
  'testing',
  'completed',
  'blocked',
  'deferred',
];

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onChangeStatus: (status: ItemStatus) => void;
  onChangePriority: (priority: string) => void;
  onAssignToSprint: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onChangeStatus,
  onAssignToSprint,
  onDelete,
}: BulkActionBarProps) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-2.5">
        {/* Selected count */}
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="w-px h-5 bg-gray-700" />

        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusMenuOpen(!statusMenuOpen)}
            className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
            Move to...
          </button>
          {statusMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setStatusMenuOpen(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      onChangeStatus(status);
                      setStatusMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sprint assignment */}
        <button
          onClick={onAssignToSprint}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <Calendar className="h-4 w-4" />
          Assign Sprint
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Close / clear selection */}
        <button
          onClick={onClearSelection}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
