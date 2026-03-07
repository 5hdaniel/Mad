/**
 * Impersonation Guards - Server-side helpers
 *
 * Provides reusable guards for:
 * 1. Checking if a request is during impersonation
 * 2. Getting a Supabase client that queries data for the target user
 * 3. Blocking write operations during impersonation sessions
 *
 * TASK-2125: Impersonation E2E Read-Only Enforcement
 */

import { getImpersonationSession, type ImpersonationSession } from './impersonation';
import { createServiceClient } from './supabase/service';
import { createClient } from './supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the appropriate Supabase client for data loading.
 *
 * During impersonation: returns the service role client (bypasses RLS)
 * along with the target_user_id for filtering queries.
 *
 * Normal session: returns the standard server client with no target override.
 */
export async function getDataClient(): Promise<{
  client: SupabaseClient;
  impersonation: ImpersonationSession | null;
  targetUserId: string | null;
}> {
  const impersonation = await getImpersonationSession();

  if (impersonation) {
    return {
      client: createServiceClient(),
      impersonation,
      targetUserId: impersonation.target_user_id,
    };
  }

  return {
    client: await createClient(),
    impersonation: null,
    targetUserId: null,
  };
}

/**
 * Guard for server actions that perform write operations.
 * Call at the top of any server action that modifies data.
 *
 * Returns an error result if impersonation is active, null otherwise.
 */
export async function blockWriteDuringImpersonation(): Promise<{ error: string } | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return { error: 'Write operations are not allowed during impersonation sessions' };
  }
  return null;
}
