'use client';

/**
 * CreateSprintDialog - PM Module
 *
 * Modal dialog for creating new sprints.
 * Fields: name (required), goal, start date, end date.
 *
 * Pattern: Follows CreateTaskDialog.tsx conventions.
 */

import { useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createSprint } from '@/lib/pm-queries';

interface CreateSprintDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const INPUT_CLASS =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

export function CreateSprintDialog({
  open,
  onClose,
  onCreated,
}: CreateSprintDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const resetForm = useCallback(() => {
    setName('');
    setGoal('');
    setStartDate('');
    setEndDate('');
    setError(null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createSprint(
        name,
        goal || null,
        null, // projectId
        startDate || null,
        endDate || null
      );
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sprint');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create Sprint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className={LABEL_CLASS}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="e.g. Sprint 42"
              autoFocus
            />
          </div>

          {/* Goal */}
          <div>
            <label className={LABEL_CLASS}>Goal</label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="What should this sprint achieve? (optional)"
            />
          </div>

          {/* Start Date + End Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
