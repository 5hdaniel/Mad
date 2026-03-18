'use client';

/**
 * TaskTable - PM Backlog
 *
 * Renders the backlog items as a table with pagination.
 * Supports checkbox selection for bulk operations and tree indentation.
 * Each row navigates to the item detail page on click.
 * Column headers are clickable to sort by that column.
 * Status, Priority, Type, Assignee, and Area columns support inline editing.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Check } from 'lucide-react';
import type { PmBacklogItem, ItemStatus, ItemPriority, ItemType, SortableColumn, SortDirection } from '@/lib/pm-types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
  ALLOWED_TRANSITIONS,
} from '@/lib/pm-types';
import {
  updateItemStatus,
  updateItemField,
  assignItem,
} from '@/lib/pm-queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignableUser {
  id: string;
  display_name: string | null;
  email: string;
}

interface TaskTableProps {
  items: PmBacklogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  searchActive?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  treeMode?: boolean;
  sortBy?: SortableColumn | null;
  sortDir?: SortDirection;
  onSort?: (column: SortableColumn) => void;
  /** Build a custom URL for each item row. Defaults to `/dashboard/pm/tasks/${itemId}`. */
  buildItemUrl?: (itemId: string) => string;
  /** Map of user ID -> { display_name, email } for resolving assignee names. */
  userMap?: Map<string, { display_name: string | null; email: string }>;
  /** Callback invoked after any inline edit mutation succeeds. */
  onItemUpdated?: () => void;
  /** List of assignable users for the assignee dropdown. */
  users?: AssignableUser[];
}

// ---------------------------------------------------------------------------
// Inline Dropdown: Status (shows only valid transitions)
// ---------------------------------------------------------------------------

