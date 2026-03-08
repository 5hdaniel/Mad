# High-Risk Action Alerts

SOC 2 Control: **CC7.2** - The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity's ability to meet its objectives; anomalies are analyzed to determine whether they represent security events.

## Overview

Keepr automatically sends real-time alerts when high-risk administrative actions are performed. Alerts are delivered via webhook to a configurable endpoint (e.g., Slack, Microsoft Teams, email relay, or a SIEM).

The alerting system is designed as **fire-and-forget**: it never blocks the original admin action. If the webhook delivery fails, the error is logged but the admin action proceeds normally.

## Architecture

```
Admin performs action
       |
       v
log_admin_action() RPC inserts into admin_audit_logs
       |
       v
AFTER INSERT trigger (notify_high_risk_audit_action)
       |
       +-- Action NOT in high-risk list --> no-op, return
       |
       +-- Action IS high-risk --> pg_net async HTTP POST
                                         |
                                         v
                              audit-alert Edge Function
                                         |
                                         v
                              AUDIT_ALERT_WEBHOOK_URL
                                   (e.g., Slack)
```

**Key design decisions:**
- Uses `AFTER INSERT` trigger (not `BEFORE`) to avoid blocking the audit log write
- Uses `pg_net` extension for non-blocking HTTP calls from PostgreSQL
- Two-hop design (trigger -> Edge Function -> webhook) keeps the webhook URL out of the database
- All errors are caught and logged, never propagated to the caller

## High-Risk Actions

| Action | Description | Severity |
|--------|-------------|----------|
| `user.impersonate.start` | Admin started an impersonation session | CRITICAL |
| `user.suspend` | User account was suspended | HIGH |
| `internal_user.add` | Internal user added (privilege grant) | HIGH |
| `internal_user.remove` | Internal user removed | HIGH |
| `internal_user.role_change` | Internal user role was changed | CRITICAL |
| `role.create` | New role was created | MEDIUM |
| `role.delete` | Role was deleted | HIGH |
| `role.update_permissions` | Role permissions were modified | CRITICAL |
| `auth.login_failed` | Authentication login failed | MEDIUM |

### Severity Levels

- **CRITICAL**: Actions that grant or modify administrative privileges, or allow one user to act as another. These require immediate investigation.
- **HIGH**: Actions that affect user access or remove security controls. Should be reviewed within the same business day.
- **MEDIUM**: Actions that indicate potential issues but have lower immediate risk. Should be reviewed during regular security audits.

## Configuration

### 1. Set the Webhook URL

The webhook URL is configured as a Supabase Edge Function secret:

```bash
supabase secrets set AUDIT_ALERT_WEBHOOK_URL=<your-webhook-url>
```

Verify the secret is set:

```bash
supabase secrets list
```

### 2. Deploy the Edge Function

```bash
supabase functions deploy audit-alert
```

### 3. Apply the Database Migration

The migration (`20260307_audit_alert_webhook.sql`) is applied automatically during deployment. It creates:
- The `notify_high_risk_audit_action()` trigger function
- The `audit_high_risk_alert` trigger on `admin_audit_logs`
- Enables the `pg_net` extension if not already present

### 4. Verify the Setup

Test by performing a high-risk action (e.g., adding an internal user in the admin portal) and confirming the alert arrives at the webhook endpoint.

You can also test the Edge Function directly:

```bash
curl -i --location --request POST \
  'https://<project-ref>.supabase.co/functions/v1/audit-alert' \
  --header 'Authorization: Bearer <service-role-key>' \
  --header 'Content-Type: application/json' \
  --data '{
    "type": "INSERT",
    "table": "admin_audit_logs",
    "schema": "public",
    "record": {
      "id": "test-id",
      "actor_id": "test-actor",
      "action": "user.impersonate.start",
      "target_type": "user",
      "target_id": "test-target",
      "metadata": {"reason": "test"},
      "ip_address": "192.168.1.1",
      "created_at": "2026-03-07T12:00:00Z"
    },
    "old_record": null
  }'
```

## Slack Webhook Setup

1. Go to [Slack API Apps](https://api.slack.com/apps) and create a new app (or use an existing one)
2. Navigate to **Incoming Webhooks** and toggle it on
3. Click **Add New Webhook to Workspace** and select a channel (e.g., `#security-alerts`)
4. Copy the webhook URL (format: `https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXX`)
5. Set it as the Edge Function secret (see Configuration step 1)

### Alert Format in Slack

Alerts appear with:
- A header showing severity and action description
- Fields for action, severity, actor, target, timestamp, and IP address
- Metadata details (if present) in a code block
- Footer with the audit log entry ID and SOC 2 control reference

## Monitoring and Troubleshooting

### View Edge Function Logs

```bash
# Real-time logs
supabase functions logs audit-alert --tail

# Historical logs
supabase functions logs audit-alert
```

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| No alerts received | `AUDIT_ALERT_WEBHOOK_URL` not set | Run `supabase secrets set AUDIT_ALERT_WEBHOOK_URL=<url>` |
| No alerts received | Edge Function not deployed | Run `supabase functions deploy audit-alert` |
| No alerts received | Trigger not firing | Check migration was applied: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'admin_audit_logs'::regclass;` |
| Alerts for wrong actions | Action names don't match | Verify action names match exactly (case-sensitive) |
| Webhook returns 403/404 | Invalid webhook URL | Verify the URL in Slack app settings |
| Webhook returns 429 | Slack rate limiting | Alerts may be delayed; Slack allows ~1 req/sec per webhook |
| `pg_net` warnings in logs | Extension not enabled | Run `CREATE EXTENSION IF NOT EXISTS pg_net;` |

### Database Verification Queries

```sql
-- Check the trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.admin_audit_logs'::regclass
  AND tgname = 'audit_high_risk_alert';

-- Check the trigger function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'notify_high_risk_audit_action';

-- Check pg_net extension is available
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- View recent high-risk audit entries
SELECT id, action, actor_id, target_type, target_id, created_at
FROM admin_audit_logs
WHERE action IN (
  'user.impersonate.start', 'user.suspend',
  'internal_user.add', 'internal_user.remove', 'internal_user.role_change',
  'role.create', 'role.delete', 'role.update_permissions',
  'auth.login_failed'
)
ORDER BY created_at DESC
LIMIT 20;
```

## Security Considerations

- The webhook URL is stored as a Supabase Edge Function secret, not in the database or source code
- The Edge Function authenticates with the Supabase service role key (set automatically)
- Alert payloads include actor IDs and IP addresses for forensic tracing
- The trigger uses `SECURITY DEFINER` to access `pg_net` with appropriate permissions
- Webhook delivery failures are logged but never block admin operations

## Future Enhancements

These are explicitly out of scope for the current implementation:

- **Rate-based anomaly detection**: Alert on patterns like "more than N suspensions in 1 hour"
- **SIEM integration**: Direct integration with a Security Information and Event Management system
- **Notification preferences UI**: In-app configuration of webhook URLs and alert thresholds
- **Retry logic**: Automatic retry of failed webhook deliveries with exponential backoff
- **Alert deduplication**: Suppress duplicate alerts for the same event within a time window
