'use server';

/**
 * Server Actions for Identity Provider CRUD and management.
 *
 * These run server-side only, ensuring client secrets and SCIM tokens
 * never transit through the browser in plaintext (except on initial submit).
 */

import { getAuthenticatedUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  createIdentityProvider,
  updateIdentityProvider,
  deleteIdentityProvider,
  toggleIdentityProviderActive,
  generateScimToken,
  revokeScimToken,
  toggleDirectorySync,
  triggerDirectorySync,
  saveGroupRoleMapping,
  getSyncHistory,
  type IdpFormData,
  type IdentityProviderDisplay,
  type ScimTokenInfo,
  type GroupRoleMappingConfig,
  type SyncLogEntry,
} from '@/lib/idp';

/** Verify the current user has admin portal access. Returns user ID or redirects. */
async function requireAdmin(): Promise<string> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single();

  if (!internalRole) {
    redirect('/login?error=not_authorized');
  }

  return user.id;
}

// ---------------------------------------------------------------------------
// Identity Provider CRUD
// ---------------------------------------------------------------------------

export async function createIdpAction(
  organizationId: string,
  formData: IdpFormData
): Promise<{ data: IdentityProviderDisplay | null; error: string | null }> {
  await requireAdmin();
  return createIdentityProvider(organizationId, formData);
}

export async function updateIdpAction(
  idpId: string,
  organizationId: string,
  formData: IdpFormData
): Promise<{ data: IdentityProviderDisplay | null; error: string | null }> {
  await requireAdmin();
  return updateIdentityProvider(idpId, organizationId, formData);
}

export async function deleteIdpAction(
  idpId: string
): Promise<{ error: string | null }> {
  await requireAdmin();
  return deleteIdentityProvider(idpId);
}

export async function toggleIdpActiveAction(
  idpId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  await requireAdmin();
  return toggleIdentityProviderActive(idpId, isActive);
}

// ---------------------------------------------------------------------------
// SCIM Token Management
// ---------------------------------------------------------------------------

export async function generateScimTokenAction(
  organizationId: string,
  description: string
): Promise<{ token: string; tokenInfo: ScimTokenInfo } | null> {
  await requireAdmin();
  const result = await generateScimToken(organizationId, description);
  if (result.error) {
    return null;
  }
  return { token: result.token, tokenInfo: result.tokenInfo };
}

export async function revokeScimTokenAction(
  tokenId: string
): Promise<boolean> {
  await requireAdmin();
  const result = await revokeScimToken(tokenId);
  return !result.error;
}

// ---------------------------------------------------------------------------
// Directory Sync
// ---------------------------------------------------------------------------

export async function toggleDirectorySyncAction(
  organizationId: string,
  enabled: boolean
): Promise<boolean> {
  await requireAdmin();
  const result = await toggleDirectorySync(organizationId, enabled);
  return !result.error;
}

export async function triggerDirectorySyncAction(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  return triggerDirectorySync(organizationId);
}

// ---------------------------------------------------------------------------
// Group Role Mapping
// ---------------------------------------------------------------------------

export async function saveGroupRoleMappingAction(
  idpId: string,
  config: GroupRoleMappingConfig
): Promise<boolean> {
  await requireAdmin();
  const result = await saveGroupRoleMapping(idpId, config);
  return !result.error;
}

// ---------------------------------------------------------------------------
// Sync History
// ---------------------------------------------------------------------------

export async function loadSyncHistoryAction(
  organizationId: string,
  offset: number
): Promise<SyncLogEntry[]> {
  await requireAdmin();
  const result = await getSyncHistory(organizationId, 20, offset);
  return result.data;
}

export async function refreshSyncHistoryAction(
  organizationId: string
): Promise<{ entries: SyncLogEntry[]; total: number }> {
  await requireAdmin();
  const result = await getSyncHistory(organizationId, 20, 0);
  return { entries: result.data, total: result.total };
}
