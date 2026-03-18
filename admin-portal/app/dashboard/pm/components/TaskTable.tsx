'use client';

/**
 * TaskTable - PM Backlog
 *
 * Renders the backlog items as a table with pagination.
 * Supports checkbox selection for bulk operations and tree indentation.
 * Each row navigates to the item detail page on click.
 * Column headers are clickable to sort by that column.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { PmBacklogItem, ItemStatus, ItemPriority, ItemType, SortableColumn, SortDirection } from '@/lib/pm-types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
} from '@/lib/pm-types';

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
}

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
}: TaskTableProps) {
  const router = useRouter();

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
                    if (target.closest('a') || target.closest('input')) return;
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={item.type} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {item.assignee_id && userMap?.has(item.assignee_id)
                      ? (userMap.get(item.assignee_id)!.display_name || userMap.get(item.assignee_id)!.email)
                      : <span className="text-gray-300">Unassigned</span>
                    }
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {item.area || '-'}
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
