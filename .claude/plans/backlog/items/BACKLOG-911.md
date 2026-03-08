# BACKLOG-911: No Database Cleanup Job for Expired Impersonation Sessions

## Status: Pending | Priority: Low | Area: schema

## Summary

Expired impersonation sessions remain in the `impersonation_sessions` table with `status = 'active'` until they are explicitly validated (at which point they are marked expired). There is no background job to clean up sessions that expire without being validated, leading to stale data accumulation.

## Current Behavior

- Expired sessions stay as `status = 'active'` in DB
- Only marked expired when a validation request occurs
- Sessions from admins who close the browser without ending stay active forever

## Expected Behavior

- Add a pg_cron job or Supabase Edge Function to periodically expire stale sessions
- Run every 5-10 minutes
- Mark sessions as `expired` where `expires_at < now()` and `status = 'active'`

## Files to Change

- `supabase/migrations/` (new migration) -- add pg_cron job or document Edge Function approach

## Source

SR Engineer code review of Sprint 116 (Finding 15, 2026-03-07)
