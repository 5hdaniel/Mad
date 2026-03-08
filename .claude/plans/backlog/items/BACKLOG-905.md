# BACKLOG-905: ImpersonationProvider Leaks adminUserId to Client Context

## Status: Pending | Priority: Medium | Area: security

## Summary

The ImpersonationProvider React context exposes `adminUserId` (the admin's UUID) to all client-side components. This is unnecessary information leakage -- client components should never need to know which admin is performing the impersonation. The admin UUID could be harvested by malicious client-side code or logged in browser developer tools.

## Current Behavior

- `adminUserId` is part of the ImpersonationProvider context value
- All client components can read the admin's UUID
- Exposed in React DevTools and browser console

## Expected Behavior

- Remove `adminUserId` from client-side context entirely
- Admin identity only used server-side (for audit logging)
- Client components only need: `isImpersonating`, `targetUserName`, `timeRemaining`, `endSession()`

## Files to Change

- `broker-portal/components/providers/ImpersonationProvider.tsx` -- remove adminUserId from context

## Estimate

~2K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 8, 2026-03-07)
