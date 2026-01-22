'use client';

/**
 * StatusHistory Component
 *
 * Displays a timeline of status changes for a submission.
 * Shows who made the change, when, and any notes.
 */

import { formatDate } from '@/lib/utils';

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
  changed_by?: string;
  notes?: string;
}

interface StatusHistoryProps {
  history: StatusHistoryEntry[];
  currentStatus: string;
  submittedBy?: string;
  submittedAt?: string;
}

/**
 * Get status display info
 */
function getStatusInfo(status: string): { label: string; color: string; bgColor: string; icon: string } {
  const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
    submitted: {
      label: 'Submitted',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    under_review: {
      label: 'Review Started',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    },
    needs_changes: {
      label: 'Changes Requested',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    },
    resubmitted: {
      label: 'Resubmitted',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    },
    approved: {
      label: 'Approved',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    rejected: {
      label: 'Rejected',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  };

  return statusMap[status] || {
    label: status,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };
}

export function StatusHistory({
  history,
  currentStatus,
  submittedBy,
  submittedAt,
}: StatusHistoryProps) {
  // Build timeline entries from history
  const timelineEntries = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );

  // If no history but we have submission info, show at least the initial submission
  if (timelineEntries.length === 0 && submittedAt) {
    timelineEntries.push({
      status: 'submitted',
      changed_at: submittedAt,
      changed_by: submittedBy,
    });
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Status History</h2>
      </div>

      <div className="px-6 py-4">
        {timelineEntries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No history available
          </p>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {timelineEntries.map((entry, idx) => {
                const isLast = idx === timelineEntries.length - 1;
                const statusInfo = getStatusInfo(entry.status);
                const isCurrent = isLast && entry.status === currentStatus;

                return (
                  <li key={idx}>
                    <div className="relative pb-8">
                      {/* Connecting line */}
                      {!isLast && (
                        <span
                          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}

                      <div className="relative flex items-start space-x-3">
                        {/* Icon */}
                        <div>
                          <span
                            className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${statusInfo.bgColor}`}
                          >
                            <svg
                              className={`h-4 w-4 ${statusInfo.color}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={statusInfo.icon}
                              />
                            </svg>
                          </span>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {statusInfo.label}
                                {isCurrent && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                    Current
                                  </span>
                                )}
                              </p>
                              {entry.changed_by && (
                                <p className="mt-0.5 text-sm text-gray-500">
                                  by {entry.changed_by}
                                </p>
                              )}
                            </div>
                            <time className="text-sm text-gray-400">
                              {formatDate(entry.changed_at)}
                            </time>
                          </div>

                          {/* Notes */}
                          {entry.notes && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-md p-3">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
