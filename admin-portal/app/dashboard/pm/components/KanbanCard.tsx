'use client';

/**
 * KanbanCard -- A draggable card representing a single backlog item.
 *
 * Uses @dnd-kit/sortable's useSortable for drag support.
 * Compact 4-row layout:
 *   Row 1: Checkbox + #item_number | Priority pill (inline editable)
 *   Row 2-3: Title (link, line-clamp-2)
 *   Row 4: Assignee avatar+name (inline editable) | Label pills (inline editable)
 */

import { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { Check, Plus, Loader2 } from 'lucide-react';
import type { PmBacklogItem, ItemPriority, PmLabel } from '@/lib/pm-types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/pm-types';
import {
  updateItemField,
  assignItem,
  addItemLabel,
  removeItemLabel,
} from '@/lib/pm-queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignableUser {
  id: string;
  display_name: string | null;
  email: string;
}

interface KanbanCardProps {
  item: PmBacklogItem;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  compact?: boolean;
  onToggleSelect?: () => void;
  onItemUpdated?: () => void;
  users?: AssignableUser[];
  allLabels?: PmLabel[];
}

// Priority dot colors for compact mode
const PRIORITY_DOT_COLORS: Record<ItemPriority, string> = {
  low: 'bg-gray-300',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// PriorityDropdown
// ---------------------------------------------------------------------------

function PriorityDropdown({
  priority,
  onUpdate,
}: {
  priority: ItemPriority;
  onUpdate: (p: ItemPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[priority]}`}
      >
        {PRIORITY_LABELS[priority]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-28">
          {(['low', 'medium', 'high', 'critical'] as ItemPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                onUpdate(p);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1 text-xs hover:bg-gray-50"
            >
              <span
                className={`inline-block px-1.5 py-0.5 rounded ${PRIORITY_COLORS[p]}`}
              >
                {PRIORITY_LABELS[p]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssigneeDropdown
// ---------------------------------------------------------------------------

function AssigneeDropdown({
  assigneeId,
  users,
  onUpdate,
}: {
  assigneeId: string | null;
  users: AssignableUser[];
  onUpdate: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentUser = users.find((u) => u.id === assigneeId);
  const initials = currentUser
    ? (currentUser.display_name || currentUser.email)
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
      >
        {currentUser ? (
          <>
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-blue-700 font-medium">
                {initials}
              </span>
            </div>
            <span className="truncate max-w-[80px]">
              {currentUser.display_name || currentUser.email}
            </span>
          </>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-48 max-h-48 overflow-y-auto">
          <button
            onClick={() => {
              onUpdate(null);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-400"
          >
            Unassigned
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                onUpdate(user.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${
                user.id === assigneeId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <span className="truncate">
                {user.display_name || user.email}
              </span>
              {user.id === assigneeId && (
                <Check className="h-3 w-3 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineLabelPicker
// ---------------------------------------------------------------------------

function InlineLabelPicker({
  itemId,
  currentLabels,
  allLabels,
  onUpdate,
}: {
  itemId: string;
  currentLabels: PmLabel[];
  allLabels: PmLabel[];
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const currentLabelIds = new Set(currentLabels.map((l) => l.id));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleToggleLabel(label: PmLabel) {
    setUpdating(label.id);
    try {
      if (currentLabelIds.has(label.id)) {
        await removeItemLabel(itemId, label.id);
      } else {
        await addItemLabel(itemId, label.id);
      }
      onUpdate();
    } catch {
      // Silently fail -- user can retry
    } finally {
      setUpdating(null);
    }
  }

  // Show max 2 labels, then overflow count
  const visibleLabels = currentLabels.slice(0, 2);
  const overflowCount = currentLabels.length - 2;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className="flex items-center gap-1 flex-wrap"
      >
        {visibleLabels.length > 0 ? (
          <>
            {visibleLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: label.color + '20',
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-[10px] text-gray-400">
                +{overflowCount}
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Plus className="h-3 w-3" />
            Label
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-44 max-h-48 overflow-y-auto">
          {allLabels.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">No labels available</p>
          ) : (
            allLabels.map((label) => (
              <button
                key={label.id}
                onClick={() => handleToggleLabel(label)}
                disabled={updating === label.id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="truncate flex-1 text-left">{label.name}</span>
                {currentLabelIds.has(label.id) && (
                  <Check className="h-3 w-3 text-blue-600 shrink-0" />
                )}
                {updating === label.id && (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanCard
// ---------------------------------------------------------------------------

export function KanbanCard({
  item,
  isDragOverlay = false,
  isSelected = false,
  compact = false,
  onToggleSelect,
  onItemUpdated,
  users = [],
  allLabels = [],
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

  // -- Inline edit handlers ------------------------------------------------

  async function handlePriorityUpdate(newPriority: ItemPriority) {
    if (newPriority === item.priority) return;
    try {
      await updateItemField(item.id, 'priority', newPriority);
      onItemUpdated?.();
    } catch {
      // Silently fail
    }
  }

  async function handleAssigneeUpdate(userId: string | null) {
    if (userId === item.assignee_id) return;
    try {
      await assignItem(item.id, userId);
      onItemUpdated?.();
    } catch {
      // Silently fail
    }
  }

  function handleLabelUpdate() {
    onItemUpdated?.();
  }

  // -- Compact layout: single-row title-only view ----------------------------
  if (compact) {
    return (
      <div
        ref={!isDragOverlay ? setNodeRef : undefined}
        style={!isDragOverlay ? style : undefined}
        {...(!isDragOverlay ? attributes : {})}
        {...(!isDragOverlay ? listeners : {})}
        className={`bg-white rounded border px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors flex items-center gap-2 ${
          isSelected
            ? 'ring-2 ring-blue-500 border-blue-300'
            : 'border-gray-200'
        } ${isDragOverlay ? 'shadow-lg rotate-2' : ''}`}
      >
        {/* Priority dot */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT_COLORS[item.priority]}`}
        />
        {/* ID */}
        <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
          #{item.item_number}
        </span>
        {/* Title */}
        <Link
          href={`/dashboard/pm/tasks/${item.id}`}
          className="text-xs text-gray-800 truncate flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          {item.title}
        </Link>
      </div>
    );
  }

  // -- Default layout: full 4-row card ---------------------------------------
  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={`bg-white rounded-lg border p-2.5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-300'
          : 'border-gray-200'
      } ${isDragOverlay ? 'shadow-lg rotate-2' : ''}`}
    >
      {/* Row 1: Checkbox + ID | Priority pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
            />
          )}
          <span className="text-xs text-gray-400 font-mono">
            #{item.item_number}
          </span>
        </div>
        <PriorityDropdown
          priority={item.priority}
          onUpdate={handlePriorityUpdate}
        />
      </div>

      {/* Row 2-3: Title */}
      <Link
        href={`/dashboard/pm/tasks/${item.id}`}
        className="block text-sm font-medium text-gray-900 hover:text-blue-600 mt-1 line-clamp-2"
        onClick={(e) => e.stopPropagation()}
      >
        {item.title}
      </Link>

      {/* Row 4: Assignee | Labels */}
      <div className="flex items-center justify-between mt-2">
        <AssigneeDropdown
          assigneeId={item.assignee_id}
          users={users}
          onUpdate={handleAssigneeUpdate}
        />
        <InlineLabelPicker
          itemId={item.id}
          currentLabels={item.labels || []}
          allLabels={allLabels}
          onUpdate={handleLabelUpdate}
        />
      </div>
    </div>
  );
}
