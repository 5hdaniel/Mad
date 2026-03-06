/**
 * Settings Page - Internal User Management
 *
 * Server component that fetches the list of internal users and renders
 * the management UI. Add/remove operations use RPCs via client components.
 */

import { createClient } from '@/lib/supabase/server';
import { InternalUsersManager } from './components/InternalUsersManager';

export interface InternalUser {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_by_email: string | null;
}

async function getInternalUsers(): Promise<InternalUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('internal_roles')
    .select(`
      id,
      user_id,
      role,
      created_at,
      updated_at,
      created_by,
      user:users!internal_roles_user_id_fkey (
        email,
        display_name,
        avatar_url
      ),
      creator:users!internal_roles_created_by_fkey (
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch internal users:', error.message);
    return [];
  }

  // Flatten the joined data
  return (data || []).map((row: Record<string, unknown>) => {
    const user = row.user as Record<string, unknown> | null;
    const creator = row.creator as Record<string, unknown> | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      role: row.role as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by: row.created_by as string | null,
      email: user?.email as string | null ?? null,
      display_name: user?.display_name as string | null ?? null,
      avatar_url: user?.avatar_url as string | null ?? null,
      created_by_email: creator?.email as string | null ?? null,
    };
  });
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export default async function SettingsPage() {
  const [internalUsers, currentUserId] = await Promise.all([
    getInternalUsers(),
    getCurrentUserId(),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage internal users who have access to the admin portal.
        </p>
      </div>

      <InternalUsersManager
        initialUsers={internalUsers}
        currentUserId={currentUserId}
      />
    </div>
  );
}
