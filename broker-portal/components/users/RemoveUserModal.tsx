'use client';

/**
 * Remove User Modal Component
 *
 * Confirmation dialog for removing a user or revoking an invitation.
 * Shows warning about permanent removal and calls removeUser action.
 *
 * TASK-1812: Deactivate/Remove user flow
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeUser } from '@/lib/actions/removeUser';

interface RemoveUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  isPending: boolean;
}

export default function RemoveUserModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  isPending,
}: RemoveUserModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await removeUser({ memberId });

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isPending ? 'Revoke Invitation' : 'Remove User'}
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            {isPending ? (
              <>Are you sure you want to revoke the invitation for <strong>{memberName}</strong>?</>
            ) : (
              <>Are you sure you want to remove <strong>{memberName}</strong> from the organization?</>
            )}
          </p>

          {!isPending && (
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. The user will need to be re-invited.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 mb-4" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isSubmitting}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Removing...' : (isPending ? 'Revoke' : 'Remove')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
