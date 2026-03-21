'use server';

/**
 * Server Actions for Identity Provider CRUD.
 *
 * These run server-side only, ensuring client secrets never transit
 * through the browser in plaintext (except on initial form submit).
 */

import { getAuthenticatedUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  createIdentityProvider,
  updateIdentityProvider,
  deleteIdentityProvider,
  toggleIdentityProviderActive,
  type IdpFormData,
  type IdentityProviderDisplay,
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
