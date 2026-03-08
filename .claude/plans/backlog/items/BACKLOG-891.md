# BACKLOG-891: Sign or Encrypt Impersonation Cookie

## Status: Pending | Priority: Critical | Area: security

## Summary

The impersonation cookie (`impersonation_session`) is stored as plain unsigned JSON containing `admin_user_id`, `target_user_id`, `session_id`, `target_email`, `target_name`, and `expires_at`. Since the cookie is not signed or encrypted, an attacker who can set cookies on the domain (e.g., via subdomain XSS or MITM) can:

1. **Horizontal escalation**: Change `target_user_id` to any user — the service-role client in `getDataClient()` will load that user's data
2. **Session persistence**: Change `expires_at` to extend the session indefinitely
3. **Bypass all RLS**: The service-role client trusts the cookie blindly

## Attack Scenario

1. Attacker crafts an `impersonation_session` cookie with arbitrary `target_user_id`
2. Sets `expires_at` to a far-future date
3. Accesses `/dashboard` — middleware allows it
4. `getDataClient()` creates a service-role client and queries data for the attacker-chosen user

## Recommended Fix

**Option A (preferred)**: Sign the cookie using HMAC-SHA256 with a server-side secret (`IMPERSONATION_COOKIE_SECRET` env var). Reject any cookie with an invalid signature.

**Option B**: Store only `session_id` in the cookie and look up all other fields from the database on each request. This also solves BACKLOG-893.

## Files Affected

- `broker-portal/app/auth/impersonate/route.ts` — cookie creation
- `broker-portal/lib/impersonation.ts` — cookie parsing
- `broker-portal/lib/impersonation-guards.ts` — `getDataClient()` trusts cookie

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
