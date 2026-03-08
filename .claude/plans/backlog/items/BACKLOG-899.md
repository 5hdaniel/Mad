# BACKLOG-899: No Impersonation Guard on ReviewActions Writes

## Status: Pending | Priority: High | Area: security

## Summary

ReviewActions.tsx performs direct Supabase client-side writes (approve/reject submissions) with zero impersonation awareness. The write operations are only hidden by a UI guard (`{!isImpersonating && ...}`) in the server component, but there is no server-side write block. A knowledgeable user could invoke the client-side write functions directly during an impersonation session.

## Current Behavior

- ReviewActions component performs direct Supabase writes for approve/reject
- Only protected by UI-level `{!isImpersonating && ...}` guard in server component
- No server-side enforcement of write blocking during impersonation

## Expected Behavior

- ReviewActions converted to server action with `blockWriteDuringImpersonation()` guard
- Server-side enforcement prevents any write during impersonation regardless of client UI state

## Files to Change

- `broker-portal/components/submission/ReviewActions.tsx` -- convert to server action
- `broker-portal/app/dashboard/submissions/[id]/page.tsx` -- update to use server action

## Estimate

~6K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 2, 2026-03-07)
