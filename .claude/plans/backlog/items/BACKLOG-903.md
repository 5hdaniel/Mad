# BACKLOG-903: Middleware Hardcodes Cookie Name Instead of Importing Constant

## Status: Pending | Priority: Medium | Area: infra

## Summary

`middleware.ts` line 79 hardcodes the string `'impersonation_session'` instead of using the `IMPERSONATION_COOKIE_NAME` constant defined in the impersonation module. If the cookie name ever changes, middleware would silently stop detecting impersonation sessions.

## Current Behavior

- Hardcoded string `'impersonation_session'` in middleware.ts
- `IMPERSONATION_COOKIE_NAME` constant exists but is not imported

## Expected Behavior

- Middleware imports and uses `IMPERSONATION_COOKIE_NAME` constant
- May need a middleware-safe constants file if the current module has server-only imports

## Files to Change

- `broker-portal/middleware.ts` -- import and use constant

## Source

SR Engineer code review of Sprint 116 (Finding 6, 2026-03-07)
