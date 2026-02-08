/**
 * Supabase Edge Function: SCIM 2.0 User Provisioning
 *
 * Implements SCIM 2.0 (RFC 7644) user provisioning for Azure AD / Microsoft Entra ID.
 * Azure AD calls this endpoint to automatically create, update, and deactivate users
 * when they are assigned/unassigned in the Azure enterprise application.
 *
 * Auth: Bearer token validated against scim_tokens table (SHA-256 hash comparison)
 * Routes:
 *   POST   /scim/v2/Users       - Create user
 *   GET    /scim/v2/Users       - List/filter users
 *   GET    /scim/v2/Users/:id   - Get single user
 *   PATCH  /scim/v2/Users/:id   - Update user
 *   DELETE /scim/v2/Users/:id   - Deactivate user (soft-delete)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_LIST_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
const SCIM_PATCH_SCHEMA =
  "urn:ietf:params:scim:api:messages:2.0:PatchOp";

const SCIM_CONTENT_TYPE = "application/scim+json";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// Default pagination
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 hash a plaintext string and return its hex digest. */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build a SCIM error response (RFC 7644 Section 3.12). */
function scimError(
  status: number,
  detail: string,
  scimType?: string,
): Response {
  return new Response(
    JSON.stringify({
      schemas: [SCIM_ERROR_SCHEMA],
      detail,
      scimType: scimType || "invalidValue",
      status,
    }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
    },
  );
}

