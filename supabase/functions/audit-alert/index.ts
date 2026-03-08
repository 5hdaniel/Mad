/**
 * Supabase Edge Function: Audit Alert
 *
 * Sends webhook notifications for high-risk admin actions logged to
 * admin_audit_logs. Called by a database webhook trigger on INSERT.
 *
 * SOC 2 Control: CC7.2 - Monitoring and alerting for anomalies
 * Task: TASK-2143 / BACKLOG-861
 *
 * Environment variables:
 *   AUDIT_ALERT_WEBHOOK_URL - Webhook endpoint (e.g., Slack incoming webhook)
 *
 * Fire-and-forget: always returns 200 to avoid blocking the audit log insert.
 * If the webhook fails, the error is logged but does not propagate.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// High-Risk Action Definitions
// ---------------------------------------------------------------------------

/**
 * Actions that trigger an immediate security alert.
 * These represent sensitive administrative operations that require
 * real-time monitoring per SOC 2 CC7.2.
 */
const HIGH_RISK_ACTIONS = new Set([
  "user.impersonate.start",
  "user.suspend",
  "internal_user.add",
  "internal_user.remove",
  "internal_user.role_change",
  "role.create",
  "role.delete",
  "role.update_permissions",
  "auth.login_failed",
]);

/**
 * Human-readable descriptions for high-risk actions.
 * Used in alert messages for clarity.
 */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  "user.impersonate.start": "Admin impersonation session started",
  "user.suspend": "User account suspended",
  "internal_user.add": "Internal user added (privilege grant)",
  "internal_user.remove": "Internal user removed",
  "internal_user.role_change": "Internal user role changed",
  "role.create": "New role created",
  "role.delete": "Role deleted",
  "role.update_permissions": "Role permissions modified",
  "auth.login_failed": "Authentication login failed",
};

/**
 * Severity levels for alert categorization.
 */
const ACTION_SEVERITY: Record<string, string> = {
  "user.impersonate.start": "CRITICAL",
  "user.suspend": "HIGH",
  "internal_user.add": "HIGH",
  "internal_user.remove": "HIGH",
  "internal_user.role_change": "CRITICAL",
  "role.create": "MEDIUM",
  "role.delete": "HIGH",
  "role.update_permissions": "CRITICAL",
  "auth.login_failed": "MEDIUM",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogRecord {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  schema: string;
  record: AuditLogRecord;
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
// Alert Formatting
// ---------------------------------------------------------------------------

/**
 * Build a Slack-compatible webhook payload for a high-risk action alert.
 *
 * Uses Slack Block Kit for rich formatting. The payload is also compatible
 * with other webhook consumers that accept a `text` field (e.g., Discord,
 * Microsoft Teams via connector, generic webhook receivers).
 */
function buildAlertPayload(record: AuditLogRecord): Record<string, unknown> {
  const severity = ACTION_SEVERITY[record.action] || "MEDIUM";
  const description =
    ACTION_DESCRIPTIONS[record.action] || record.action;
  const timestamp = record.created_at
    ? new Date(record.created_at).toISOString()
    : new Date().toISOString();

  // Plain-text fallback for non-Slack consumers
  const plainText = [
    `[${severity}] Security Alert: ${description}`,
    `Action: ${record.action}`,
    `Actor: ${record.actor_id || "unknown"}`,
    `Target: ${record.target_type}/${record.target_id}`,
    `Time: ${timestamp}`,
    record.ip_address ? `IP: ${record.ip_address}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // Slack Block Kit payload
  return {
    text: plainText,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severity === "CRITICAL" ? "[!]" : "[*]"} Security Alert: ${description}`,
          emoji: false,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Action:*\n\`${record.action}\``,
          },
          {
            type: "mrkdwn",
            text: `*Severity:*\n${severity}`,
          },
          {
            type: "mrkdwn",
            text: `*Actor ID:*\n${record.actor_id || "system"}`,
          },
          {
            type: "mrkdwn",
            text: `*Target:*\n${record.target_type}/${record.target_id}`,
          },
          {
            type: "mrkdwn",
            text: `*Timestamp:*\n${timestamp}`,
          },
          {
            type: "mrkdwn",
            text: `*IP Address:*\n${record.ip_address || "unknown"}`,
          },
        ],
      },
      // Include metadata if present
      ...(record.metadata && Object.keys(record.metadata).length > 0
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Details:*\n\`\`\`${JSON.stringify(record.metadata, null, 2)}\`\`\``,
              },
            },
          ]
        : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Audit Log ID: ${record.id} | SOC 2 CC7.2 Automated Alert`,
          },
        ],
      },
    ],
  };
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

    // Validate we received an audit log record
    if (!record || !record.action) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "invalid payload" }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Only alert on high-risk actions
    if (!HIGH_RISK_ACTIONS.has(record.action)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "not a high-risk action" }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Get webhook URL from environment
    const webhookUrl = Deno.env.get("AUDIT_ALERT_WEBHOOK_URL");
    if (!webhookUrl) {
      console.error(
        "[audit-alert] AUDIT_ALERT_WEBHOOK_URL not configured. " +
          "Skipping alert for action:",
        record.action,
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "webhook URL not configured",
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    // Build and send the alert
    const alertPayload = buildAlertPayload(record);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertPayload),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        `[audit-alert] Webhook delivery failed: ${response.status} ${responseText}`,
      );
      // Fire-and-forget: do NOT retry. Log error and return success
      // to avoid blocking the audit log insert.
      return new Response(
        JSON.stringify({
          alerted: false,
          action: record.action,
          error: `webhook returned ${response.status}`,
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[audit-alert] Alert sent for action: ${record.action} (severity: ${ACTION_SEVERITY[record.action] || "MEDIUM"})`,
    );

    return new Response(
      JSON.stringify({ alerted: true, action: record.action }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Fire-and-forget: log error but always return 200
    console.error("[audit-alert] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    );
  }
});
