'use client';

/**
 * useProjectDragDrop -- Encapsulates drag-and-drop logic for the project detail page.
 *
 * Handles:
 * - DnD sensor configuration (PointerSensor 8px + KeyboardSensor)
 * - Drag start/end event handlers
 * - Backlog item → sprint assignment
 * - Sprint item → different sprint reassignment
 * - Sprint item → backlog unassignment
 * - No-op on same-container drops
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
  onRefresh: () => void;
}

export function useProjectDragDrop({ onRefresh }: UseProjectDragDropParams) {
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
    async (event: DragEndEvent) => {
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

      try {
        if (targetContainerId === 'backlog-panel') {
          // Sprint → Backlog: unassign
          await removeFromSprint([item.id]);
        } else {
          // Backlog → Sprint or Sprint → Sprint: assign to target sprint
          await assignToSprint([item.id], targetContainerId);
        }
        onRefresh();
      } catch (err) {
        console.error('Failed to move item:', err);
      }
    },
    [onRefresh]
  );

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