/** Build a SCIM User resource JSON from database rows. */
function buildScimUser(
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
function parseFilter(
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
function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  // Use the Supabase functions URL pattern
  return `${url.origin}${url.pathname.split("/scim/")[0]}`;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

interface AuthResult {
  orgId: string;
  tokenId: string;
  permissions: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

/**
 * Authenticate a SCIM request by validating the Bearer token against the
 * scim_tokens table. Returns auth context on success, or a SCIM error Response.
 */
async function authenticateScimRequest(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return scimError(401, "Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7);
  if (!token) {
    return scimError(401, "Empty bearer token");
  }

  const tokenHash = await sha256(token);

  const { data: tokenRecord, error } = await supabaseAdmin
    .from("scim_tokens")
    .select(
      "id, organization_id, can_create_users, can_update_users, can_delete_users, expires_at, revoked_at",
    )
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .single();

  if (error || !tokenRecord) {
    return scimError(401, "Invalid or revoked token");
  }

  // Check expiration
  if (
    tokenRecord.expires_at &&
    new Date(tokenRecord.expires_at) < new Date()
  ) {
    return scimError(401, "Token expired");
  }

  // Atomic increment of request_count and update last_used_at
  // Uses raw SQL via .rpc() to avoid read-then-write race conditions
  await supabaseAdmin.rpc("increment_scim_token_usage", {
    p_token_id: tokenRecord.id,
  });

  return {
    orgId: tokenRecord.organization_id,
    tokenId: tokenRecord.id,
    permissions: {
      canCreate: tokenRecord.can_create_users ?? true,
      canUpdate: tokenRecord.can_update_users ?? true,
      canDelete: tokenRecord.can_delete_users ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// Sync Log
// ---------------------------------------------------------------------------

/** Log a SCIM operation to the scim_sync_log table. */
async function logScimOperation(
  supabaseAdmin: SupabaseClient,
  params: {
    organizationId: string;
    operation: string;
    resourceType: string;
    resourceId?: string;
    externalId?: string;
    requestPayload?: unknown;
    responseStatus: number;
    errorMessage?: string;
    scimTokenId: string;
  },
): Promise<void> {
  await supabaseAdmin.from("scim_sync_log").insert({
    organization_id: params.organizationId,
    operation: params.operation,
    resource_type: params.resourceType,
    resource_id: params.resourceId || null,
    external_id: params.externalId || null,
    request_payload: params.requestPayload || null,
    response_status: params.responseStatus,
    error_message: params.errorMessage || null,
    scim_token_id: params.scimTokenId,
  });
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/** POST /scim/v2/Users -- Create a new user */
async function handleCreateUser(
  req: Request,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
  baseUrl: string,
): Promise<Response> {
  if (!auth.permissions.canCreate) {
    return scimError(403, "Token does not have create permission");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return scimError(400, "Invalid JSON request body");
  }

  const externalId = body.externalId as string | undefined;
  const userName = body.userName as string;
  const nameObj = body.name as
    | { givenName?: string; familyName?: string }
    | undefined;
  const displayName = body.displayName as string | undefined;

  if (!userName) {
    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "CREATE",
      resourceType: "User",
      externalId: externalId,
      requestPayload: body,
      responseStatus: 400,
      errorMessage: "Missing userName",
      scimTokenId: auth.tokenId,
    });
    return scimError(400, "userName is required");
  }

  const email = userName.toLowerCase();

  // Check if user already exists by scim_external_id or email
  if (externalId) {
    const { data: existingByExtId } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("scim_external_id", externalId)
      .maybeSingle();

    if (existingByExtId) {
      await logScimOperation(supabaseAdmin, {
        organizationId: auth.orgId,
        operation: "CREATE",
        resourceType: "User",
        resourceId: existingByExtId.id,
        externalId: externalId,
        requestPayload: body,
        responseStatus: 409,
        errorMessage: "User with this externalId already exists",
        scimTokenId: auth.tokenId,
      });
      return scimError(409, "User with this externalId already exists", "uniqueness");
    }
  }

  const { data: existingByEmail } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingByEmail) {
    // Check if this user is already a member of this org
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", auth.orgId)
      .eq("user_id", existingByEmail.id)
      .maybeSingle();

    if (existingMember) {
      await logScimOperation(supabaseAdmin, {
        organizationId: auth.orgId,
        operation: "CREATE",
        resourceType: "User",
        resourceId: existingByEmail.id,
        externalId: externalId,
        requestPayload: body,
        responseStatus: 409,
        errorMessage: "User already exists in this organization",
        scimTokenId: auth.tokenId,
      });
      return scimError(
        409,
        "User already exists in this organization",
        "uniqueness",
      );
    }

    // User exists but not in this org -- update SCIM fields and add to org
    await supabaseAdmin
      .from("users")
      .update({
        scim_external_id: externalId || existingByEmail.id,
        provisioning_source: "scim",
        is_managed: true,
        first_name: nameObj?.givenName || undefined,
        last_name: nameObj?.familyName || undefined,
        display_name: displayName || undefined,
        suspended_at: null,
        suspension_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingByEmail.id);

    // Get org's default role
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("default_member_role")
      .eq("id", auth.orgId)
      .single();

    const role = org?.default_member_role || "agent";

    await supabaseAdmin.from("organization_members").insert({
      organization_id: auth.orgId,
      user_id: existingByEmail.id,
      role,
      license_status: "active",
      provisioned_by: "scim",
      provisioned_at: new Date().toISOString(),
      scim_synced_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    });

    // Fetch the updated user
    const { data: updatedUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", existingByEmail.id)
      .single();

    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "CREATE",
      resourceType: "User",
      resourceId: existingByEmail.id,
      externalId: externalId,
      requestPayload: body,
      responseStatus: 201,
      scimTokenId: auth.tokenId,
    });

    return new Response(
      JSON.stringify(buildScimUser(updatedUser!, baseUrl)),
      {
        status: 201,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": SCIM_CONTENT_TYPE,
          Location: `${baseUrl}/scim/v2/Users/${existingByEmail.id}`,
        },
      },
    );
  }

  // Create new user
  const { data: newUser, error: createError } = await supabaseAdmin
    .from("users")
    .insert({
      email,
      first_name: nameObj?.givenName || null,
      last_name: nameObj?.familyName || null,
      display_name: displayName || null,
      oauth_provider: "azure",
      oauth_id: externalId || email,
      scim_external_id: externalId || null,
      provisioning_source: "scim",
      is_managed: true,
      status: "active",
      is_active: true,
    })
    .select("*")
    .single();

  if (createError || !newUser) {
    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "CREATE",
      resourceType: "User",
      externalId: externalId,
      requestPayload: body,
      responseStatus: 500,
      errorMessage: createError?.message || "Failed to create user",
      scimTokenId: auth.tokenId,
    });
    return scimError(500, "Failed to create user");
  }

  // Get org's default role
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("default_member_role")
    .eq("id", auth.orgId)
    .single();

  const role = org?.default_member_role || "agent";

  // Create org membership
  await supabaseAdmin.from("organization_members").insert({
    organization_id: auth.orgId,
    user_id: newUser.id,
    role,
    license_status: "active",
    provisioned_by: "scim",
    provisioned_at: new Date().toISOString(),
    scim_synced_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
  });

  await logScimOperation(supabaseAdmin, {
    organizationId: auth.orgId,
    operation: "CREATE",
    resourceType: "User",
    resourceId: newUser.id,
    externalId: externalId,
    requestPayload: body,
    responseStatus: 201,
    scimTokenId: auth.tokenId,
  });

  return new Response(JSON.stringify(buildScimUser(newUser, baseUrl)), {
    status: 201,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": SCIM_CONTENT_TYPE,
      Location: `${baseUrl}/scim/v2/Users/${newUser.id}`,
    },
  });
}

/** GET /scim/v2/Users -- List users with optional filtering and pagination */
async function handleListUsers(
  req: Request,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
  baseUrl: string,
): Promise<Response> {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter");
  const startIndexParam = url.searchParams.get("startIndex");
  const countParam = url.searchParams.get("count");

  // SCIM uses 1-based indexing
  const startIndex = Math.max(1, parseInt(startIndexParam || "1", 10));
  const count = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(countParam || String(DEFAULT_PAGE_SIZE), 10)),
  );
  const offset = startIndex - 1;

  // Get org member user IDs
  const { data: members } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", auth.orgId)
    .not("user_id", "is", null);

  if (!members || members.length === 0) {
    return new Response(
      JSON.stringify({
        schemas: [SCIM_LIST_SCHEMA],
        totalResults: 0,
        startIndex,
        itemsPerPage: count,
        Resources: [],
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
      },
    );
  }

  const userIds = members
    .map((m) => m.user_id)
    .filter((id): id is string => id !== null);

  // Build query
  let query = supabaseAdmin
    .from("users")
    .select("*", { count: "exact" })
    .in("id", userIds);

  // Apply filter if present
  if (filter) {
    const parsed = parseFilter(filter);
    if (parsed) {
      switch (parsed.attribute) {
        case "username":
          query = query.ilike("email", parsed.value);
          break;
        case "externalid":
          query = query.eq("scim_external_id", parsed.value);
          break;
        case "emails.value":
          query = query.ilike("email", parsed.value);
          break;
        default:
          // Unknown filter attribute -- return empty per SCIM spec recommendation
          return new Response(
            JSON.stringify({
              schemas: [SCIM_LIST_SCHEMA],
              totalResults: 0,
              startIndex,
              itemsPerPage: count,
              Resources: [],
            }),
            {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": SCIM_CONTENT_TYPE,
              },
            },
          );
      }
    }
  }

  // Apply pagination
  query = query.range(offset, offset + count - 1);

  const { data: users, count: totalResults, error } = await query;

  if (error) {
    return scimError(500, "Failed to list users");
  }

  const resources = (users || []).map((u) => buildScimUser(u, baseUrl));

  return new Response(
    JSON.stringify({
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: totalResults || 0,
      startIndex,
      itemsPerPage: count,
      Resources: resources,
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
    },
  );
}

