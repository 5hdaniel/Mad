# Task TASK-2143: Add Alerting for High-Risk Admin Actions

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Sprint

**SPRINT-117** - SOC 2 Audit Compliance
**Phase:** 2 (High Priority)
**Backlog:** BACKLOG-861
**SOC 2 Control:** CC7.2 - Monitoring and alerting for anomalies

## Goal

Implement automated alerting for high-risk admin actions. When certain sensitive operations occur (impersonation, bulk user suspension, role creation/modification, privilege escalation), the system should send a notification to a configured webhook (e.g., Slack, email via webhook). This provides SOC 2 CC7.2 monitoring and anomaly detection.

## Non-Goals

- Do NOT implement a full SIEM integration (future effort)
- Do NOT build a notification preferences UI in the admin portal (hardcode webhook URL via env var)
- Do NOT implement rate-based anomaly detection (e.g., "more than 5 suspensions in 1 hour")
- Do NOT create in-app notifications or a notification center
- Do NOT modify the audit log viewer

## Deliverables

1. New file: `supabase/functions/audit-alert/index.ts` - Supabase Edge Function that sends webhook alerts
2. New migration: `supabase/migrations/YYYYMMDD_audit_alert_webhook.sql` - Database webhook trigger on `admin_audit_logs` for high-risk actions
3. New file: `docs/soc2/high-risk-action-alerts.md` - Documentation of alerting configuration and high-risk action definitions

## File Boundaries

### Files to modify (owned by this task):

- `supabase/functions/audit-alert/index.ts` (NEW)
- `supabase/migrations/YYYYMMDD_audit_alert_webhook.sql` (NEW)
- `docs/soc2/high-risk-action-alerts.md` (NEW)

### Files this task must NOT modify:

- `admin-portal/` -- No portal changes
- Existing migration files
- `supabase/migrations/20260307_impersonation_sessions.sql`

## Acceptance Criteria

- [ ] A Supabase Edge Function exists that sends webhook alerts for high-risk actions
- [ ] High-risk actions are defined and documented:
  - `user.impersonate.start` - Impersonation started
  - `user.suspend` - User suspended
  - `internal_user.add` - Internal user added (privilege grant)
  - `internal_user.remove` - Internal user removed
  - `internal_user.role_change` - Role changed (potential privilege escalation)
  - `role.create` - New role created
  - `role.delete` - Role deleted
  - `role.update_permissions` - Permissions modified
  - `auth.login_failed` - Failed login attempt (if captured by TASK-2138)
- [ ] The webhook URL is configurable via environment variable (`AUDIT_ALERT_WEBHOOK_URL`)
- [ ] Alert payload includes: action, actor email, target, timestamp, and metadata
- [ ] The alerting system does NOT block the original admin action (fire-and-forget)
- [ ] Documentation exists describing the alerting system and how to configure it
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### Architecture: Database Webhook + Edge Function

Supabase supports Database Webhooks that fire Edge Functions on table changes. This is ideal because:
- No changes to existing RPCs
- Fires on ANY insert to `admin_audit_logs`, filtered by action type
- Decoupled from the admin portal

**Alternative:** If Database Webhooks are not available, use a PostgreSQL trigger + `pg_net` extension to make HTTP calls directly from the database. Or use `NOTIFY`/`LISTEN` with a background worker.

### Edge Function Implementation

```typescript
// supabase/functions/audit-alert/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const HIGH_RISK_ACTIONS = new Set([
  'user.impersonate.start',
  'user.suspend',
  'internal_user.add',
  'internal_user.remove',
  'internal_user.role_change',
  'role.create',
  'role.delete',
  'role.update_permissions',
  'auth.login_failed',
]);

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record; // The new audit log entry

    // Only alert on high-risk actions
    if (!HIGH_RISK_ACTIONS.has(record.action)) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const webhookUrl = Deno.env.get('AUDIT_ALERT_WEBHOOK_URL');
    if (!webhookUrl) {
      console.error('AUDIT_ALERT_WEBHOOK_URL not configured');
      return new Response(JSON.stringify({ error: 'webhook not configured' }), { status: 200 });
    }

    // Format alert message
    const alert = {
      text: `[SECURITY ALERT] High-risk admin action detected`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*Action:* \`${record.action}\``,
              `*Actor:* ${record.actor_id}`,
              `*Target:* ${record.target_type}/${record.target_id}`,
              `*Time:* ${record.created_at}`,
              `*IP:* ${record.ip_address || 'unknown'}`,
              record.metadata ? `*Details:* \`${JSON.stringify(record.metadata)}\`` : '',
            ].filter(Boolean).join('\n'),
          },
        },
      ],
    };

    // Send to webhook (Slack-compatible format)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      console.error(`Webhook failed: ${response.status} ${await response.text()}`);
    }

    return new Response(JSON.stringify({ alerted: true, action: record.action }), {
      status: 200,
    });
  } catch (error) {
    console.error('Alert function error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 200 });
  }
});
```

### Database Webhook Configuration

Database webhooks in Supabase can be configured via the dashboard or SQL:

```sql
-- Option A: Use Supabase Database Webhooks (configure via dashboard)
-- Table: admin_audit_logs
-- Events: INSERT
-- URL: Edge Function URL for audit-alert
-- This is the recommended approach -- configure through Supabase Dashboard.

