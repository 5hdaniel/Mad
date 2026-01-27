# BACKLOG-527: Webhook Support for License Events

**Category**: feature
**Priority**: P3 (Low)
**Sprint**: -
**Estimated Tokens**: ~30K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement outbound webhooks to notify external systems of license events, enabling integrations with CRM, analytics, and other tools.

## Background

Webhooks enable:
- CRM integration (Salesforce, HubSpot)
- Analytics platforms (Mixpanel, Amplitude)
- Custom integrations
- Real-time notifications

## Requirements

### Events to Support

1. **License Events**
   - `license.created`
   - `license.upgraded`
   - `license.downgraded`
   - `license.cancelled`
   - `license.expired`

2. **Trial Events**
   - `trial.started`
   - `trial.extended`
   - `trial.converted`
   - `trial.expired`

3. **Usage Events**
   - `usage.limit_approached` (80%)
   - `usage.limit_reached`

### Database Schema

```sql
-- Webhook endpoints
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- For signature verification
  events TEXT[] NOT NULL,  -- Array of event types
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES webhook_endpoints(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  retry_count INTEGER DEFAULT 0
);
```

### Implementation

1. **Webhook Registration**
   - User registers endpoint URL
   - Selects events to receive
   - Gets signing secret

2. **Event Dispatch**
   - Queue events in Supabase
   - Process via Edge Function
   - Sign payload with HMAC
   - Retry on failure (3 attempts)

3. **Verification**
   - HMAC signature validation
   - Timestamp validation (5 min window)

### Payload Format

```json
{
  "id": "evt_xxx",
  "type": "license.upgraded",
  "created": "2026-01-26T12:00:00Z",
  "data": {
    "user_id": "xxx",
    "license_type": "individual",
    "previous_type": "trial"
  }
}
```

## Acceptance Criteria

- [ ] Webhooks can be registered via API
- [ ] Events trigger webhook delivery
- [ ] Payloads are signed with HMAC
- [ ] Failed deliveries retry 3 times
- [ ] Delivery logs are queryable

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- Supabase Edge Functions

## Related Files

- `supabase/functions/webhook-dispatch/`
- Webhook management API endpoints
- Admin UI for webhook management
