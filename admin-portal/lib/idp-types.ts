/**
 * Identity Provider types and client-safe helpers.
 *
 * Extracted from idp.ts so client components can import types
 * without pulling in the server-side Supabase client.
 */

// ---------------------------------------------------------------------------
// Types
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

export interface ScimTokenInfo {
  id: string;
  description: string | null;
  last_used_at: string | null;
  request_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface DirectorySyncStatus {
  directory_sync_enabled: boolean;
  directory_sync_last_at: string | null;
  directory_sync_error: string | null;
}

export interface GroupRoleMappingConfig {
  group_role_mapping: Record<string, string>;
  default_role: string;
  group_sync_enabled: boolean;
}

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

// ---------------------------------------------------------------------------
// Client-safe helpers
// ---------------------------------------------------------------------------

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
