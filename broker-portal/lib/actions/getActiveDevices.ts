'use server';

/**
 * TASK-2062: Get active devices for the current user.
 * Queries the devices table from Supabase to show active sessions.
 *
 * BACKLOG-916: Returns empty list during impersonation since there is
 * no authenticated user in that context.
 */

import { createClient } from '@/lib/supabase/server';
import { getImpersonationSession } from '@/lib/impersonation';

interface DeviceSession {
  device_id: string;
  device_name: string | null;
  os: string | null;
  platform: string | null;
  last_seen_at: string | null;
}

export async function getActiveDevices(): Promise<{
  success: boolean;
  devices?: DeviceSession[];
  error?: string;
}> {
  // BACKLOG-916: During impersonation there is no authenticated user,
  // so Supabase auth calls will fail. Return empty list gracefully.
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return { success: true, devices: [] };
  }

  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Query the devices table for active devices
  const { data, error } = await supabase
    .from('devices')
    .select('device_id, device_name, os, platform, last_seen_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    devices: (data || []) as DeviceSession[],
  };
}