function InlineStatusDropdown({
  itemId,
  status,
  onUpdated,
}: {
  itemId: string;
  status: ItemStatus;
  onUpdated: () => void;
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

  const validTransitions = ALLOWED_TRANSITIONS[status] || [];

  async function handleSelect(newStatus: ItemStatus) {
    setOpen(false);
    if (newStatus === status) return;
    try {
      await updateItemStatus(itemId, newStatus);
      onUpdated();
    } catch {
      // Silently fail - user can retry
    }
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          if (validTransitions.length > 0) setOpen(!open);
        }}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${STATUS_COLORS[status]} ${
          validTransitions.length > 0 ? 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300' : ''
        }`}
        title={validTransitions.length === 0 ? 'No transitions available' : 'Click to change status'}
      >
        {STATUS_LABELS[status]}
      </button>
      {open && validTransitions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-36">
          {validTransitions.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
            >
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}
              >
                {STATUS_LABELS[s]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Dropdown: Priority
// ---------------------------------------------------------------------------

function InlinePriorityDropdown({
  itemId,
  priority,
  onUpdated,
}: {
  itemId: string;
  priority: ItemPriority;
  onUpdated: () => void;
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

  async function handleSelect(newPriority: ItemPriority) {
    setOpen(false);
    if (newPriority === priority) return;
    try {
      await updateItemField(itemId, 'priority', newPriority);
      onUpdated();
    } catch {
      // Silently fail
    }
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 ${PRIORITY_COLORS[priority]}`}
      >
        {PRIORITY_LABELS[priority]}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-28">
          {(['low', 'medium', 'high', 'critical'] as ItemPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => handleSelect(p)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${
                p === priority ? 'bg-blue-50' : ''
              }`}
            >
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[p]}`}
              >
                {PRIORITY_LABELS[p]}
              </span>
              {p === priority && <Check className="h-3 w-3 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Dropdown: Type
// ---------------------------------------------------------------------------

function InlineTypeDropdown({
  itemId,
  type,
  onUpdated,
}: {
  itemId: string;
  type: ItemType;
  onUpdated: () => void;
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

  async function handleSelect(newType: ItemType) {
    setOpen(false);
    if (newType === type) return;
    try {
      await updateItemField(itemId, 'type', newType);
      onUpdated();
    } catch {
      // Silently fail
    }
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 ${TYPE_COLORS[type]}`}
      >
        {TYPE_LABELS[type]}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-28">
          {(['feature', 'bug', 'chore', 'spike', 'epic'] as ItemType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleSelect(t)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between ${
                t === type ? 'bg-blue-50' : ''
              }`}
            >
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t]}`}
              >
                {TYPE_LABELS[t]}
              </span>
              {t === type && <Check className="h-3 w-3 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Dropdown: Assignee
// ---------------------------------------------------------------------------

function InlineAssigneeDropdown({
  itemId,
  assigneeId,
  users,
  userMap,
  onUpdated,
}: {
  itemId: string;
  assigneeId: string | null;
  users: AssignableUser[];
  userMap?: Map<string, { display_name: string | null; email: string }>;
  onUpdated: () => void;
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

  async function handleSelect(userId: string | null) {
    setOpen(false);
    if (userId === assigneeId) return;
    try {
      await assignItem(itemId, userId);
      onUpdated();
    } catch {
      // Silently fail
    }
  }

  const displayName = assigneeId && userMap?.has(assigneeId)
    ? (userMap.get(assigneeId)!.display_name || userMap.get(assigneeId)!.email)
    : null;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className="text-sm text-left cursor-pointer hover:text-blue-600 transition-colors"
      >
        {displayName ? (
          <span className="text-gray-700">{displayName}</span>
        ) : (
          <span className="text-gray-300">Unassigned</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-52 max-h-60 overflow-y-auto">
          <button
            onClick={() => handleSelect(null)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
              !assigneeId ? 'bg-blue-50 text-blue-700' : 'text-gray-400'
            }`}
          >
            Unassigned
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
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
// Inline Text Input: Area
// ---------------------------------------------------------------------------

function InlineAreaEditor({
  itemId,
  area,
  onUpdated,
}: {
  itemId: string;
  area: string | null;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(area || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function handleSave() {
    setEditing(false);
    const newValue = value.trim();
    if (newValue === (area || '')) return;
    try {
      await updateItemField(itemId, 'area', newValue || null);
      onUpdated();
    } catch {
      // Revert on failure
      setValue(area || '');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setValue(area || '');
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-0.5 text-sm text-gray-900 bg-white border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setValue(area || '');
          setEditing(true);
        }}
        className="text-sm text-left cursor-pointer hover:text-blue-600 transition-colors"
      >
        {area ? (
          <span className="text-gray-500">{area}</span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only badges (kept for fallback when no onItemUpdated)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ItemPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function TypeBadge({ type }: { type: ItemType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]}`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return '-';
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}

// ---------------------------------------------------------------------------
// Sort icons and headers
// ---------------------------------------------------------------------------

interface SortIconProps {
  column: SortableColumn;
  currentSort: SortableColumn | null | undefined;
  currentDir: SortDirection | undefined;
}

function SortIcon({ column, currentSort, currentDir }: SortIconProps) {
  if (currentSort !== column) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 ml-1" />;
  }
  if (currentDir === 'asc') {
    return <ChevronUp className="h-3.5 w-3.5 text-blue-600 ml-1" />;
  }
  return <ChevronDown className="h-3.5 w-3.5 text-blue-600 ml-1" />;
}

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  sortBy: SortableColumn | null | undefined;
  sortDir: SortDirection | undefined;
  onSort?: (column: SortableColumn) => void;
}

function SortableHeader({ column, label, sortBy, sortDir, onSort }: SortableHeaderProps) {
  const isActive = sortBy === column;

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${
        isActive ? 'text-blue-600' : 'text-gray-500'
      }`}
      onClick={() => onSort?.(column)}
    >
      <div className="inline-flex items-center">
        {label}
        <SortIcon column={column} currentSort={sortBy} currentDir={sortDir} />
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// TaskTable component
// ---------------------------------------------------------------------------

export function TaskTable({
  items,
  totalCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  loading,
  selectedIds,
  onSelectionChange,
  treeMode,
  sortBy,
  sortDir,
  onSort,
  buildItemUrl,
  userMap,
  onItemUpdated,
  users,
}: TaskTableProps) {
  const router = useRouter();

  // Whether inline editing is enabled (requires callback)
  const editable = !!onItemUpdated;

  function getItemUrl(itemId: string): string {
    if (buildItemUrl) return buildItemUrl(itemId);
    return `/dashboard/pm/tasks/${itemId}`;
  }

  const allSelected = items.length > 0 && selectedIds?.size === items.length &&
    items.every((item) => selectedIds?.has(item.id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((item) => item.id)));
    }
  }

  function toggleItem(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-50 border-b border-gray-200" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-100 px-6 py-4">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No backlog items found.</p>
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const paginationControls = (position: 'top' | 'bottom') => (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${position === 'top' ? 'border-b' : 'border-t'} border-gray-200`}>
      <div className="text-sm text-gray-500">
        Showing {startItem}-{endItem} of {totalCount}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </button>
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {totalPages > 1 && paginationControls('top')}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onSelectionChange && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
              )}
              <SortableHeader column="item_number" label="ID" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="title" label="Title" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="type" label="Type" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="status" label="Status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="priority" label="Priority" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignee
              </th>
              <SortableHeader column="area" label="Area" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="est_tokens" label="Est" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortableHeader column="created_at" label="Created" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => {
              const itemUrl = getItemUrl(item.id);
              return (
                <tr
                  key={item.id}
                  onClick={(e: React.MouseEvent<HTMLTableRowElement>) => {
                    // Don't navigate if clicking a link, checkbox, or interactive element
                    const target = e.target as HTMLElement;
                    if (target.closest('a') || target.closest('input') || target.closest('button') || target.closest('[data-inline-edit]')) return;
                    router.push(itemUrl);
                  }}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {onSelectionChange && (
                    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(item.id) ?? false}
                        onChange={() => toggleItem(item.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    #{item.item_number}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-gray-900 max-w-sm truncate font-medium"
                    style={treeMode && item.parent_id ? { paddingLeft: '2.5rem' } : undefined}
                  >
                    <Link
                      href={itemUrl}
                      className="hover:text-blue-600 hover:underline"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {item.title}
                    </Link>
                    {item.child_count && item.child_count > 0 ? (
                      <span className="ml-2 text-xs text-gray-400">
                        ({item.child_count} children)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" data-inline-edit>
                    {editable ? (
                      <InlineTypeDropdown
                        itemId={item.id}
                        type={item.type}
                        onUpdated={onItemUpdated!}
                      />
                    ) : (
                      <TypeBadge type={item.type} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" data-inline-edit>
                    {editable ? (
                      <InlineStatusDropdown
                        itemId={item.id}
                        status={item.status}
                        onUpdated={onItemUpdated!}
                      />
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" data-inline-edit>
                    {editable ? (
                      <InlinePriorityDropdown
                        itemId={item.id}
                        priority={item.priority}
                        onUpdated={onItemUpdated!}
                      />
                    ) : (
                      <PriorityBadge priority={item.priority} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" data-inline-edit>
                    {editable && users ? (
                      <InlineAssigneeDropdown
                        itemId={item.id}
                        assigneeId={item.assignee_id}
                        users={users}
                        userMap={userMap}
                        onUpdated={onItemUpdated!}
                      />
                    ) : (
                      <span className="text-sm text-gray-500">
                        {item.assignee_id && userMap?.has(item.assignee_id)
                          ? (userMap.get(item.assignee_id)!.display_name || userMap.get(item.assignee_id)!.email)
                          : <span className="text-gray-300">Unassigned</span>
                        }
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" data-inline-edit>
                    {editable ? (
                      <InlineAreaEditor
                        itemId={item.id}
                        area={item.area}
                        onUpdated={onItemUpdated!}
                      />
                    ) : (
                      <span className="text-sm text-gray-500">{item.area || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatTokens(item.est_tokens)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginationControls('bottom')}
    </div>
  );
}