/** GET /scim/v2/Users/:id -- Get a single user */
async function handleGetUser(
  userId: string,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
  baseUrl: string,
): Promise<Response> {
  // Verify the user belongs to this org
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", auth.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return scimError(404, "User not found");
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return scimError(404, "User not found");
  }

  return new Response(JSON.stringify(buildScimUser(user, baseUrl)), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
  });
}

/** PATCH /scim/v2/Users/:id -- Update user attributes */
async function handlePatchUser(
  req: Request,
  userId: string,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
  baseUrl: string,
): Promise<Response> {
  if (!auth.permissions.canUpdate) {
    return scimError(403, "Token does not have update permission");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return scimError(400, "Invalid JSON request body");
  }

  // Verify user belongs to this org
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", auth.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "UPDATE",
      resourceType: "User",
      resourceId: userId,
      requestPayload: body,
      responseStatus: 404,
      errorMessage: "User not found",
      scimTokenId: auth.tokenId,
    });
    return scimError(404, "User not found");
  }

  // Parse SCIM PatchOp operations
  const operations = body.Operations as Array<{
    op: string;
    path?: string;
    value?: unknown;
  }>;

  if (!operations || !Array.isArray(operations)) {
    return scimError(400, "Missing Operations array in PatchOp request");
  }

  // Build update fields
  const userUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const memberUpdates: Record<string, unknown> = {
    scim_synced_at: new Date().toISOString(),
  };

  for (const op of operations) {
    const opType = op.op?.toLowerCase();
    if (opType !== "replace" && opType !== "add") {
      continue; // Only handle replace and add operations for now
    }

    const path = op.path?.toLowerCase();

    if (path === "active" || (!path && typeof op.value === "object")) {
      // Handle active status
      let activeValue: boolean | undefined;

      if (path === "active") {
        activeValue =
          op.value === true ||
          op.value === "true" ||
          op.value === "True";
      } else if (
        op.value &&
        typeof op.value === "object" &&
        "active" in (op.value as Record<string, unknown>)
      ) {
        const val = (op.value as Record<string, unknown>).active;
        activeValue = val === true || val === "true" || val === "True";
      }

      if (activeValue !== undefined) {
        if (!activeValue) {
          userUpdates.suspended_at = new Date().toISOString();
          userUpdates.suspension_reason = "scim_deprovisioned";
          memberUpdates.license_status = "suspended";
        } else {
          userUpdates.suspended_at = null;
          userUpdates.suspension_reason = null;
          memberUpdates.license_status = "active";
        }
      }

      // Also handle name fields in the value object
      if (op.value && typeof op.value === "object") {
        const valObj = op.value as Record<string, unknown>;
        if ("name" in valObj && typeof valObj.name === "object") {
          const nameVal = valObj.name as Record<string, string>;
          if (nameVal.givenName !== undefined) {
            userUpdates.first_name = nameVal.givenName;
          }
          if (nameVal.familyName !== undefined) {
            userUpdates.last_name = nameVal.familyName;
          }
        }
        if ("displayName" in valObj) {
          userUpdates.display_name = valObj.displayName;
        }
      }
    }

    if (path === "name.givenname") {
      userUpdates.first_name = op.value as string;
    }
    if (path === "name.familyname") {
      userUpdates.last_name = op.value as string;
    }
    if (path === "displayname") {
      userUpdates.display_name = op.value as string;
    }
    if (path === "username") {
      // Updating userName means changing the email
      const newEmail = (op.value as string)?.toLowerCase();
      if (newEmail) {
        userUpdates.email = newEmail;
      }
    }
    if (path === "externalid") {
      userUpdates.scim_external_id = op.value as string;
    }
  }

  // Apply user updates
  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(userUpdates)
    .eq("id", userId);

  if (updateError) {
    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "UPDATE",
      resourceType: "User",
      resourceId: userId,
      requestPayload: body,
      responseStatus: 500,
      errorMessage: updateError.message,
      scimTokenId: auth.tokenId,
    });
    return scimError(500, "Failed to update user");
  }

  // Apply member updates if there are any beyond scim_synced_at
  if (Object.keys(memberUpdates).length > 1) {
    await supabaseAdmin
      .from("organization_members")
      .update(memberUpdates)
      .eq("organization_id", auth.orgId)
      .eq("user_id", userId);
  }

  // Also update scim_synced_at even if no other member changes
  await supabaseAdmin
    .from("organization_members")
    .update({ scim_synced_at: new Date().toISOString() })
    .eq("organization_id", auth.orgId)
    .eq("user_id", userId);

  // Fetch updated user
  const { data: updatedUser } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  await logScimOperation(supabaseAdmin, {
    organizationId: auth.orgId,
    operation: "UPDATE",
    resourceType: "User",
    resourceId: userId,
    requestPayload: body,
    responseStatus: 200,
    scimTokenId: auth.tokenId,
  });

  return new Response(
    JSON.stringify(buildScimUser(updatedUser!, baseUrl)),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
    },
  );
}

