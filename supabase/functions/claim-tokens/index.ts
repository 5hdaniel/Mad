/**
 * Supabase Edge Function: Claim Tokens
 *
 * Securely retrieves OAuth tokens stored via the claim-code pattern.
 * The broker portal creates a short-lived claim (60s TTL) after OAuth,
 * and the desktop app calls this function to retrieve the tokens.
 *
 * SOC 2 Control: CC6.1 - Secure credential transmission
 * Task: BACKLOG-1602, modified by BACKLOG-1603
 *
 * Flow:
 *   1. Broker portal completes OAuth, calls create_token_claim() RPC
 *   2. Desktop app receives claim_id via deep link (keepr://callback?claim=UUID)
 *   3. Desktop app calls this function with claim_id (no user auth needed)
 *   4. Function validates claim, returns payload, marks claimed, deletes row
 *
 * Security:
 *   - Requires apikey header (Supabase anon key) to reach the function
 *   - claim_id (UUID v4) is unguessable — serves as the authentication factor
 *   - Claims expire after 60 seconds (TTL enforced in DB)
 *   - Claims can only be used once (claimed_at check)
 *   - Row is deleted after successful claim (tokens do not persist)
 *   - No user auth required — the desktop app has no tokens yet (chicken-and-egg)
 *
 * BACKLOG-1603: Removed user auth requirement. The desktop app cannot
 * authenticate because the tokens it needs are what we're trying to claim.
 * The claim UUID itself is the security factor.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Parse and validate request body
    // -----------------------------------------------------------------------
    // No user auth required — the claim_id UUID is the authentication factor.
    // The Supabase API gateway already validates the apikey header before
    // the request reaches this function.

    const body = await req.json();
    const claimId = body?.claim_id;

    if (!claimId || typeof claimId !== "string") {
      return new Response(
        JSON.stringify({ error: "claim_id is required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Basic UUID format validation (defense in depth)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(claimId)) {
      return new Response(
        JSON.stringify({ error: "Invalid claim_id format" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Look up the claim (service role bypasses RLS)
    // -----------------------------------------------------------------------

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claim, error: selectError } = await serviceClient
      .from("token_claims")
      .select("id, user_id, payload, provider")
      .eq("id", claimId)
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (selectError || !claim) {
      // Log claim_id only (no user context available)
      console.log(
        `[claim-tokens] Claim not found or expired: claim_id=${claimId}`,
      );
      return new Response(
        JSON.stringify({
          error: "Claim not found, expired, or already claimed",
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 3. Mark as claimed, then delete
    // -----------------------------------------------------------------------

    // Mark claimed first (audit trail in case delete fails)
    const { error: updateError } = await serviceClient
      .from("token_claims")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", claimId);
    if (updateError) {
      console.error("[claim-tokens] Failed to mark claim:", updateError.message);
    }

    // Delete the row (tokens should not persist)
    const { error: deleteError } = await serviceClient
      .from("token_claims")
      .delete()
      .eq("id", claimId);
    if (deleteError) {
      console.error("[claim-tokens] Failed to delete claim:", deleteError.message);
    }

    console.log(
      `[claim-tokens] Claim successful: claim_id=${claimId}, user_id=${claim.user_id}, provider=${claim.provider}`,
    );

    // -----------------------------------------------------------------------
    // 4. Return the payload
    // -----------------------------------------------------------------------

    return new Response(
      JSON.stringify({
        payload: claim.payload,
        provider: claim.provider,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Never expose stack traces (CodeQL: js/stack-trace-exposure)
    console.error("[claim-tokens] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
