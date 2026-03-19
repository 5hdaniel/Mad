'use client';

/**
 * KanbanBoard -- Pure layout component rendering status columns.
 *
 * The DndContext is managed by the parent page so that both the board columns
 * AND the BacklogSidePanel share the same drag-and-drop context.
 *
 * Exports COLUMN_ORDER, COLUMN_IDS, and columnCollision for the parent to use.
 */

import {
  pointerWithin,
  closestCenter,
  type CollisionDetection,
} from '@dnd-kit/core';
import type { PmBacklogItem, ItemStatus, BoardColumns, PmLabel } from '@/lib/pm-types';
import { KanbanColumn } from './KanbanColumn';
import type { AssignableUser } from './KanbanCard';

/** Statuses that appear as board columns (subset of ItemStatus). */
type BoardStatus = keyof BoardColumns;

// Board columns in display order (all statuses so no items disappear)
export const COLUMN_ORDER: BoardStatus[] = [
  'pending',
  'in_progress',
  'testing',
  'completed',
  'blocked',
  'deferred',
  'obsolete',
  'reopened',
];

/** Set of valid column IDs for quick lookup. */
export const COLUMN_IDS = new Set<string>(COLUMN_ORDER);

/** Custom collision: prefer pointerWithin (exact hit), fall back to closestCenter. */
export const columnCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  return closestCenter(args);
};

/** Resolve an over-target ID to its column status.
 *  If the ID is a column status directly, return it.
 *  If the ID is a swim lane cell ("groupKey::status"), extract the status part.
 *  Otherwise, find which column contains the item with that ID. */
export function resolveColumnStatus(
  overId: string,
  columns: BoardColumns
): ItemStatus | null {
  if (COLUMN_IDS.has(overId)) return overId as ItemStatus;
  // Handle swim lane droppable IDs formatted as "groupKey::status"
  if (overId.includes('::')) {
    const status = overId.split('::')[1];
    if (status && COLUMN_IDS.has(status)) return status as ItemStatus;
  }
  // overId is a card ID — find which column it belongs to
  for (const [status, items] of Object.entries(columns)) {
    if ((items as PmBacklogItem[]).some((i) => i.id === overId)) {
      return status as ItemStatus;
    }
  }
  return null;
}

interface KanbanBoardProps {
  columns: BoardColumns;
  onQuickAdd?: (title: string, status: ItemStatus) => Promise<void>;
  /** Optional: items currently selected for bulk actions */
  selectedIds?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
  onItemUpdated?: () => void;
  users?: AssignableUser[];
  allLabels?: PmLabel[];
  /** When true, cards render in compact (title-only) mode */
  compact?: boolean;
}

export function KanbanBoard({
  columns,
  onQuickAdd,
  selectedIds,
  onToggleSelect,
  onItemUpdated,
  users,
  allLabels,
  compact,
}: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]">
      {COLUMN_ORDER.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          items={columns[status] || []}
          onQuickAdd={
            onQuickAdd ? (title) => onQuickAdd(title, status) : undefined
          }
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onItemUpdated={onItemUpdated}
          users={users}
          allLabels={allLabels}
          compact={compact}
        />
      ))}
    </div>
  );
}
