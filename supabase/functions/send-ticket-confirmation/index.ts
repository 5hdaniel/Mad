/**
 * Supabase Edge Function: Send Ticket Confirmation
 *
 * Sends a confirmation email when a new support ticket is created.
 * Called by a database webhook trigger on support_tickets INSERT.
 *
 * This ensures ALL ticket sources (broker portal, admin portal, desktop app,
 * Android app, direct RPC) receive confirmation emails — not just those
 * that trigger client-side calls.
 *
 * Task: BACKLOG-1573
 *
 * Environment variables:
 *   BROKER_PORTAL_URL   - Broker portal base URL (e.g., https://app.keeprcompliance.com)
 *   INTERNAL_API_SECRET  - Shared secret for authenticating with the broker portal API
 *
 * Fire-and-forget: always returns 200 to avoid blocking the ticket insert.
 * If the email fails, the error is logged but does not propagate.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupportTicketRecord {
  id: string;
  ticket_number: number;
  subject: string;
  requester_email: string;
  requester_name: string;
  source_channel: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  schema: string;
  record: SupportTicketRecord;
  old_record: null;
}

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format ticket number as TKT-0001 style string.
 */
function formatTicketNumber(ticketNumber: number): string {
  return `TKT-${String(ticketNumber).padStart(4, "0")}`;
}

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
        status: 200, // Return 200 to avoid trigger retries
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const payload: WebhookPayload = await req.json();
    const record = payload.record;

    // Validate we received a ticket record with required fields
    if (!record?.id || !record?.requester_email || !record?.subject) {
      console.error(
        "[send-ticket-confirmation] Invalid payload: missing required fields",
      );
      return new Response(
        JSON.stringify({ skipped: true, reason: "missing required fields" }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Get configuration from environment
    const brokerPortalUrl = Deno.env.get("BROKER_PORTAL_URL");
    const apiSecret = Deno.env.get("INTERNAL_API_SECRET");

    if (!brokerPortalUrl || !apiSecret) {
      console.error(
        "[send-ticket-confirmation] Missing BROKER_PORTAL_URL or INTERNAL_API_SECRET. " +
          "Skipping confirmation for ticket:",
        record.id,
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "environment not configured",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const ticketNumber = formatTicketNumber(record.ticket_number);
    const ticketLink = `${brokerPortalUrl}/dashboard/support/${record.id}`;

    // Call the broker portal's existing ticket-confirmation email endpoint
    const response = await fetch(
      `${brokerPortalUrl}/api/email/ticket-confirmation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": apiSecret,
        },
        body: JSON.stringify({
          ticketNumber,
          ticketSubject: record.subject,
          requesterEmail: record.requester_email,
          ticketLink,
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        `[send-ticket-confirmation] Email endpoint returned ${response.status}: ${responseText}`,
      );
      return new Response(
        JSON.stringify({
          sent: false,
          ticketNumber,
          error: `email endpoint returned ${response.status}`,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const result = await response.json();

    console.log(
      `[send-ticket-confirmation] Confirmation sent for ${ticketNumber} to ${record.requester_email}`,
    );

    return new Response(
      JSON.stringify({ sent: true, ticketNumber, result }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Fire-and-forget: log error but always return 200
    // Keep detailed error in server logs only (CodeQL: js/stack-trace-exposure)
    console.error("[send-ticket-confirmation] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
