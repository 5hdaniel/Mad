# BACKLOG-897: Add CSRF Protection to Impersonation End-Session Route

## Status: Pending | Priority: Low | Area: security

## Summary

The `POST /api/impersonation/end` route does not verify any CSRF token. Currently mitigated by `sameSite: 'strict'` on the cookie, which prevents cross-origin requests from including it.

However, if the SameSite policy is ever relaxed (e.g., to `lax` for other functionality), an attacker could end someone's impersonation session prematurely via a cross-site POST.

## Recommended Fix

Add an explicit CSRF check — verify `Origin` or `Referer` header matches the app domain as defense-in-depth.

## Files Affected

- `broker-portal/app/api/impersonation/end/route.ts`

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
