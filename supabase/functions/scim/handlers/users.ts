/**
 * SCIM 2.0 User Handlers
 *
 * Implements CRUD operations for SCIM User resources:
 *   POST   /scim/v2/Users       - Create user
 *   GET    /scim/v2/Users       - List/filter users
 *   GET    /scim/v2/Users/:id   - Get single user
 *   PATCH  /scim/v2/Users/:id   - Update user
 *   DELETE /scim/v2/Users/:id   - Deactivate user (soft-delete)
 */

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  AuthResult,
  buildScimUser,
  CORS_HEADERS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseFilter,
  SCIM_CONTENT_TYPE,
  SCIM_LIST_SCHEMA,
} from "../shared/types.ts";
import { scimError } from "../shared/errors.ts";
import { logScimOperation } from "../shared/auth.ts";
import {
  resolveRole,
  extractGroupRoleMapping,
} from "../../_shared/groupRoleMapper.ts";

// ---------------------------------------------------------------------------
// Helpers: Group Extraction & Role Resolution
// ---------------------------------------------------------------------------

/**
 * Extract group IDs/names from a SCIM User payload.
 *
 * SCIM payloads may include groups via:
 *  - `groups` array with `{ value, display }` entries
 *  - Enterprise extension `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User`
 *
 * Accepts both group UUIDs (value) and display names (display).
 */
function extractGroupsFromScimPayload(
  body: Record<string, unknown>,
): string[] {
  const groups: string[] = [];

  // Direct groups array (SCIM core schema)
  const scimGroups = body.groups as
    | Array<{ value?: string; display?: string }>
    | undefined;

  if (Array.isArray(scimGroups)) {
    for (const g of scimGroups) {
      if (g.value) groups.push(g.value);
      if (g.display && g.display !== g.value) groups.push(g.display);
    }
  }

  // Enterprise extension groups
  const enterprise = body[
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"
  ] as Record<string, unknown> | undefined;

  if (enterprise?.groups && Array.isArray(enterprise.groups)) {
    for (const g of enterprise.groups as Array<{
      value?: string;
      display?: string;
    }>) {
      if (g.value && !groups.includes(g.value)) groups.push(g.value);
      if (g.display && g.display !== g.value && !groups.includes(g.display)) {
        groups.push(g.display);
      }
    }
  }

  return groups;
}

/**
 * Fetch the IdP config's attribute_mapping for an organization and resolve
 * the user's role from their groups. If group sync is disabled or no IdP
 * config exists, returns null (caller should use default role).
 */
async function resolveRoleFromGroups(
  supabaseAdmin: SupabaseClient,
  orgId: string,
  userGroups: string[],
  memberGroupSyncEnabled?: boolean,
): Promise<{ role: string; matchedGroup: string | null } | null> {
  // If the per-member group_sync_enabled is explicitly false, skip
  if (memberGroupSyncEnabled === false) {
    return null;
  }

  // Fetch IdP config for this org
  const { data: idp } = await supabaseAdmin
    .from("organization_identity_providers")
    .select("attribute_mapping")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  if (!idp) return null;

  const mapping = extractGroupRoleMapping(
    idp.attribute_mapping as Record<string, unknown> | null,
  );

  // If org-level group sync is disabled, skip
  if (!mapping.group_sync_enabled) return null;

  const result = resolveRole(userGroups, mapping);
  return { role: result.role, matchedGroup: result.matchedGroup };
}

// ---------------------------------------------------------------------------
// POST /scim/v2/Users -- Create a new user
// ---------------------------------------------------------------------------

