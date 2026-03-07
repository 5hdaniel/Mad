# BACKLOG-901: Can Impersonate Suspended Users

## Status: Pending | Priority: High | Area: security

## Summary

The `admin_start_impersonation` RPC only checks `EXISTS` on `auth.users` to verify the target user exists, but does not check the user's status. An admin could start an impersonation session for a suspended, banned, or deactivated user, effectively bypassing the suspension.

## Current Behavior

- RPC checks `EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id)`
- No check on user status (suspended, banned, etc.)
- Impersonation session created for any user that exists in auth.users

## Expected Behavior

- RPC checks user status before creating impersonation session
- Suspended/banned/deactivated users cannot be impersonated
- Clear error message returned: "Cannot impersonate a suspended user"
- Validation endpoint also checks user status at session start time

## Files to Change

- `supabase/migrations/20260307_impersonation_sessions.sql` -- add status check to RPC

## Estimate

~4K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 4, 2026-03-07)
