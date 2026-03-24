/**
 * Supabase Edge Function: SCIM 2.0 User Provisioning
 *
 * Entry point for the SCIM endpoint. Initializes the Supabase client,
 * authenticates requests, applies rate limiting, and dispatches to
 * the appropriate route handler.
 *
 * @see ./router.ts for route definitions
 * @see ./handlers/ for endpoint implementations
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS_HEADERS } from "./shared/types.ts";
import { scimError } from "./shared/errors.ts";
import { authenticateScimRequest, checkScimRateLimit } from "./shared/auth.ts";
import { dispatchRoute } from "./router.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return scimError(500, "Server configuration error");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await authenticateScimRequest(req, supabaseAdmin);
    if (authResult instanceof Response) return authResult;

    const rateLimited = checkScimRateLimit(authResult.tokenId);
    if (rateLimited) return rateLimited;

    const baseUrl = `${supabaseUrl}/functions/v1/scim`;
    return await dispatchRoute(req, authResult, supabaseAdmin, baseUrl);
  } catch (err) {
    // Do NOT expose internal error details in SCIM responses
    console.error("SCIM endpoint error:", err);
    return scimError(500, "Internal server error");
  }
});
