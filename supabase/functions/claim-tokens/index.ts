/**
 * Supabase Edge Function: Claim Tokens
 *
 * Securely retrieves OAuth tokens stored via the claim-code pattern.
 * The broker portal creates a short-lived claim (60s TTL) after OAuth,
 * and the desktop app calls this function to retrieve the tokens.
 *
 * SOC 2 Control: CC6.1 - Secure credential transmission
 * Task: BACKLOG-1602
 *
 * Flow:
 *   1. Broker portal completes OAuth, calls create_token_claim() RPC
 *   2. Desktop app receives claim_id via deep link
 *   3. Desktop app calls this function with claim_id + auth session
 *   4. Function validates ownership, returns payload, marks claimed, deletes row
 *
 * Security:
 *   - Auth required (Authorization header with valid session)
 *   - user_id must match auth.uid() (defense in depth beyond RLS)
 *   - Claims expire after 60 seconds
 *   - Claims can only be used once (claimed_at check)
 *   - Row is deleted after successful claim
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
    // 1. Validate auth session
    // -----------------------------------------------------------------------

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to verify the caller's identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Parse and validate request body
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // 3. Look up the claim (service role bypasses RLS)
    // -----------------------------------------------------------------------

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claim, error: selectError } = await serviceClient
      .from("token_claims")
      .select("id, user_id, payload, provider")
      .eq("id", claimId)
      .eq("user_id", user.id)
      .is("claimed_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (selectError || !claim) {
      console.log(
        `[claim-tokens] Claim not found: claim_id=${claimId}, user_id=${user.id}`,
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
    // 4. Mark as claimed, then delete
    // -----------------------------------------------------------------------

    // Mark claimed first (audit trail in case delete fails)
    await serviceClient
      .from("token_claims")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", claimId);

    // Delete the row (tokens should not persist)
    await serviceClient
      .from("token_claims")
      .delete()
      .eq("id", claimId);

    console.log(
      `[claim-tokens] Claim successful: claim_id=${claimId}, user_id=${user.id}, provider=${claim.provider}`,
    );

    // -----------------------------------------------------------------------
    // 5. Return the payload
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
