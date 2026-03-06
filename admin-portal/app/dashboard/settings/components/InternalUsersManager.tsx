'use client';

/**
 * InternalUsersManager - Client component that orchestrates the
 * internal users table, add form, and remove dialog.
 *
 * Handles state management and data refresh after mutations.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { InternalUser } from '../page';
import { InternalUsersTable } from './InternalUsersTable';
import { AddInternalUserForm } from './AddInternalUserForm';
import { RemoveUserDialog } from './RemoveUserDialog';

interface InternalUsersManagerProps {
  initialUsers: InternalUser[];
  currentUserId: string | null;
}

export function InternalUsersManager({ initialUsers, currentUserId }: InternalUsersManagerProps) {
  const router = useRouter();
  const [userToRemove, setUserToRemove] = useState<InternalUser | null>(null);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleRemoveClick = useCallback((user: InternalUser) => {
    setUserToRemove(user);
  }, []);

  const handleRemoveComplete = useCallback(() => {
    setUserToRemove(null);
    router.refresh();
  }, [router]);

  const handleRemoveCancel = useCallback(() => {
    setUserToRemove(null);
  }, []);

  return (
    <div className="space-y-6">
      <AddInternalUserForm onSuccess={handleRefresh} />

      <InternalUsersTable
        users={initialUsers}
        currentUserId={currentUserId}
        onRemoveClick={handleRemoveClick}
      />

      {userToRemove && (
        <RemoveUserDialog
          user={userToRemove}
          onConfirm={handleRemoveComplete}
          onCancel={handleRemoveCancel}
        />
      )}
    </div>
  );
}
