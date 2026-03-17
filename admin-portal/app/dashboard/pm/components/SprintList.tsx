'use client';

/**
 * SprintList - PM Sprint Table
 *
 * Renders sprints as a table with status badges, date ranges, item counts,
 * and progress bars. Each row links to the sprint detail page.
 */

import Link from 'next/link';
import type { PmSprint } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';

interface SprintListProps {
  sprints: PmSprint[];
  loading?: boolean;
}

export function SprintList({ sprints, loading = false }: SprintListProps) {
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sprint
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sprints.map((sprint) => {
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
