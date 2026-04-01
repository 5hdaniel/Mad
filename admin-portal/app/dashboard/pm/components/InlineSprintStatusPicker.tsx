'use client';

/**
 * InlineSprintStatusPicker -- Inline dropdown for changing sprint status.
 *
 * Follows InlineStatusPicker pattern: click-outside handler, dropdown menu, async update.
 * Uses SprintStatus type + SPRINT_STATUS_LABELS/SPRINT_STATUS_COLORS from pm-types.
 * Calls updateSprintStatus (dedicated RPC, not updateSprintField).
 * Gated behind PM_MANAGE permission -- renders read-only badge otherwise.
 */

import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { SprintStatus } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';
import { updateSprintStatus } from '@/lib/pm-queries';

const ALL_SPRINT_STATUSES: SprintStatus[] = ['planned', 'active', 'completed', 'cancelled'];

interface InlineSprintStatusPickerProps {
  sprintId: string;
  status: SprintStatus;
  canEdit: boolean;
  onUpdated: () => void;
}

export function InlineSprintStatusPicker({
  sprintId,
  status,
  canEdit,
  onUpdated,
}: InlineSprintStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const options = ALL_SPRINT_STATUSES.filter((s) => s !== status);

  async function handleSelect(newStatus: SprintStatus) {
    setOpen(false);
    setError(null);
    if (newStatus === status) return;
    try {
      await updateSprintStatus(sprintId, newStatus);
      onUpdated();
    } catch (err) {
      console.error('Failed to update sprint status:', err);
      setError('Failed to update status');
    }
  }

  // Read-only badge for users without PM_MANAGE
  if (!canEdit) {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[status]}`}
      >
        {SPRINT_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${SPRINT_STATUS_COLORS[status]} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300`}
        title="Click to change status"
      >
        {SPRINT_STATUS_LABELS[status]}
      </button>
      {error && (
        <span className="absolute top-full left-0 mt-1 text-xs text-red-500 whitespace-nowrap">
          {error}
        </span>
      )}
      {open && options.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-36">
          {options.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
            >
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${SPRINT_STATUS_COLORS[s]}`}
              >
                {SPRINT_STATUS_LABELS[s]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
