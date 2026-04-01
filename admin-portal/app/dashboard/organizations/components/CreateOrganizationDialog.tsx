'use client';

/**
 * CreateOrganizationDialog - Modal dialog for creating a new organization.
 *
 * Collects name, max seats, and optional plan assignment.
 * Uses admin_create_organization RPC, then optionally admin_assign_org_plan.
 * Does NOT set the legacy `plan` column on organizations.
 */

import { useState, useEffect, useRef, useId } from 'react';
import { createOrganization, assignOrgPlan, getActivePlansForOrgs, type Plan } from '@/lib/admin-queries';

interface CreateOrganizationDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrganizationDialog({ onClose, onCreated }: CreateOrganizationDialogProps) {
  const [name, setName] = useState('');
  const [maxSeats, setMaxSeats] = useState(5);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [defaultLicenseStatus, setDefaultLicenseStatus] = useState<'trial' | 'active'>('trial');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Load available plans for optional assignment
  useEffect(() => {
    async function loadPlans() {
      const result = await getActivePlansForOrgs();
      if (result.data) {
        setPlans(result.data);
      }
      setIsLoadingPlans(false);
    }
    loadPlans();
  }, []);

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
      setError('Organization name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Step 1: Create the organization
    const result = await createOrganization(name.trim(), maxSeats);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    // Step 2: Optionally assign plan (separate RPC call, not via legacy column)
    if (selectedPlanId && result.data?.id) {
      const planResult = await assignOrgPlan(result.data.id, selectedPlanId);
      if (planResult.error) {
        // Org was created but plan assignment failed — still succeed but warn
        setError(`Organization created, but plan assignment failed: ${planResult.error.message}`);
        setIsLoading(false);
        // Still refresh the list since org was created
        onCreated();
        return;
      }
    }

    onCreated();
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
          Create Organization
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new organization with a name and seat limit.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Organization Name */}
          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Realty"
              disabled={isLoading}
              autoFocus
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Max Seats */}
          <div>
            <label htmlFor="org-max-seats" className="block text-sm font-medium text-gray-700">
              Max Seats
            </label>
            <input
              id="org-max-seats"
              type="number"
              min={1}
              max={1000}
              value={maxSeats}
              onChange={(e) => setMaxSeats(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Optional Plan */}
          <div>
            <label htmlFor="org-plan" className="block text-sm font-medium text-gray-700">
              Plan (optional)
            </label>
            <select
              id="org-plan"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={isLoading || isLoadingPlans}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            >
              <option value="">No plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.tier})
                </option>
              ))}
            </select>
          </div>

          {/* Default License Status */}
          <div>
            <label htmlFor="org-license-status" className="block text-sm font-medium text-gray-700">
              Default License Status
            </label>
            <select
              id="org-license-status"
              value={defaultLicenseStatus}
              onChange={(e) => setDefaultLicenseStatus(e.target.value as 'trial' | 'active')}
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              License status applied to members who join this organization.
            </p>
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
              {isLoading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
