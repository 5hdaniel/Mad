/**
 * Custom hook for managing selection state
 * Handles selecting/deselecting items and bulk operations
 */
import { useState } from 'react';

/**
 * Item with ID field for selection
 */
export interface SelectableItem {
  id: string;
}

/**
 * Return type for useSelection hook
 */
export interface UseSelectionReturn {
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: (items: SelectableItem[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  count: number;
}

/**
 * Custom hook for managing selection state
 * @returns Selection state and handler functions
 */
export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string): void => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = (items: SelectableItem[]): void => {
    setSelectedIds(new Set(items.map(item => item.id)));
  };

  const deselectAll = (): void => {
    setSelectedIds(new Set());
  };

  const isSelected = (id: string): boolean => {
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
