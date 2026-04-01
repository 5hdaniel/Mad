'use client';

/**
 * useProjectDragDrop -- Encapsulates drag-and-drop logic for the project detail page.
 *
 * Handles:
 * - DnD sensor configuration (PointerSensor 8px + KeyboardSensor)
 * - Drag start/end event handlers
 * - Optimistic local state update via moveItem callback
 * - Backlog item → sprint assignment
 * - Sprint item → different sprint reassignment
 * - Sprint item → backlog unassignment
 * - No-op on same-container drops
 * - Falls back to full refresh if RPC fails
 */

import { useState, useCallback } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { assignToSprint, removeFromSprint } from '@/lib/pm-queries';
import type { PmBacklogItem } from '@/lib/pm-types';

interface UseProjectDragDropParams {
  /** Optimistic local state update: move item to a sprint (or null for backlog) */
  moveItem: (itemId: string, targetSprintId: string | null) => void;
  /** Full refresh fallback — called only when the RPC fails to revert to server state */
  onRefreshFallback: () => void;
}

export function useProjectDragDrop({ moveItem, onRefreshFallback }: UseProjectDragDropParams) {
  const [activeDragItem, setActiveDragItem] = useState<PmBacklogItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.item) {
      setActiveDragItem(data.item as PmBacklogItem);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);

      if (!over) return;

      const data = active.data.current;
      if (!data?.item) return;

      const item = data.item as PmBacklogItem;
      const sourceContainerId = data.containerId as string;
      const targetContainerId = over.id as string;

      // No-op: dropped on same container
      if (sourceContainerId === targetContainerId) return;

      const targetSprintId = targetContainerId === 'backlog-panel' ? null : targetContainerId;

      // Optimistic update: move item locally before RPC completes
      moveItem(item.id, targetSprintId);

      // Fire RPC in background — only refresh on failure to revert
      const rpcPromise = targetSprintId === null
        ? removeFromSprint([item.id])
        : assignToSprint([item.id], targetSprintId);

      rpcPromise.catch(() => {
        onRefreshFallback();
      });
    },
    [moveItem, onRefreshFallback]
  );

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
