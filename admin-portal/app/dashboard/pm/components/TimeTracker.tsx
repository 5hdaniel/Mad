'use client';

/**
 * TimeTracker - PM Item Time Tracking
 *
 * Displays total time logged, list of entries, and an inline form
 * to add new time entries. Users can delete their own entries.
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, Plus } from 'lucide-react';
import { addTimeEntry, listTimeEntries, deleteTimeEntry } from '@/lib/pm-queries';
import type { PmTimeEntry, TimeEntriesResponse } from '@/lib/pm-types';

// -- Props -------------------------------------------------------------------

interface TimeTrackerProps {
  itemId: string;
}

// -- Helpers -----------------------------------------------------------------

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// -- Component ---------------------------------------------------------------

export function TimeTracker({ itemId }: TimeTrackerProps) {
  const [entries, setEntries] = useState<PmTimeEntry[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const data: TimeEntriesResponse = await listTimeEntries(itemId);
      setEntries(data.entries);
      setTotalMinutes(data.total_minutes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const totalDuration = h * 60 + m;

    if (totalDuration <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await addTimeEntry(itemId, totalDuration, description || undefined);
      setHours('');
      setMinutes('');
      setDescription('');
      setShowForm(false);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add time entry');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    setDeletingId(entryId);
    setError(null);
    try {
      await deleteTimeEntry(entryId);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete time entry');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with total */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time Tracked
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {loading ? '...' : formatDuration(totalMinutes)}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Entries list */}
      <div className="divide-y divide-gray-100">
        {!loading && entries.length === 0 && (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-gray-400">No time logged</p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="px-4 py-3 group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDuration(entry.duration_minutes)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {entry.user_name}
                </div>
                {entry.description && (
                  <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={deletingId === entry.id}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all disabled:opacity-50"
                title="Delete entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add time form or button */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Hours</label>
              <input
                type="number"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What did you work on?"
              className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Log Time'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setHours('');
                setMinutes('');
                setDescription('');
                setError(null);
              }}
              className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Time
          </button>
        </div>
      )}
    </div>
  );
}
