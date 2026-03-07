# BACKLOG-892: Make Impersonation Token Single-Use

## Status: Pending | Priority: Critical | Area: security

## Summary

The `admin_validate_impersonation_token` RPC performs a read-only lookup — it never marks the token as consumed. The same URL can be opened repeatedly for the entire 30-minute window.

If the URL appears in browser history, bookmarks, server access logs, or a Referer header, anyone can reuse it to impersonate the target user.

## Recommended Fix

Add a status transition in `admin_validate_impersonation_token`:

```sql
-- After the SELECT, add:
UPDATE public.impersonation_sessions
SET status = 'validated'
WHERE id = v_session.id AND status = 'active';
```

Update the status CHECK constraint to include `'validated'`. The cookie then carries the session forward; the token URL becomes dead after first use.

## Files Affected

- `supabase/migrations/20260307_impersonation_sessions.sql` — RPC definition
- Database: `admin_validate_impersonation_token` function

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