/** DELETE /scim/v2/Users/:id -- Soft-delete (suspend) user */
async function handleDeleteUser(
  userId: string,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
): Promise<Response> {
  if (!auth.permissions.canDelete) {
    return scimError(403, "Token does not have delete permission");
  }

  // Verify user belongs to this org
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", auth.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    await logScimOperation(supabaseAdmin, {
      organizationId: auth.orgId,
      operation: "DELETE",
      resourceType: "User",
      resourceId: userId,
      responseStatus: 404,
      errorMessage: "User not found",
      scimTokenId: auth.tokenId,
    });
    return scimError(404, "User not found");
  }

  // Soft-delete: suspend the user, do NOT hard-delete
  await supabaseAdmin
    .from("users")
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: "scim_deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // Update org membership status
  await supabaseAdmin
    .from("organization_members")
    .update({
      license_status: "suspended",
      scim_synced_at: new Date().toISOString(),
    })
    .eq("organization_id", auth.orgId)
    .eq("user_id", userId);

  await logScimOperation(supabaseAdmin, {
    organizationId: auth.orgId,
    operation: "DELETE",
    resourceType: "User",
    resourceId: userId,
    responseStatus: 204,
    scimTokenId: auth.tokenId,
  });

  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Parse route from URL path.
 * Expected patterns:
 *   /scim/v2/Users
 *   /scim/v2/Users/:id
 */
