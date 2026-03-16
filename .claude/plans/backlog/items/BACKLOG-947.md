# BACKLOG-947: Playwright E2E: Fix Supabase PKCE OAuth login in automated browsers

**Type:** Bug | **Area:** Infra | **Priority:** Low | **Status:** Pending

## Problem

Supabase PKCE OAuth flow returns HTTP 500 (`unexpected_failure`) on the `/auth/v1/callback` endpoint when the OAuth flow is initiated from a Playwright-controlled browser (both Playwright Chromium and real Chrome via `channel: 'chrome'`).

The SSO + MFA flow completes successfully through Microsoft (account selection → FIDO key → ProcessAuth), but Supabase's server fails to process the callback code.

## Current Workaround

Extract cookies from a normal Chrome session via Chrome DevTools Protocol:
1. Launch Chrome with `--remote-debugging-port=9222`
2. Log in to admin portal at `http://localhost:3002` normally
3. Run `npm run test:e2e:save-cookies` (uses `e2e/extract-cookies.ts`)
4. Session saved to `e2e/.auth/session.json` (valid for 1 hour)

## Fix Options

1. **Configure Supabase to use implicit flow for test env** — avoids PKCE entirely
2. **Create a test-only API route** — `/api/test-auth` that mints sessions using service role key (dev only)
3. **Use Supabase service role key programmatically** — create sessions via `supabase.auth.admin.createUser()` + generate access token
4. **Investigate PKCE cookie handling** — the code_verifier cookie set by `signInWithOAuth()` may not survive cross-domain redirects in Playwright's network stack

## Files

- `admin-portal/e2e/auth.setup.ts` — current auth setup (skips if no session)
- `admin-portal/e2e/extract-cookies.ts` — CDP cookie extraction script
- `admin-portal/playwright.config.ts` — project config with auth-setup dependency
