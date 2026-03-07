# BACKLOG-906: Error Messages Leaked in Redirect URL Query Parameters

## Status: Pending | Priority: Medium | Area: security

## Summary

The impersonation auth route (`/auth/impersonate`) passes Supabase error messages directly into redirect URL query parameters via a `detail` parameter. These error messages could reveal internal table names, column names, RPC names, or stack traces to the user or anyone who can see the URL (e.g., in browser history, server logs, or referer headers).

## Current Behavior

- Supabase error messages passed into redirect URLs: `?error=...&detail=<raw supabase error>`
- Error details visible in browser address bar, history, and server logs
- Could reveal table names, RPC names, or internal structure

## Expected Behavior

- Use generic error codes in redirect URLs (e.g., `?error=session_invalid`)
- Log detailed error information server-side only (console.error or structured logging)
- Map Supabase errors to user-friendly messages on the error display page

## Files to Change

- `broker-portal/app/auth/impersonate/route.ts` -- sanitize error details from redirect URLs

## Estimate

~2K tokens

## Source

SR Engineer code review of Sprint 116 (Finding 9, 2026-03-07)
