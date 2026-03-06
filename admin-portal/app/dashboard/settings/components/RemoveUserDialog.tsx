'use client';

/**
 * RemoveUserDialog - Confirmation dialog before removing internal user(s)
 *
 * Supports removing a single user or multiple users in bulk.
 * Shows user details for single removal, or a count summary for bulk removal.
 * Calls admin_remove_internal_user RPC for each user sequentially and
 * handles partial failures gracefully.
 */

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { InternalUser } from '../page';

interface RemoveUserDialogProps {
  users: InternalUser[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveUserDialog({ users, onConfirm, onCancel }: RemoveUserDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isBulk = users.length > 1;

  // Focus the dialog container on mount for focus management
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isRemoving) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRemoving, onCancel]);

  async function handleRemove() {
    setError(null);
    setIsRemoving(true);

    const supabase = createClient();
    const failures: string[] = [];

    if (isBulk) {
      setProgress({ done: 0, total: users.length });
    }

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        const { error: rpcError } = await supabase.rpc('admin_remove_internal_user', {
          p_user_id: user.user_id,
        });

        if (rpcError) {
          const name = user.display_name || user.email || 'Unknown User';
          failures.push(`${name}: ${rpcError.message}`);
        }
      } catch (err) {
        const name = user.display_name || user.email || 'Unknown User';
        failures.push(`${name}: ${err instanceof Error ? err.message : 'Unexpected error'}`);
      }

      if (isBulk) {
        setProgress({ done: i + 1, total: users.length });
      }
    }

    if (failures.length > 0 && failures.length === users.length) {
      // All failed
      setError(failures.join('\n'));
      setIsRemoving(false);
      setProgress(null);
      return;
    }

    if (failures.length > 0) {
      // Partial failure — some succeeded, refresh and show errors
      setError(`Removed ${users.length - failures.length} of ${users.length} users. Failures:\n${failures.join('\n')}`);
      // Still call onConfirm to refresh the list (some users were removed)
      setTimeout(() => onConfirm(), 2000);
      return;
    }

    onConfirm();
  }

  // Single-user display
  const singleUser = users[0];
  const displayName = singleUser
    ? singleUser.display_name || singleUser.email || 'Unknown User'
    : 'Unknown User';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isRemoving ? onCancel : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-user-dialog-title"
        tabIndex={-1}
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 outline-none"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 id="remove-user-dialog-title" className="text-lg font-semibold text-gray-900">
              {isBulk ? `Remove ${users.length} Internal Users` : 'Remove Internal User'}
            </h3>

            {isBulk ? (
              <>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to remove <span className="font-medium text-gray-700">{users.length} users</span> from
                  the internal users? They will all lose access to the admin portal.
                </p>
                <ul className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {users.map((u) => (
                    <li key={u.id} className="text-sm text-gray-600">
                      {u.display_name || u.email || 'Unknown User'}
                      <span className="text-gray-400 ml-1">({u.role_name})</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to remove <span className="font-medium text-gray-700">{displayName}</span> from
                  the internal users? They will lose access to the admin portal.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Current role: <span className="font-medium">{singleUser?.role_name}</span>
                </p>
              </>
            )}

            {progress && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Removing users...</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
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
            {isRemoving
              ? 'Removing...'
              : (isBulk ? `Remove ${users.length} Users` : 'Remove User')}
          </button>
        </div>
      </div>
    </div>
  );
}
