'use client';

/**
 * SprintList - PM Sprint Table
 *
 * Renders sprints as a table with status badges, date ranges, item counts,
 * and progress bars. Each row links to the sprint detail page.
 * Column headers are clickable to sort by that column.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { PmSprint, SprintSortColumn, SortDirection, SprintStatus } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const STATUS_SORT_ORDER: Record<SprintStatus, number> = {
  active: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
};

function extractSprintNumber(sprint: PmSprint): number {
  if (sprint.legacy_id) {
    const match = sprint.legacy_id.match(/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

function getProgress(sprint: PmSprint): number {
  const completed = sprint.item_counts?.completed ?? 0;
  const total = sprint.total_items ?? 0;
  return total > 0 ? completed / total : 0;
}

function compareSprints(
  a: PmSprint,
  b: PmSprint,
  column: SprintSortColumn,
  direction: SortDirection,
): number {
  const dir = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'name': {
      const numA = extractSprintNumber(a);
      const numB = extractSprintNumber(b);
      if (numA !== 0 || numB !== 0) {
        return (numA - numB) * dir;
      }
      return a.name.localeCompare(b.name) * dir;
    }
    case 'status': {
      return (STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]) * dir;
    }
    case 'start_date': {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : (direction === 'asc' ? Infinity : -Infinity);
      const dateB = b.start_date ? new Date(b.start_date).getTime() : (direction === 'asc' ? Infinity : -Infinity);
      return (dateA - dateB) * dir;
    }
    case 'end_date': {
      const dateA = a.end_date ? new Date(a.end_date).getTime() : (direction === 'asc' ? Infinity : -Infinity);
      const dateB = b.end_date ? new Date(b.end_date).getTime() : (direction === 'asc' ? Infinity : -Infinity);
      return (dateA - dateB) * dir;
    }
    case 'total_items': {
      return ((a.total_items ?? 0) - (b.total_items ?? 0)) * dir;
    }
    case 'progress': {
      return (getProgress(a) - getProgress(b)) * dir;
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Sort icon & header components (mirrors TaskTable pattern)
// ---------------------------------------------------------------------------

interface SprintSortIconProps {
  column: SprintSortColumn;
  currentSort: SprintSortColumn;
  currentDir: SortDirection;
}

function SprintSortIcon({ column, currentSort, currentDir }: SprintSortIconProps) {
  if (currentSort !== column) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 ml-1" />;
  }
  if (currentDir === 'asc') {
    return <ChevronUp className="h-3.5 w-3.5 text-blue-600 ml-1" />;
  }
  return <ChevronDown className="h-3.5 w-3.5 text-blue-600 ml-1" />;
}

interface SprintSortableHeaderProps {
  column: SprintSortColumn;
  label: string;
  sortBy: SprintSortColumn;
  sortDir: SortDirection;
  onSort: (column: SprintSortColumn) => void;
}

function SprintSortableHeader({ column, label, sortBy, sortDir, onSort }: SprintSortableHeaderProps) {
  const isActive = sortBy === column;

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${
        isActive ? 'text-blue-600' : 'text-gray-500'
      }`}
      onClick={() => onSort(column)}
    >
      <div className="inline-flex items-center">
        {label}
        <SprintSortIcon column={column} currentSort={sortBy} currentDir={sortDir} />
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// SprintList component
// ---------------------------------------------------------------------------

interface SprintListProps {
  sprints: PmSprint[];
  loading?: boolean;
}

export function SprintList({ sprints, loading = false }: SprintListProps) {
  const [sortBy, setSortBy] = useState<SprintSortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const handleSort = (column: SprintSortColumn) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'name' ? 'desc' : 'asc');
    }
  };

  const sortedSprints = useMemo(() => {
    return [...sprints].sort((a, b) => compareSprints(a, b, sortBy, sortDir));
  }, [sprints, sortBy, sortDir]);

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

  if (sprints.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No sprints found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SprintSortableHeader column="name" label="Sprint" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SprintSortableHeader column="status" label="Status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SprintSortableHeader column="start_date" label="Dates" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SprintSortableHeader column="total_items" label="Items" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SprintSortableHeader column="progress" label="Progress" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedSprints.map((sprint) => {
              const completed = sprint.item_counts?.completed ?? 0;
              const total = sprint.total_items ?? 0;
              const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <tr key={sprint.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/pm/sprints/${sprint.id}`}
                      className="hover:text-blue-600"
                    >
                      <div className="font-medium text-gray-900">{sprint.name}</div>
                      {sprint.legacy_id && (
                        <span className="text-xs text-gray-400 font-mono">
                          {sprint.legacy_id}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}
                    >
                      {SPRINT_STATUS_LABELS[sprint.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {sprint.start_date || sprint.end_date ? (
                      <span className="text-xs">
                        {sprint.start_date
                          ? new Date(sprint.start_date).toLocaleDateString()
                          : '?'}
                        {' - '}
                        {sprint.end_date
                          ? new Date(sprint.end_date).toLocaleDateString()
                          : '?'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">No dates</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {total}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{progress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
