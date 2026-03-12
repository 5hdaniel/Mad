'use client';

/**
 * CreatePlanDialog - Modal dialog for creating a new plan.
 *
 * Collects name, tier, and optional description.
 * Uses the ConfirmationDialog pattern for consistent modal behavior.
 */

import { useState, useEffect, useRef, useId } from 'react';
import { createPlan } from '@/lib/admin-queries';

const TIER_OPTIONS = ['trial', 'pro', 'enterprise', 'custom'] as const;

interface CreatePlanDialogProps {
  onClose: () => void;
  onCreated: (planId?: string) => void;
}

export function CreatePlanDialog({ onClose, onCreated }: CreatePlanDialogProps) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<string>('trial');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Plan name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createPlan(name.trim(), tier, description.trim() || undefined);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    const planId = (result.data as unknown as Record<string, unknown>)?.id as string | undefined;
    onCreated(planId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 outline-none"
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">
          Create New Plan
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Define a new subscription plan with a name and tier.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Plan Name */}
          <div>
            <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700">
              Plan Name
            </label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Professional"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Tier */}
          <div>
            <label htmlFor="plan-tier" className="block text-sm font-medium text-gray-700">
              Tier
            </label>
            <select
              id="plan-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            >
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this plan..."
              rows={3}
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
