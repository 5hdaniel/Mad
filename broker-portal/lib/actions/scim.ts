'use server';

import { createClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';

export async function generateScimToken(description: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify IT admin role
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('role', 'it_admin')
    .single();

  if (!membership) throw new Error('Not authorized');

  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(plainToken).digest('hex');

  const { error } = await supabase.from('scim_tokens').insert({
    organization_id: membership.organization_id,
    token_hash: tokenHash,
    description: description || 'SCIM Token',
    created_by: user.id,
  });

  if (error) throw new Error('Failed to create token');
  return { token: plainToken };
}

export async function revokeScimToken(tokenId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('role', 'it_admin')
    .single();

  if (!membership) throw new Error('Not authorized');

  const { error } = await supabase
    .from('scim_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('organization_id', membership.organization_id);

  if (error) throw new Error('Failed to revoke token');
  return { success: true };
}

export async function listScimTokens() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('role', 'it_admin')
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data: tokens } = await supabase
    .from('scim_tokens')
    .select(
      'id, description, created_at, expires_at, revoked_at, last_used_at, request_count'
    )
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  return tokens || [];
}

export async function listScimSyncLogs(limit = 50) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('role', 'it_admin')
    .single();

  if (!membership) throw new Error('Not authorized');

  const { data: logs } = await supabase
    .from('scim_sync_log')
    .select(
      'id, operation, scim_resource_type, external_id, status, error_message, created_at'
    )
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return logs || [];
}
