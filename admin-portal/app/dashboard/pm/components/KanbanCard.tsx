'use client';

/**
 * KanbanCard -- A draggable card representing a single backlog item.
 *
 * Uses @dnd-kit/sortable's useSortable for drag support.
 * Shows title, legacy_id, priority badge, assignee initials, and labels.
 * Clicking the title navigates to the task detail page.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { PmBacklogItem } from '@/lib/pm-types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/pm-types';

interface KanbanCardProps {
  item: PmBacklogItem;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function KanbanCard({
  item,
  isDragOverlay = false,
  isSelected = false,
  onToggleSelect,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-300'
          : 'border-gray-200'
      } ${isDragOverlay ? 'shadow-lg rotate-2' : ''}`}
    >
      {/* Checkbox for bulk select */}
      {onToggleSelect && (
        <div className="mb-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
          />
        </div>
      )}

      {/* Item number */}
      <span className="text-xs text-gray-400 font-mono">
        #{item.item_number}
      </span>

      {/* Title (link to detail) */}
      <Link
        href={`/dashboard/pm/tasks/${item.id}`}
        className="block text-sm font-medium text-gray-900 hover:text-blue-600 mt-0.5 line-clamp-2"
        onClick={(e) => e.stopPropagation()}
      >
        {item.title}
      </Link>

      {/* Bottom row: priority + assignee */}
      <div className="flex items-center justify-between mt-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>

        {/* Assignee initials circle (placeholder) */}
        {item.assignee_id && (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-500 font-medium">A</span>
          </div>
        )}
      </div>

      {/* Labels */}
      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
              style={{
                backgroundColor: label.color + '20',
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
          {item.labels.length > 3 && (
            <span className="text-xs text-gray-400">
              +{item.labels.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
