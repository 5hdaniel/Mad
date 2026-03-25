/**
 * SCIM 2.0 Type Definitions and Constants
 *
 * All SCIM schema URIs, shared constants, and type interfaces used across
 * the SCIM Edge Function modules.
 */

// ---------------------------------------------------------------------------
// SCIM Schema URIs (RFC 7644)
// ---------------------------------------------------------------------------

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_PATCH_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:PatchOp";

// ---------------------------------------------------------------------------
// Response Headers
// ---------------------------------------------------------------------------

export const SCIM_CONTENT_TYPE = "application/scim+json";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ---------------------------------------------------------------------------
// Pagination Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AuthResult {
  orgId: string;
  tokenId: string;
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SCIM User resource JSON from database rows. */
export function buildScimUser(
  user: Record<string, unknown>,
  baseUrl: string,
): Record<string, unknown> {
  const userId = user.id as string;
  const isActive =
    user.suspended_at === null || user.suspended_at === undefined;

  return {
    schemas: [SCIM_USER_SCHEMA],
    id: userId,
    externalId: (user.scim_external_id as string) || undefined,
    userName: user.email as string,
    name: {
      givenName: (user.first_name as string) || "",
      familyName: (user.last_name as string) || "",
    },
    displayName: (user.display_name as string) || "",
    emails: [
      {
        value: user.email as string,
        type: "work",
        primary: true,
      },
    ],
    active: isActive,
    meta: {
      resourceType: "User",
      created: user.created_at as string,
      lastModified: user.updated_at as string,
      location: `${baseUrl}/scim/v2/Users/${userId}`,
    },
  };
}

/**
 * Parse a SCIM filter string.
 * Azure AD primarily sends: userName eq "email@example.com"
 * Also supports: externalId eq "some-id"
 */
export function parseFilter(
  filter: string,
): { attribute: string; operator: string; value: string } | null {
  // Match: attribute operator "value"
  const match = filter.match(
    /^(\w+(?:\.\w+)?)\s+(eq|ne|co|sw|ew|gt|ge|lt|le)\s+"([^"]*)"$/i,
  );
  if (!match) return null;
  return {
    attribute: match[1].toLowerCase(),
    operator: match[2].toLowerCase(),
    value: match[3],
  };
}

/** Extract the base URL for this edge function from the request. */
export function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  // Use the Supabase functions URL pattern
  return `${url.origin}${url.pathname.split("/scim/")[0]}`;
}
