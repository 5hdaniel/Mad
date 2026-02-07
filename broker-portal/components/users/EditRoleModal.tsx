'use client';

/**
 * Edit Role Modal Component
 *
 * Modal dialog for changing an organization member's role.
 * Shows role options filtered by current user's permissions.
 *
 * TASK-1811: Edit user role modal
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from '@/lib/actions/updateUserRole';
import {
  ASSIGNABLE_ROLES_BY_ADMIN,
  ASSIGNABLE_ROLES_BY_IT_ADMIN,
  ROLE_LABELS,
} from '@/lib/types/users';
import type { Role } from '@/lib/types/users';

// ============================================================================
// Types
// ============================================================================

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentRole: Role;
  currentUserRole: Role;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a short description for each role
 */
function getRoleDescription(role: Role): string {
  switch (role) {
    case 'agent':
      return 'Can submit transactions';
    case 'broker':
      return 'Can review submissions';
    case 'admin':
      return 'Full organization access';
    case 'it_admin':
      return 'SSO/SCIM management';
    default:
      return '';
  }
}

/**
 * Get available roles based on current user's role
 */
function getAvailableRoles(currentUserRole: Role): Role[] {
  if (currentUserRole === 'it_admin') {
    return [...ASSIGNABLE_ROLES_BY_IT_ADMIN];
  }
  return [...ASSIGNABLE_ROLES_BY_ADMIN];
}

// ============================================================================
// Component
// ============================================================================

export default function EditRoleModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  currentRole,
  currentUserRole,
}: EditRoleModalProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableRoles = getAvailableRoles(currentUserRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // No change needed
    if (selectedRole === currentRole) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updateUserRole({
        memberId,
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
    setSelectedRole(currentRole);
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
            Change Role for {memberName}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current role display */}
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-600">
                Current role: <span className="font-medium">{ROLE_LABELS[currentRole]}</span>
              </p>
            </div>

            {/* Role select */}
            <div>
              <label
                htmlFor="edit-role"
                className="block text-sm font-medium text-gray-700"
              >
                New Role
              </label>
              <select
                id="edit-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]} - {getRoleDescription(role)}
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
                disabled={isSubmitting || selectedRole === currentRole}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
