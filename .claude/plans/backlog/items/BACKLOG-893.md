# BACKLOG-893: Validate Impersonation Session Against DB on Each Page Load

## Status: Pending | Priority: Critical | Area: security

## Summary

The middleware and `getImpersonationSession()` trust the cookie's self-reported `expires_at` without checking the database. If an admin ends the session (or it expires), the cookie remains valid until the browser deletes it.

More critically, `getDataClient()` uses the cookie's `target_user_id` to decide whose data to load with a service-role client that bypasses all RLS — with no server-side validation that the session is still active.

## Recommended Fix

In `getDataClient()` and/or `getImpersonationSession()`, validate against the database:

```typescript
const supabase = createServiceClient();
const { data } = await supabase
  .from('impersonation_sessions')
  .select('status, expires_at, target_user_id')
  .eq('id', session.session_id)
  .eq('status', 'active')
  .gt('expires_at', new Date().toISOString())
  .single();

if (!data || data.target_user_id !== session.target_user_id) {
  // Cookie is forged or session ended — clear it
  return null;
}
```

## Files Affected

- `broker-portal/lib/impersonation.ts` — `getImpersonationSession()`
- `broker-portal/lib/impersonation-guards.ts` — `getDataClient()`
- `broker-portal/middleware.ts` — expiry check

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
