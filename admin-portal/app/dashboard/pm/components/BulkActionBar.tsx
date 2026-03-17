'use client';

/**
 * Floating action bar that appears when multiple items are selected on the board.
 * Shows selected count + bulk actions: Change Status, Assign Sprint, Delete.
 * Fixed at the bottom of the viewport with dark styling.
 */

import { X, ArrowRight, Calendar, Trash2 } from 'lucide-react';
import type { ItemStatus } from '@/lib/pm-types';

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
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-2.5">
        {/* Selected count */}
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="w-px h-5 bg-gray-700" />

        {/* Status action */}
        <button
          onClick={() => onChangeStatus('in_progress')}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          Move to In Progress
        </button>

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
