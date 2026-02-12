'use client';

/**
 * Bulk Edit Role Modal Component
 *
 * Modal for changing the role of multiple users at once.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { bulkUpdateRole } from '@/lib/actions/bulkUpdateRole';
import { ROLE_LABELS, ASSIGNABLE_ROLES_BY_ADMIN, ASSIGNABLE_ROLES_BY_IT_ADMIN } from '@/lib/types/users';
import type { Role } from '@/lib/types/users';

interface BulkEditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberIds: string[];
  memberCount: number;
  currentUserRole: Role;
}

export default function BulkEditRoleModal({
  isOpen,
  onClose,
  memberIds,
  memberCount,
  currentUserRole,
}: BulkEditRoleModalProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('agent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get assignable roles based on current user's role
  const assignableRoles =
    currentUserRole === 'it_admin'
      ? ASSIGNABLE_ROLES_BY_IT_ADMIN
      : ASSIGNABLE_ROLES_BY_ADMIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await bulkUpdateRole({
        memberIds,
        newRole: selectedRole,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRole('agent');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

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
            Change Role for {memberCount} User{memberCount !== 1 ? 's' : ''}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="bulk-role"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New Role
              </label>
              <select
                id="bulk-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm text-gray-500">
              This will change the role for all {memberCount} selected user
              {memberCount !== 1 ? 's' : ''} to {ROLE_LABELS[selectedRole]}.
            </p>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

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
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
