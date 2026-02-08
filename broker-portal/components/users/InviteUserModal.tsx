'use client';

/**
 * Invite User Modal Component
 *
 * Modal dialog for inviting new members to the organization.
 * Includes email input, role selection, and displays invite link on success.
 *
 * TASK-1810: Invite user modal and server action
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteUser } from '@/lib/actions/inviteUser';
import { ASSIGNABLE_ROLES_BY_ADMIN, ROLE_LABELS } from '@/lib/types/users';
import type { Role } from '@/lib/types/users';

// ============================================================================
// Types
// ============================================================================

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

// Roles that can be assigned via invite (excludes it_admin)
type InvitableRole = 'agent' | 'broker' | 'admin';

// ============================================================================
// Component
// ============================================================================

export default function InviteUserModal({
  isOpen,
  onClose,
  organizationId,
}: InviteUserModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('agent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await inviteUser({
        email,
        role,
        organizationId,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.inviteLink) {
        setInviteLink(result.inviteLink);
        router.refresh(); // Refresh the user list
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('agent');
    setError(null);
    setInviteLink(null);
    setCopied(false);
    onClose();
  };

  const handleCopyLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        setError('Failed to copy. Please select and copy manually.');
      }
    }
  };

  if (!isOpen) return null;

  // Filter to only invitable roles (agent, broker, admin - not it_admin)
  const invitableRoles = ASSIGNABLE_ROLES_BY_ADMIN.filter(
    (r): r is InvitableRole => r !== 'it_admin'
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Invite Team Member
          </h2>

          {inviteLink ? (
            // Success state - show invite link
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium">Invitation Created</span>
              </div>

              <p className="text-sm text-gray-600">
                Share this link with {email}:
              </p>

              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <p className="break-all text-sm text-gray-800 font-mono">
                  {inviteLink}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // Form state
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email input */}
              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="invite-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
                  placeholder="colleague@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Role select */}
              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-sm font-medium text-gray-700"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvitableRole)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
                >
                  {invitableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r as Role]} - {getRoleDescription(r)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a short description for each role
 */
function getRoleDescription(role: InvitableRole): string {
  switch (role) {
    case 'agent':
      return 'Can submit transactions';
    case 'broker':
      return 'Can review submissions';
    case 'admin':
      return 'Full organization access';
    default:
      return '';
  }
}
