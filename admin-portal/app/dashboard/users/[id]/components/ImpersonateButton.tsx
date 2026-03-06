'use client';

/**
 * ImpersonateButton - Start an impersonation session for a user.
 *
 * Only visible to users with the users.impersonate permission.
 * Opens the impersonation view page in a new tab.
 */

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';

interface ImpersonateButtonProps {
  userId: string;
  userName: string;
}

export function ImpersonateButton({ userId, userName }: ImpersonateButtonProps) {
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(false);

  if (!hasPermission(PERMISSIONS.USERS_IMPERSONATE)) return null;

  async function handleImpersonate() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('admin_start_impersonation', {
        p_target_user_id: userId,
      });

      if (error) {
        alert(error.message);
        return;
      }

      const result = data as { success: boolean; session_id: string; token: string };
      if (result?.success) {
        // Open impersonation view in new tab
        window.open(`/dashboard/impersonate/${result.session_id}`, '_blank');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start impersonation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleImpersonate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
      title={`View as ${userName}`}
    >
      <Eye className="h-4 w-4" />
      {loading ? 'Starting...' : 'View as User'}
    </button>
  );
}