/** POST /scim/v2/Users -- Create a new user */
export async function handleCreateUser(
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

    let role = org?.default_member_role || "agent";

    // Extract groups from SCIM payload and resolve role via group mapping
    const scimGroups = extractGroupsFromScimPayload(body);
    const groupRoleResult = await resolveRoleFromGroups(
      supabaseAdmin,
      auth.orgId,
      scimGroups,
    );
    if (groupRoleResult) {
      role = groupRoleResult.role;
      console.log(
        `[scim] User ${email}: role resolved to '${role}' via group '${groupRoleResult.matchedGroup}'`,
      );
    }

    await supabaseAdmin.from("organization_members").insert({
      organization_id: auth.orgId,
      user_id: existingByEmail.id,
      role,
      license_status: "active",
      provisioned_by: "scim",
      provisioned_at: new Date().toISOString(),
      scim_synced_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
      idp_groups: scimGroups.length > 0 ? scimGroups : null,
      group_sync_enabled: groupRoleResult !== null,
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
  const { data: org2 } = await supabaseAdmin
    .from("organizations")
    .select("default_member_role")
    .eq("id", auth.orgId)
    .single();

  let newUserRole = org2?.default_member_role || "agent";

  // Extract groups from SCIM payload and resolve role via group mapping
  const newUserGroups = extractGroupsFromScimPayload(body);
  const newUserGroupResult = await resolveRoleFromGroups(
    supabaseAdmin,
    auth.orgId,
    newUserGroups,
  );
  if (newUserGroupResult) {
    newUserRole = newUserGroupResult.role;
    console.log(
      `[scim] New user ${email}: role resolved to '${newUserRole}' via group '${newUserGroupResult.matchedGroup}'`,
    );
  }

  // Create org membership
  await supabaseAdmin.from("organization_members").insert({
    organization_id: auth.orgId,
    user_id: newUser.id,
    role: newUserRole,
    license_status: "active",
    provisioned_by: "scim",
    provisioned_at: new Date().toISOString(),
    scim_synced_at: new Date().toISOString(),
    joined_at: new Date().toISOString(),
    idp_groups: newUserGroups.length > 0 ? newUserGroups : null,
    group_sync_enabled: newUserGroupResult !== null,
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

// ---------------------------------------------------------------------------
// GET /scim/v2/Users -- List users with optional filtering and pagination
// ---------------------------------------------------------------------------

/** GET /scim/v2/Users -- List users with optional filtering and pagination */
export async function handleListUsers(
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

// ---------------------------------------------------------------------------
// GET /scim/v2/Users/:id -- Get a single user
// ---------------------------------------------------------------------------

/** GET /scim/v2/Users/:id -- Get a single user */
export async function handleGetUser(
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

// ---------------------------------------------------------------------------
// PATCH /scim/v2/Users/:id -- Update user attributes
// ---------------------------------------------------------------------------

/** PATCH /scim/v2/Users/:id -- Update user attributes */
export async function handlePatchUser(
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

  // Verify user belongs to this org (include group_sync_enabled + role for audit)
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, group_sync_enabled, role")
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

  // Extract groups from the PatchOp body and resolve role
  const patchGroups = extractGroupsFromScimPayload(body);
  if (patchGroups.length > 0) {
    memberUpdates.idp_groups = patchGroups;

    // Resolve role from groups (respects per-member group_sync_enabled)
    const patchGroupResult = await resolveRoleFromGroups(
      supabaseAdmin,
      auth.orgId,
      patchGroups,
      member.group_sync_enabled as boolean | undefined,
    );
    if (patchGroupResult) {
      const oldRole = member.role as string;
      if (oldRole !== patchGroupResult.role) {
        memberUpdates.role = patchGroupResult.role;
        console.log(
          `[scim] User ${userId}: role changed '${oldRole}' -> '${patchGroupResult.role}' via group '${patchGroupResult.matchedGroup}'`,
        );
      }
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

// ---------------------------------------------------------------------------
// DELETE /scim/v2/Users/:id -- Soft-delete (suspend) user
// ---------------------------------------------------------------------------

/** DELETE /scim/v2/Users/:id -- Soft-delete (suspend) user */
export async function handleDeleteUser(
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
