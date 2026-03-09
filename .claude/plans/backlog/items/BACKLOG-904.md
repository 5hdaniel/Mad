# BACKLOG-904: Expired Impersonation Session Allows Continued Client-Side Browsing

## Status: Pending | Priority: Medium | Area: security

## Summary

When the impersonation session timer reaches 0 in the ImpersonationProvider, it shows a "Session Expired" message but takes no action to actually terminate the session. The user can continue interacting with client-side components, making API calls, and browsing data as the impersonated user.

## Current Behavior

- Timer reaches 0, displays "Session Expired" text
- No automatic session termination
- User can continue browsing and interacting with client-side components
- Cookie remains valid, API calls still succeed

## Expected Behavior

- When timer hits 0, automatically call `endSession()` or force a page reload
- Session cookie cleared immediately on expiry
- User redirected to admin portal or shown a blocking modal
- No further client-side interaction possible

## Files to Change

- `broker-portal/components/providers/ImpersonationProvider.tsx` -- auto-end session on expiry

## Estimate

~3K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 7, 2026-03-07)
