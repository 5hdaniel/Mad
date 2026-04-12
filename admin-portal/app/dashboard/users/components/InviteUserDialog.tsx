'use client';

/**
 * InviteUserDialog - Modal dialog for inviting a user to Keepr.
 *
 * Collects email, first name, last name, and optionally organization + role.
 * When no organization is selected, invites as an individual user.
 * Shows invite link as fallback if email sending fails.
 *
 * BACKLOG-1492: Admin invite users
 * BACKLOG-1533: Organization optional for individual users
 */

import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { inviteUser } from '@/lib/actions/inviteUser';
import { getActivePlans, type Plan } from '@/lib/admin-queries';

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'broker', label: 'Broker' },
  { value: 'admin', label: 'Admin' },
] as const;

interface Organization {
  id: string;
  name: string;
}

interface InviteUserDialogProps {
  onClose: () => void;
  onInvited: () => void;
}

export function InviteUserDialog({ onClose, onInvited }: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState<'agent' | 'broker' | 'admin'>('agent');
  const [licenseStatus, setLicenseStatus] = useState<'trial' | 'active'>('trial');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    inviteLink: string;
    emailSent: boolean;
  } | null>(null);

  // Organization search state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Plans for individual invite (no org selected)
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const router = useRouter();

  // Load organizations on mount
  useEffect(() => {
    async function loadOrgs() {
      const supabase = createClient();
      const { data } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      setOrganizations(data ?? []);
      setOrgsLoading(false);
    }
    loadOrgs();
  }, []);

  // Load plans for individual invite (all active plans)
  useEffect(() => {
    async function loadPlans() {
      const result = await getActivePlans();
      if (result.data) {
        setPlans(result.data);
      }
      setPlansLoading(false);
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

  // Filter organizations by search term
  const filteredOrgs = useMemo(() => {
    if (!orgSearch.trim()) return organizations;
    const q = orgSearch.toLowerCase();
    return organizations.filter((org) => org.name.toLowerCase().includes(q));
  }, [organizations, orgSearch]);

  const selectedOrgName = useMemo(() => {
    return organizations.find((o) => o.id === organizationId)?.name ?? '';
  }, [organizations, organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Email, first name, and last name are required.');
      return;
    }

    if (!organizationId && !selectedPlanId) {
      setError('Plan is required for individual invites.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsDuplicateError(false);

    const result = await inviteUser({
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      organizationId: organizationId || null,
      licenseStatus,
      planId: !organizationId && selectedPlanId ? selectedPlanId : null,
    });

    if (!result.success) {
      const errMsg = result.error ?? 'Failed to send invitation';
      const isDuplicate = errMsg.includes('pending invitation') || errMsg.includes('already a member');
      setError(errMsg);
      setIsDuplicateError(isDuplicate);
      setIsLoading(false);
      return;
    }

    setSuccessResult({
      inviteLink: result.inviteLink!,
      emailSent: result.emailSent ?? false,
    });
    setIsLoading(false);
  };

  const handleDone = () => {
    onInvited();
    onClose();
  };

  // Success state -- show invite link and email status
  if (successResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={handleDone} />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 outline-none"
        >
          <h3 id={titleId} className="text-lg font-semibold text-gray-900">
            Invitation Sent
          </h3>

          <div className="mt-4 space-y-4">
            {successResult.emailSent ? (
              <div className="rounded-md bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800">
                  Invitation email sent successfully to <strong>{email}</strong>.
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  Email could not be sent. Share the invite link below manually:
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={successResult.inviteLink}
                  className="flex-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-gray-50"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(successResult.inviteLink)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleDone}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form state
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
          Invite User
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Send an invitation to join Keepr. Organization is optional for individual users.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <input
              id="invite-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <input
              id="invite-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          {/* Organization (searchable, optional) */}
          <div>
            <label htmlFor="invite-org" className="block text-sm font-medium text-gray-700">
              Organization <span className="font-normal text-gray-400">(optional)</span>
            </label>
            {orgsLoading ? (
              <p className="mt-1 text-sm text-gray-400">Loading organizations...</p>
            ) : (
              <>
                <input
                  type="text"
                  value={organizationId ? selectedOrgName : orgSearch}
                  onChange={(e) => {
                    setOrgSearch(e.target.value);
                    setOrganizationId('');
                  }}
                  placeholder="Search organizations..."
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                />
                {!organizationId && orgSearch && filteredOrgs.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                    {filteredOrgs.slice(0, 20).map((org) => (
                      <li key={org.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOrganizationId(org.id);
                            setOrgSearch('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                        >
                          {org.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {organizationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrganizationId('');
                      setOrgSearch('');
                    }}
                    className="mt-1 text-xs text-primary-600 hover:text-primary-700"
                  >
                    Change organization
                  </button>
                )}
                {!organizationId && !orgSearch && (
                  <p className="mt-1 text-xs text-gray-400">
                    Leave empty for individual account (no organization)
                  </p>
                )}
              </>
            )}
          </div>

          {/* Role (only shown when organization is selected) */}
          {organizationId && (
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'agent' | 'broker' | 'admin')}
                disabled={isLoading}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Plan (only shown for individual invite — no org selected) */}
          {!organizationId && (
            <div>
              <label htmlFor="invite-plan" className="block text-sm font-medium text-gray-700">
                Plan <span className="text-red-500">*</span>
              </label>
              <select
                id="invite-plan"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                disabled={isLoading || plansLoading}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select a plan...</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.tier})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* License Status */}
          <div>
            <label htmlFor="invite-license-status" className="block text-sm font-medium text-gray-700">
              License Status
            </label>
            <select
              id="invite-license-status"
              value={licenseStatus}
              onChange={(e) => setLicenseStatus(e.target.value as 'trial' | 'active')}
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            isDuplicateError ? (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">{error}</p>
                <p className="mt-1 text-xs text-amber-600">
                  {organizationId ? (
                    <>
                      You can{' '}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          router.push(`/dashboard/organizations/${organizationId}`);
                        }}
                        className="underline font-medium text-amber-700 hover:text-amber-900"
                      >
                        go to the organization page
                      </button>{' '}
                      to resend the invitation.
                    </>
                  ) : (
                    'You can close this dialog and resend the invitation from the users list.'
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )
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
              disabled={isLoading || !email.trim() || !firstName.trim() || !lastName.trim()}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
