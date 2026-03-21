/**
 * SCIM 2.0 Route Definitions
 *
 * Parses incoming request URLs and dispatches to the appropriate handler.
 */

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { AuthResult } from "./shared/types.ts";
import { scimError } from "./shared/errors.ts";
import {
  handleCreateUser,
  handleDeleteUser,
  handleGetUser,
  handleListUsers,
  handlePatchUser,
} from "./handlers/users.ts";

// ---------------------------------------------------------------------------
// Route Parsing
// ---------------------------------------------------------------------------

/**
 * Parse route from URL path.
 * Expected patterns:
 *   /scim/v2/Users
 *   /scim/v2/Users/:id
 */
export function parseRoute(
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
// Route Dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch a SCIM request to the appropriate handler based on method and route.
 */
export async function dispatchRoute(
  req: Request,
  auth: AuthResult,
  supabaseAdmin: SupabaseClient,
  baseUrl: string,
): Promise<Response> {
  const url = new URL(req.url);
  const route = parseRoute(url.pathname);

  if (!route || route.resource !== "Users") {
    return scimError(404, "Endpoint not found");
  }

  // Route to the appropriate handler
  switch (req.method) {
    case "POST": {
      if (route.id) {
        return scimError(405, "POST not allowed on individual resources");
      }
      return handleCreateUser(req, auth, supabaseAdmin, baseUrl);
    }

    case "GET": {
      if (route.id) {
        return handleGetUser(
          route.id,
          auth,
          supabaseAdmin,
          baseUrl,
        );
      }
      return handleListUsers(req, auth, supabaseAdmin, baseUrl);
    }

    case "PATCH": {
      if (!route.id) {
        return scimError(405, "PATCH requires a user ID");
      }
      return handlePatchUser(
        req,
        route.id,
        auth,
        supabaseAdmin,
        baseUrl,
      );
    }

    case "DELETE": {
      if (!route.id) {
        return scimError(405, "DELETE requires a user ID");
      }
      return handleDeleteUser(route.id, auth, supabaseAdmin);
    }

    default:
      return scimError(405, `Method ${req.method} not allowed`);
  }
}
