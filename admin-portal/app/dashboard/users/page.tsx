import { getAuthenticatedUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UsersPageClient } from './components/UsersPageClient';

export const dynamic = 'force-dynamic';

/**
 * Users Page - Admin Portal
 *
 * Server component that verifies authentication and permissions,
 * then renders the client-side search interface.
 */
export default async function UsersPage() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  // Verify internal role
  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  // Defense-in-depth: verify page-level permission
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'users.view',
  });
  if (!hasPerm) {
    redirect('/dashboard?error=insufficient_permissions');
  }

  return <UsersPageClient />;
}
