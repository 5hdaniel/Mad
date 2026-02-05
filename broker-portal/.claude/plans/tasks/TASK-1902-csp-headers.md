# TASK-1902: Implement strict CSP headers

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1902 |
| **Sprint** | SPRINT-071 |
| **Priority** | P2 - Medium |
| **Status** | Pending |
| **Estimated Tokens** | ~12K |
| **Depends On** | TASK-1901 |

## Security Context

**Issue:** MEDIUM-004 - CSP unsafe-inline

Content Security Policy prevents XSS attacks by controlling which resources can be loaded.

## Current State

Check current CSP configuration:
```bash
# Look for existing headers in next.config.mjs
cat next.config.mjs
```

## Requirements

### Must Do

1. Add security headers to `next.config.mjs`:
   - Content-Security-Policy
   - X-Content-Type-Options
   - X-Frame-Options
   - Referrer-Policy

2. CSP Directives to configure:
   ```
   default-src 'self';
   script-src 'self' 'unsafe-eval' 'unsafe-inline';  # Note: Next.js requires these in dev
   style-src 'self' 'unsafe-inline';
   img-src 'self' data: https:;
   font-src 'self';
   connect-src 'self' https://*.supabase.co wss://*.supabase.co;
   frame-ancestors 'none';
   base-uri 'self';
   form-action 'self';
   ```

3. Consider environment-specific CSP:
   - Development: More permissive (Next.js hot reload needs it)
   - Production: Stricter policy

### Implementation Approach

In `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ..."
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
```

### Verification Steps

1. **Build Test:**
   ```bash
   npm run build
   ```

2. **Dev Server Test:**
   ```bash
   npm run dev
   ```
   Open browser DevTools > Network tab, check response headers.

3. **CSP Violation Check:**
   Open browser DevTools > Console.
   Navigate through the app - no CSP violations should appear.

4. **Supabase Connectivity:**
   Test that auth and data fetching still work (connect-src must allow Supabase).

## Files to Modify

| File | Change |
|------|--------|
| `next.config.mjs` | Add headers() configuration |

## Acceptance Criteria

- [ ] Security headers present in all responses
- [ ] No CSP violations in browser console during normal use
- [ ] Auth flow works (Supabase connections allowed)
- [ ] Dev server works (HMR not blocked)
- [ ] Production build succeeds

## Branch Information

**Branch From:** `sprint/071-security-fixes` (after TASK-1901 merged)
**Branch Into:** `sprint/071-security-fixes`
**Branch Name:** `fix/TASK-1902-csp-headers`

## Implementation Summary

*(To be filled by Engineer after implementation)*

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Actual Tokens** | |
| **Duration** | |
| **Files Changed** | |
| **Issues/Blockers** | |
