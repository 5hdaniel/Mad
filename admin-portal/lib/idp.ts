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
// SCIM Token Management
// ---------------------------------------------------------------------------

export interface ScimTokenInfo {
  id: string;
  description: string | null;
  last_used_at: string | null;
  request_count: number;
  expires_at: string | null;
  created_at: string;
}

/**
 * Get the active (non-revoked) SCIM token for an organization.
 * Returns the most recently created token.
 */
export async function getActiveScimToken(
  organizationId: string
): Promise<{ data: ScimTokenInfo | null; error: string | null }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('scim_tokens')
    .select('id, description, last_used_at, request_count, expires_at, created_at')
    .eq('organization_id', organizationId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as ScimTokenInfo | null, error: null };
}

/**
 * Generate a new SCIM bearer token for an organization.
 *
 * Returns the plaintext token exactly ONCE. The token is stored as a
 * SHA-256 hash in the scim_tokens table.
 */
export async function generateScimToken(
  organizationId: string,
  description: string
): Promise<{ token: string; tokenInfo: ScimTokenInfo; error: string | null }> {
  const supabase = createServiceClient();

  // Generate a cryptographically random token
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const plainToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash the token for storage
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(plainToken));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { data, error } = await supabase
    .from('scim_tokens')
    .insert({
      organization_id: organizationId,
      token_hash: tokenHash,
      description,
    })
    .select('id, description, last_used_at, request_count, expires_at, created_at')
    .single();

  if (error) {
    return { token: '', tokenInfo: {} as ScimTokenInfo, error: error.message };
  }

  return {
    token: plainToken,
    tokenInfo: data as ScimTokenInfo,
    error: null,
  };
}

/**
 * Revoke a SCIM token by setting its revoked_at timestamp.
 */
export async function revokeScimToken(
  tokenId: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('scim_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Directory Sync Status
// ---------------------------------------------------------------------------

export interface DirectorySyncStatus {
  directory_sync_enabled: boolean;
  directory_sync_last_at: string | null;
  directory_sync_error: string | null;
}

/**
 * Get the directory sync status for an organization.
 */
export async function getDirectorySyncStatus(
  organizationId: string
): Promise<{ data: DirectorySyncStatus | null; error: string | null }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('directory_sync_enabled, directory_sync_last_at, directory_sync_error')
    .eq('id', organizationId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: {
      directory_sync_enabled: data.directory_sync_enabled ?? false,
      directory_sync_last_at: data.directory_sync_last_at ?? null,
      directory_sync_error: data.directory_sync_error ?? null,
    },
    error: null,
  };
}

/**
 * Toggle directory sync enabled/disabled for an organization.
 */
export async function toggleDirectorySync(
  organizationId: string,
  enabled: boolean
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('organizations')
    .update({ directory_sync_enabled: enabled })
    .eq('id', organizationId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Trigger a manual directory sync by calling the Edge Function.
 */
export async function triggerDirectorySync(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: 'Server configuration error.' };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/directory-sync?org_id=${organizationId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Sync failed (${response.status}): ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during sync.',
    };
  }
}

// ---------------------------------------------------------------------------
// Group Role Mapping CRUD
// ---------------------------------------------------------------------------

export interface GroupRoleMappingConfig {
  group_role_mapping: Record<string, string>;
  default_role: string;
  group_sync_enabled: boolean;
}

/**
 * Get the group role mapping configuration from an IdP's attribute_mapping.
 */
export function extractGroupRoleMapping(
  attributeMapping: Record<string, string> | null
): GroupRoleMappingConfig {
  const mapping = attributeMapping as Record<string, unknown> | null;
  if (!mapping) {
    return {
      group_role_mapping: {},
      default_role: 'agent',
      group_sync_enabled: false,
    };
  }

  return {
    group_role_mapping:
      (mapping.group_role_mapping as Record<string, string>) || {},
    default_role: (mapping.default_role as string) || 'agent',
    group_sync_enabled: mapping.group_sync_enabled === true,
  };
}

/**
 * Save group role mapping configuration to an IdP's attribute_mapping JSONB.
 * Merges with existing attribute_mapping to preserve other fields.
 */
export async function saveGroupRoleMapping(
  idpId: string,
  config: GroupRoleMappingConfig
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  // First read the current attribute_mapping to preserve other fields
  const { data: existing, error: readError } = await supabase
    .from('organization_identity_providers')
    .select('attribute_mapping')
    .eq('id', idpId)
    .single();

  if (readError) {
    return { error: readError.message };
  }

  const currentMapping = (existing?.attribute_mapping as Record<string, unknown>) || {};
  const updatedMapping = {
    ...currentMapping,
    group_role_mapping: config.group_role_mapping,
    default_role: config.default_role,
    group_sync_enabled: config.group_sync_enabled,
  };

  const { error } = await supabase
    .from('organization_identity_providers')
    .update({
      attribute_mapping: updatedMapping,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idpId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Sync History (scim_sync_log)
// ---------------------------------------------------------------------------

export interface SyncLogEntry {
  id: string;
  operation: string;
  resource_type: string;
  resource_id: string | null;
  external_id: string | null;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
}

/**
 * Fetch recent sync log entries for an organization.
 */
export async function getSyncHistory(
  organizationId: string,
  limit = 20,
  offset = 0
): Promise<{ data: SyncLogEntry[]; total: number; error: string | null }> {
  const supabase = createServiceClient();

  // Get total count
  const { count, error: countError } = await supabase
    .from('scim_sync_log')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (countError) {
    return { data: [], total: 0, error: countError.message };
  }

  // Get paginated entries
  const { data, error } = await supabase
    .from('scim_sync_log')
    .select('id, operation, resource_type, resource_id, external_id, response_status, error_message, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { data: [], total: 0, error: error.message };
  }

  return {
    data: (data ?? []) as SyncLogEntry[],
    total: count ?? 0,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// SCIM Endpoint URL Helper
// ---------------------------------------------------------------------------

/**
 * Build the SCIM endpoint URL for an organization.
 */
export function getScimEndpointUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/scim/v2`;
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