-- Option B: Use pg_net extension for direct HTTP calls
-- This avoids needing a Database Webhook configuration
CREATE OR REPLACE FUNCTION public.notify_high_risk_audit_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_webhook_url TEXT;
  v_high_risk_actions TEXT[] := ARRAY[
    'user.impersonate.start', 'user.suspend',
    'internal_user.add', 'internal_user.remove', 'internal_user.role_change',
    'role.create', 'role.delete', 'role.update_permissions',
    'auth.login_failed'
  ];
BEGIN
  -- Only process high-risk actions
  IF NOT (NEW.action = ANY(v_high_risk_actions)) THEN
    RETURN NEW;
  END IF;

  -- Get webhook URL from Vault or hardcoded
  -- v_webhook_url := current_setting('app.audit_alert_webhook_url', true);
  -- For now, document that this must be configured

  RETURN NEW;
END;
$$;

-- The trigger fires AFTER INSERT (does not block the original action)
CREATE TRIGGER audit_high_risk_alert
  AFTER INSERT ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_high_risk_audit_action();
```

### Important Details

- The alerting must NOT block the original admin action -- use AFTER INSERT trigger (not BEFORE)
- If the webhook fails, log the error but do not retry (fire-and-forget)
- The Slack webhook format uses `blocks` for rich formatting
- The `AUDIT_ALERT_WEBHOOK_URL` environment variable should be set in Supabase Edge Function config (not in code)
- Consider using Supabase Vault for the webhook URL in production

### Slack Webhook Setup (for documentation)

1. Create a Slack App at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add to a channel (e.g., #security-alerts)
4. Copy the webhook URL
5. Set as `AUDIT_ALERT_WEBHOOK_URL` in Supabase Edge Function environment

## Integration Notes

- Depends on: TASK-2137 (IP capture) -- alerts include IP address from audit entries
- Depends on: TASK-2138 (auth events) -- alerts on `auth.login_failed` events
- Imports from: `admin_audit_logs` table (reads new rows via trigger/webhook)
- Used by: Security team for monitoring

## Do / Don't

### Do:

- Use AFTER INSERT trigger (not BEFORE) to avoid blocking admin actions
- Include all relevant context in the alert payload
- Handle webhook failures gracefully (log and continue)
- Document how to configure the webhook URL
- Use Slack-compatible webhook format (widely supported)

### Don't:

- Do NOT hardcode the webhook URL in the function
- Do NOT retry failed webhook deliveries (fire-and-forget for v1)
- Do NOT block admin actions if alerting fails
- Do NOT create a notification preferences UI (out of scope)
- Do NOT implement rate-based detection (future effort)

## When to Stop and Ask

- If Supabase Database Webhooks are not available on the current plan
- If the `pg_net` extension is not available and HTTP calls from SQL are impossible
- If the Edge Function deployment process is unclear
- If there are existing Edge Functions with deployment patterns to follow

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (Edge Function -- test manually)

### Integration / Feature Tests

- Required scenarios:
  - Perform a high-risk action (e.g., impersonation) and verify alert is received
  - Perform a normal action (e.g., view audit log) and verify NO alert is sent
  - Test with webhook URL not configured -- verify action completes without error

### CI Requirements

- [ ] Edge Function TypeScript compiles
- [ ] Migration is valid SQL
- [ ] All CI checks pass

## PR Preparation

- **Title**: `feat(audit): add alerting for high-risk admin actions`
- **Labels**: `soc2`, `audit`, `monitoring`
- **Depends on**: TASK-2137 (IP in audit entries), TASK-2138 (auth event logging)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-40K

**Token Cap:** 160K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files (Edge Function, migration, docs) | +15K |
| Code volume | ~200 lines | +10K |
| Investigation | Edge Function deployment, webhook setup | +10K |
| Test complexity | Medium (webhook verification) | +5K |

**Confidence:** Medium

**Risk factors:**
- Supabase Database Webhooks availability
- Edge Function deployment process
- Webhook URL configuration method

**Similar past tasks:** TASK-2042 (edge-function-rate-limiting, archived)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] supabase/functions/audit-alert/index.ts
- [ ] supabase/migrations/YYYYMMDD_audit_alert_webhook.sql
- [ ] docs/soc2/high-risk-action-alerts.md

Features implemented:
- [ ] Edge Function for webhook alerts
- [ ] Database trigger or webhook for INSERT events
- [ ] High-risk action filtering
- [ ] Documentation

Verification:
- [ ] Edge Function compiles
- [ ] Migration applies without errors
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~32K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <If any, explain. If none, "None">
**Design decisions:** <Document decisions>
**Issues encountered:** <Document issues>
**Reviewer notes:** <Anything for reviewer>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop / int/sprint-117-soc2-compliance

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
