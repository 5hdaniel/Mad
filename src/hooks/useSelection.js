/**
 * Custom hook for managing selection state
 * Handles selecting/deselecting items and bulk operations
 */
import { useState } from 'react';

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = (items) => {
    setSelectedIds(new Set(items.map(item => item.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const isSelected = (id) => {
    return selectedIds.has(id);
  };

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    isSelected,
    count: selectedIds.size
  };
}
