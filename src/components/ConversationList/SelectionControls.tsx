/**
 * SelectionControls Component
 * Provides select all/deselect all/show selected buttons
 */
import React from 'react';

interface SelectionControlsProps {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleShowSelected: () => void;
  showOnlySelected: boolean;
  selectedCount: number;
}

export function SelectionControls({
  onSelectAll,
  onDeselectAll,
  onToggleShowSelected,
  showOnlySelected,
  selectedCount
}: SelectionControlsProps) {
  return (
    <>
      <button
        data-tour="select-all"
        onClick={onSelectAll}
        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Select All
      </button>

      <button
        data-tour="deselect-all"
        onClick={onDeselectAll}
        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Deselect All
      </button>

      <button
        onClick={onToggleShowSelected}
        disabled={selectedCount === 0}
        className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          showOnlySelected
            ? 'bg-primary text-white border-primary hover:bg-blue-600'
            : 'border-gray-300 hover:bg-gray-50'
        }`}
      >
        {showOnlySelected ? 'Show All' : 'Show Selected'}
      </button>
    </>
  );
}
