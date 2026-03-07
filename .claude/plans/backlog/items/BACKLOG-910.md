# BACKLOG-910: validate_token RPC Granted to Authenticated Role

## Status: Pending | Priority: Low | Area: security

## Summary

The `admin_validate_impersonation_token` RPC is granted to the `authenticated` role, meaning any authenticated Supabase user (not just admins with service-role access) can call it. While the RPC itself validates the token and marks it used, exposing it to all authenticated users is unnecessary and increases the attack surface.

## Current Behavior

- `GRANT EXECUTE ON FUNCTION admin_validate_impersonation_token TO authenticated`
- Any authenticated user can call the validation RPC
- Could be used to probe for valid tokens or mark them as used (denial of service)

## Expected Behavior

- Remove `authenticated` grant from the RPC
- Grant only to `service_role` (since the validation is called from a server-side route handler)
- Reduces attack surface to server-side code only

## Files to Change

- `supabase/migrations/20260307_impersonation_sessions.sql` -- change grant from authenticated to service_role

## Estimate

~2K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 14, 2026-03-07)