function parseRoute(
  pathname: string,
): { resource: string; id?: string } | null {
  // Remove trailing slash
  const path = pathname.replace(/\/+$/, "");

  // Match /scim/v2/Users/:id
  const userIdMatch = path.match(/\/scim\/v2\/Users\/([^/]+)$/i);
  if (userIdMatch) {
    return { resource: "Users", id: userIdMatch[1] };
  }

  // Match /scim/v2/Users
  if (/\/scim\/v2\/Users$/i.test(path)) {
    return { resource: "Users" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Initialize Supabase admin client (service role bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return scimError(500, "Server configuration error");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the SCIM request
    const authResult = await authenticateScimRequest(req, supabaseAdmin);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Parse the route
    const url = new URL(req.url);
    const route = parseRoute(url.pathname);

    if (!route || route.resource !== "Users") {
      return scimError(404, "Endpoint not found");
    }

    const baseUrl = `${supabaseUrl}/functions/v1/scim`;

    // Route to the appropriate handler
    switch (req.method) {
      case "POST": {
        if (route.id) {
          return scimError(405, "POST not allowed on individual resources");
        }
        return handleCreateUser(req, authResult, supabaseAdmin, baseUrl);
      }

      case "GET": {
        if (route.id) {
          return handleGetUser(
            route.id,
            authResult,
            supabaseAdmin,
            baseUrl,
          );
        }
        return handleListUsers(req, authResult, supabaseAdmin, baseUrl);
      }

      case "PATCH": {
        if (!route.id) {
          return scimError(405, "PATCH requires a user ID");
        }
        return handlePatchUser(
          req,
          route.id,
          authResult,
          supabaseAdmin,
          baseUrl,
        );
      }

      case "DELETE": {
        if (!route.id) {
          return scimError(405, "DELETE requires a user ID");
        }
        return handleDeleteUser(route.id, authResult, supabaseAdmin);
      }

      default:
        return scimError(405, `Method ${req.method} not allowed`);
    }
  } catch (err) {
    // Do NOT expose internal error details in SCIM responses
    console.error("SCIM endpoint error:", err);
    return scimError(500, "Internal server error");
  }
});
