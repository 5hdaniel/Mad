'use client';

/**
 * Deactivate User Modal Component
 *
 * Confirmation dialog for deactivating (suspending) a user.
 * Shows warning about access removal and calls deactivateUser action.
 *
 * TASK-1812: Deactivate/Remove user flow
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deactivateUser } from '@/lib/actions/deactivateUser';

interface DeactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

export default function DeactivateUserModal({
  isOpen,
  onClose,
  memberId,
  memberName,
}: DeactivateUserModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await deactivateUser({ memberId });

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
            Deactivate User
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to deactivate <strong>{memberName}</strong>?
            They will no longer be able to access the broker portal or submit transactions.
          </p>

          <p className="text-sm text-gray-500 mb-6">
            You can reactivate this user later if needed.
          </p>

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
              onClick={handleDeactivate}
              disabled={isSubmitting}
              className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
