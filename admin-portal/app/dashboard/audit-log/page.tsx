import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AuditLogContent } from './AuditLogContent';

export const dynamic = 'force-dynamic';

/**
 * Audit Log Page - Admin Portal
 *
 * Server component that verifies authentication and permissions,
 * then renders the client-side audit log viewer.
 */
export default async function AuditLogPage() {
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    required_permission: 'audit.view',
  });
  if (!hasPerm) {
    redirect('/dashboard?error=insufficient_permissions');
  }

  return <AuditLogContent />;
}
