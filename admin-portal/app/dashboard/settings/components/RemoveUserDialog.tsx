'use client';

/**
 * RemoveUserDialog - Confirmation dialog before removing an internal user
 *
 * Shows user details and requires confirmation before calling
 * admin_remove_internal_user RPC.
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { InternalUser } from '../page';

interface RemoveUserDialogProps {
  user: InternalUser;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveUserDialog({ user, onConfirm, onCancel }: RemoveUserDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setError(null);
    setIsRemoving(true);

    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('admin_remove_internal_user', {
        p_user_id: user.user_id,
      });

      if (rpcError) {
        setError(rpcError.message || 'Failed to remove user');
        setIsRemoving(false);
        return;
      }

      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsRemoving(false);
    }
  }

  const displayName = user.display_name || user.email || 'Unknown User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isRemoving ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Remove Internal User
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to remove <span className="font-medium text-gray-700">{displayName}</span> from
              the internal users? They will lose access to the admin portal.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Current role: <span className="font-medium">{user.role_name}</span>
            </p>

            {error && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isRemoving}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRemoving ? 'Removing...' : 'Remove User'}
          </button>
        </div>
      </div>
    </div>
  );
}
