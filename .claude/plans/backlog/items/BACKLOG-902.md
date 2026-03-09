# BACKLOG-902: Multiple Admins Can Impersonate Same User Simultaneously

## Status: Pending | Priority: Medium-High | Area: security

## Summary

The `admin_start_impersonation` RPC ends existing sessions for the calling admin but does not check or end existing sessions for the target user. This means multiple admins could impersonate the same user simultaneously, creating audit confusion and potentially masking abuse (one admin's actions could be attributed to another admin's session).

## Current Behavior

- RPC ends prior sessions for the admin (caller)
- No check for existing active sessions targeting the same user
- Multiple admins can impersonate the same user at the same time

## Expected Behavior

- When starting impersonation, check if an active session already exists for the target user
- If active session exists for target: either prevent (with error) or warn and end the existing session
- Audit log clearly attributes which admin performed which action

## Files to Change

- `supabase/migrations/20260307_impersonation_sessions.sql` -- add target user session check to RPC

## Estimate

~4K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 5, 2026-03-07)
