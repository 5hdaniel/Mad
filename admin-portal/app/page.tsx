import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Root page - redirects to /dashboard if authenticated with internal role,
 * otherwise redirects to /login
 */
export default async function Home() {
  const { supabase, user } = await getAuthenticatedUser();

  if (user) {
    const { data: internalRole } = await supabase
      .from('internal_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .single();

    if (internalRole) {
      redirect('/dashboard');
    }
  }

  redirect('/login');
}
