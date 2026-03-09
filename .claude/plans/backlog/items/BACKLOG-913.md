# BACKLOG-913: endSession Fetch Failure Leaves Session Dangling

## Status: Pending | Priority: Low | Area: ui

## Summary

If the `POST /api/impersonation/end` fetch call fails in the ImpersonationProvider, the cookie persists on the client and the DB session stays active. The user is not redirected or informed, leaving them in a broken impersonation state.

## Current Behavior

- `endSession()` calls `fetch('/api/impersonation/end', { method: 'POST' })`
- If fetch fails (network error, 500, etc.), no cleanup occurs
- Cookie remains set, DB session remains active
- User stuck in broken impersonation state

## Expected Behavior

- On fetch failure, clear the cookie client-side as a fallback
- Redirect to admin portal regardless of API success
- Log the failure for debugging
- DB session will eventually expire (or be cleaned up by BACKLOG-911)

## Files to Change

- `broker-portal/components/providers/ImpersonationProvider.tsx` -- add error handling to endSession

## Source

SR Engineer code review of Sprint 116 (Finding 17, 2026-03-07)
