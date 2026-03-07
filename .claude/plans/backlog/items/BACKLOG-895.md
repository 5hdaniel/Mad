# BACKLOG-895: Shorten Impersonation Token TTL to 60 Seconds

## Status: Pending | Priority: High | Area: security

## Summary

The impersonation token currently lives for 30 minutes (same as the session). But the token is only needed to survive the redirect from admin portal to broker portal — a matter of seconds. The cookie carries the session forward for the full 30 minutes.

A 30-minute token window means a stolen/intercepted URL is usable for a long time. Shortening to 60 seconds dramatically reduces the replay window.

## Recommended Fix

In `admin_start_impersonation` RPC, separate token TTL from session TTL:

- Token `expires_at`: `now() + interval '60 seconds'`
- Session duration: 30 minutes (tracked separately or via cookie expiry)

The `admin_validate_impersonation_token` RPC already checks `expires_at > now()`, so this change is backward-compatible.

## Files Affected

- `supabase/migrations/20260307_impersonation_sessions.sql` — `admin_start_impersonation` RPC
- May need separate `token_expires_at` and `session_expires_at` columns

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
