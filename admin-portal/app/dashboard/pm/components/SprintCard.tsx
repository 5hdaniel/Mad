'use client';

/**
 * SprintCard - PM Sprint Summary
 *
 * Card representation of a single sprint showing name, goal, status badge,
 * date range, progress bar, and item count breakdown by status.
 */

import type { PmSprint } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';
import { Calendar, Target, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface SprintCardProps {
  sprint: PmSprint;
}

export function SprintCard({ sprint }: SprintCardProps) {
  const counts = sprint.item_counts ?? {};
  const total = sprint.total_items ?? 0;
  const completed = counts.completed ?? 0;
  const inProgress = counts.in_progress ?? 0;
  const blocked = counts.blocked ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{sprint.name}</h2>
          {sprint.goal && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Target className="h-4 w-4 flex-shrink-0" />
              <span className="line-clamp-2">{sprint.goal}</span>
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}
        >
          {SPRINT_STATUS_LABELS[sprint.status]}
        </span>
      </div>

      {/* Date range */}
      {(sprint.start_date || sprint.end_date) && (
        <div className="flex items-center gap-1 mt-3 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          {sprint.start_date
            ? new Date(sprint.start_date).toLocaleDateString()
            : '?'}
          {' - '}
          {sprint.end_date
            ? new Date(sprint.end_date).toLocaleDateString()
            : '?'}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-700">
            {completed}/{total} items ({progress}%)
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{completed}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{inProgress}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{blocked}</div>
            <div className="text-xs text-gray-500">Blocked</div>
          </div>
        </div>
      </div>
    </div>
  );
}
