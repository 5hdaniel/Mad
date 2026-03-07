'use server';

/**
 * TASK-2062: Sign Out All Devices server action.
 * Calls Supabase global sign-out to invalidate all sessions
 * (desktop instances, other browser tabs, everything).
 * After sign-out, redirects to the login page.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { blockWriteDuringImpersonation } from '@/lib/impersonation-guards';

export async function signOutAllDevices(): Promise<{ success: boolean; error?: string }> {
  // Block during impersonation (read-only session)
  const blocked = await blockWriteDuringImpersonation();
  if (blocked) return { success: false, error: blocked.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({ scope: 'global' });

  if (error) {
    return { success: false, error: error.message };
  }

  redirect('/login');
}
