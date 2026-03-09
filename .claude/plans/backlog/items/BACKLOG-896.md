# BACKLOG-896: Add Rate Limiting to Impersonation Entry Route

## Status: Pending | Priority: Medium | Area: security

## Summary

The `/auth/impersonate` route has no rate limiting. While the token space is large enough that brute force is impractical (256-bit hex tokens), a burst of failed attempts could:

- Cause DoS against the Supabase connection pool
- Be used to probe for active impersonation sessions

## Recommended Fix

Add rate limiting of ~5 attempts per IP per minute to the `/auth/impersonate` route. Options:

1. Vercel Edge Config rate limiting
2. Middleware-based IP tracking with in-memory or KV store
3. Supabase-side rate limiting in the RPC

## Files Affected

- `broker-portal/app/auth/impersonate/route.ts`
- `broker-portal/middleware.ts` (if middleware-based)

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
