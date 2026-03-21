/**
 * Identity Provider CRUD operations for the admin portal.
 *
 * Uses the Supabase service-role client to bypass RLS (admin portal users
 * are authenticated via `internal_roles`, not `organization_members`).
 *
 * Client secrets are stored encrypted at rest. This module never returns
 * the plaintext secret to the browser -- it returns "********" for display.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types (inline -- NOT from @keepr/shared per Vercel deploy limitation)
// ---------------------------------------------------------------------------

export type ProviderType = 'azure_ad' | 'google_workspace' | 'okta' | 'generic_saml' | 'generic_oidc';

export interface IdentityProvider {
  id: string;
  organization_id: string;
  provider_type: ProviderType;
  display_name: string;
  client_id: string | null;
  /** Always masked when read -- never expose plaintext */
  client_secret_encrypted: string | null;
  issuer_url: string | null;
  authorization_url: string | null;
  token_url: string | null;
  userinfo_url: string | null;
  jwks_url: string | null;
  saml_metadata_url: string | null;
  saml_certificate: string | null;
  attribute_mapping: Record<string, string> | null;
  is_active: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned to the browser -- secret is always masked. */
export interface IdentityProviderDisplay extends Omit<IdentityProvider, 'client_secret_encrypted'> {
  has_client_secret: boolean;
}

export interface IdpFormData {
  provider_type: ProviderType;
  display_name: string;
  client_id: string;
  client_secret?: string;
  /** Azure AD only -- also updates organizations.microsoft_tenant_id */
  tenant_id?: string;
  /** Google Workspace only -- also updates organizations.google_workspace_domain */
  workspace_domain?: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Well-known OAuth / OIDC endpoint templates
// ---------------------------------------------------------------------------

function getAzureAdEndpoints(tenantId: string) {
  const base = `https://login.microsoftonline.com/${tenantId}`;
  return {
    issuer_url: `${base}/v2.0`,
    authorization_url: `${base}/oauth2/v2.0/authorize`,
    token_url: `${base}/oauth2/v2.0/token`,
    userinfo_url: 'https://graph.microsoft.com/oidc/userinfo',
    jwks_url: `${base}/discovery/v2.0/keys`,
  };
}

function getGoogleWorkspaceEndpoints() {
  return {
    issuer_url: 'https://accounts.google.com',
    authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwks_url: 'https://www.googleapis.com/oauth2/v3/certs',
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * List all identity providers for an organization.
 * Masks client secrets before returning.
 */
export async function listIdentityProviders(
  organizationId: string
): Promise<{ data: IdentityProviderDisplay[] | null; error: string | null }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('organization_identity_providers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  const masked: IdentityProviderDisplay[] = (data ?? []).map((row) => {
    const { client_secret_encrypted, ...rest } = row;
    return {
      ...rest,
      has_client_secret: !!client_secret_encrypted,
    } as IdentityProviderDisplay;
  });

  return { data: masked, error: null };
}

/**
 * Get a single identity provider by ID.
 */
export async function getIdentityProvider(
  idpId: string
): Promise<{ data: IdentityProviderDisplay | null; error: string | null }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('organization_identity_providers')
    .select('*')
    .eq('id', idpId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  const { client_secret_encrypted, ...rest } = data;
  return {
    data: {
      ...rest,
      has_client_secret: !!client_secret_encrypted,
    } as IdentityProviderDisplay,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new identity provider for an organization.
 *
 * - Auto-populates well-known OAuth URLs for Azure AD and Google Workspace
 * - Also updates the parent organization's tenant/domain column
 * - Client secret is stored as-is (encryption at rest handled by Supabase vault)
 */
export async function createIdentityProvider(
  organizationId: string,
  form: IdpFormData
): Promise<{ data: IdentityProviderDisplay | null; error: string | null }> {
  const supabase = createServiceClient();

  // Build endpoint URLs based on provider type
  let endpoints: Record<string, string> = {};

  if (form.provider_type === 'azure_ad' && form.tenant_id) {
    endpoints = getAzureAdEndpoints(form.tenant_id);
  } else if (form.provider_type === 'google_workspace') {
    endpoints = getGoogleWorkspaceEndpoints();
  }

  const { data, error } = await supabase
    .from('organization_identity_providers')
    .insert({
      organization_id: organizationId,
      provider_type: form.provider_type,
      display_name: form.display_name,
      client_id: form.client_id || null,
      client_secret_encrypted: form.client_secret || null,
      is_active: form.is_active,
      ...endpoints,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // Side-effect: update organization columns
  await syncOrgColumns(supabase, organizationId, form);

  const { client_secret_encrypted, ...rest } = data;
  return {
    data: {
      ...rest,
      has_client_secret: !!client_secret_encrypted,
    } as IdentityProviderDisplay,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an existing identity provider.
 *
 * If client_secret is empty or undefined, the existing secret is preserved.
 */
export async function updateIdentityProvider(
  idpId: string,
  organizationId: string,
  form: IdpFormData
): Promise<{ data: IdentityProviderDisplay | null; error: string | null }> {
  const supabase = createServiceClient();

  let endpoints: Record<string, string> = {};

  if (form.provider_type === 'azure_ad' && form.tenant_id) {
    endpoints = getAzureAdEndpoints(form.tenant_id);
  } else if (form.provider_type === 'google_workspace') {
    endpoints = getGoogleWorkspaceEndpoints();
  }

  const updatePayload: Record<string, unknown> = {
    display_name: form.display_name,
    client_id: form.client_id || null,
    is_active: form.is_active,
    updated_at: new Date().toISOString(),
    ...endpoints,
  };

  // Only overwrite secret if a new one was provided
  if (form.client_secret) {
    updatePayload.client_secret_encrypted = form.client_secret;
  }

  const { data, error } = await supabase
    .from('organization_identity_providers')
    .update(updatePayload)
    .eq('id', idpId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // Side-effect: update organization columns
  await syncOrgColumns(supabase, organizationId, form);

  const { client_secret_encrypted, ...rest } = data;
  return {
    data: {
      ...rest,
      has_client_secret: !!client_secret_encrypted,
    } as IdentityProviderDisplay,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteIdentityProvider(
  idpId: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('organization_identity_providers')
    .delete()
    .eq('id', idpId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Toggle active
// ---------------------------------------------------------------------------

export async function toggleIdentityProviderActive(
  idpId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('organization_identity_providers')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', idpId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * After saving an IdP, sync the relevant organization-level column:
 * - Azure AD  -> organizations.microsoft_tenant_id
 * - Google WS -> organizations.google_workspace_domain
 */
async function syncOrgColumns(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  form: IdpFormData
): Promise<void> {
  const updates: Record<string, string | null> = {};

  if (form.provider_type === 'azure_ad' && form.tenant_id) {
    updates.microsoft_tenant_id = form.tenant_id;
  }
  if (form.provider_type === 'google_workspace' && form.workspace_domain) {
    updates.google_workspace_domain = form.workspace_domain;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId);
  }
}

// ---------------------------------------------------------------------------
// Display helpers (pure, no DB access)
// ---------------------------------------------------------------------------

/** Human-friendly label for a provider_type enum value. */
export function providerTypeLabel(type: ProviderType): string {
  const labels: Record<ProviderType, string> = {
    azure_ad: 'Azure AD',
    google_workspace: 'Google Workspace',
    okta: 'Okta',
    generic_saml: 'SAML (Generic)',
    generic_oidc: 'OIDC (Generic)',
  };
  return labels[type] ?? type;
}
