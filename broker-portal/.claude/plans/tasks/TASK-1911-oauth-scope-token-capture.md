# TASK-1911: OAuth Scope Upgrade + Provider Token Capture

**Backlog ID:** BACKLOG-626
**Sprint:** SPRINT-072
**Phase:** Phase 2 - OAuth + Token Capture
**Branch:** `feature/task-1911-oauth-token-capture`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~15K (service category x 0.5 = ~8K, but token flow is complex, use ~15K)
**Depends On:** TASK-1910 (provider_tokens table must exist)
**SR Review Status:** Reviewed -- 5 changes incorporated (see below)

---

## Objective

Upgrade the Microsoft Azure OAuth login flow to request `Contacts.Read` and `offline_access` scopes, then capture and persist the `provider_token` and `provider_refresh_token` from the OAuth callback into the `provider_tokens` Supabase table.

---

## Context

### Current State
- Login page (`app/login/page.tsx`) requests scopes: `email profile openid` for Azure
- Auth callback (`app/auth/callback/route.ts`) exchanges code for session but does NOT capture the provider token
- Supabase returns `provider_token` and `provider_refresh_token` as part of the session after code exchange, but they are NOT stored anywhere

### What Supabase Provides
After `supabase.auth.exchangeCodeForSession(code)`, the session object contains:
```typescript
session.provider_token   // Microsoft access token (short-lived, ~1 hour)
session.provider_refresh_token  // Microsoft refresh token (long-lived, requires offline_access scope)
```

### Azure AD Prerequisite (Manual Step)
Before this task works, the Azure AD app registration must have:
- `Microsoft Graph > Contacts.Read` delegated permission added
- Admin consent granted (if required by tenant policy)

The user must complete this step manually in the Azure portal.

### Required Environment Variables
> **SR Engineer Note [CRITICAL]:** The following env vars are required for the token refresh
> utility to work. They must be added to `.env.local.example` and documented.

| Variable | Purpose |
|----------|---------|
| `AZURE_AD_CLIENT_ID` | Azure AD app registration client ID (needed for token refresh endpoint) |
| `AZURE_AD_CLIENT_SECRET` | Azure AD app registration client secret (needed for token refresh endpoint) |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID (needed for token refresh endpoint URL) |
| `PROVIDER_TOKEN_ENCRYPTION_KEY` | Server-side key for encrypting/decrypting provider tokens at rest |

---

## Requirements

### Must Do:

1. **Update OAuth scopes in login page** (`app/login/page.tsx`):
   ```typescript
   // Change from:
   scopes: provider === 'azure' ? 'email profile openid' : undefined,
   // To:
   scopes: provider === 'azure' ? 'email profile openid Contacts.Read offline_access' : undefined,
   ```

2. **Capture provider tokens in auth callback** (`app/auth/callback/route.ts`):

   > **SR Engineer Note [HIGH]:** Token capture MUST happen immediately after `getUser()` succeeds,
   > BEFORE the membership/invite/auto-provision logic. Otherwise, early returns in those code paths
   > would bypass token storage and users would never get their tokens saved.

   > **SR Engineer Note [MEDIUM]:** `expires_at` is approximate (~1 hour) since Supabase does not
   > expose the provider's exact `expires_in` value. The token refresh utility should check expiry
   > with a buffer (e.g., refresh if within 5 minutes of expiry).

   After successful `exchangeCodeForSession`, check for provider tokens and store them.
   **Token capture must be placed BEFORE any membership/invite/auto-provision logic:**
   ```typescript
   const { data, error } = await supabase.auth.exchangeCodeForSession(code);

   if (!error && data.session) {
     const { provider_token, provider_refresh_token } = data.session;

     // IMPORTANT: Capture tokens BEFORE membership logic (early returns would skip this)
     if (provider_token && data.session.user.app_metadata?.provider === 'azure') {
       // SR REVIEW [CRITICAL]: Encrypt tokens before storage
       const { encrypt } = await import('@/lib/auth/provider-tokens');
       await supabase.from('provider_tokens').upsert({
         user_id: data.session.user.id,
         provider: 'microsoft',
         access_token_encrypted: encrypt(provider_token),
         refresh_token_encrypted: provider_refresh_token ? encrypt(provider_refresh_token) : null,
         expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // ~1 hour (approximate)
         scopes: 'Contacts.Read offline_access',
       }, { onConflict: 'user_id,provider' });
     }

     // ... THEN proceed with getUser(), membership logic, etc.
   }
   ```

3. **Also capture in setup callback** (`app/auth/setup/callback/route.ts`):
   Apply the same provider token capture logic to the IT admin setup flow.

4. **Create a token refresh utility** (`lib/auth/provider-tokens.ts`):

   > **SR Engineer Note [HIGH]:** This utility must encrypt tokens on write and decrypt on read.
   > Use `PROVIDER_TOKEN_ENCRYPTION_KEY` env var with Node.js `crypto` module (AES-256-GCM).

   > **SR Engineer Note [CRITICAL]:** The token refresh endpoint requires `AZURE_AD_CLIENT_ID`,
   > `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_TENANT_ID` env vars. Without these, token refresh
   > will fail silently and users will need to re-authenticate after ~1 hour.

   ```typescript
   import crypto from 'crypto';

   const ENCRYPTION_KEY = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY!;

   /**
    * Encrypt a token value for storage in provider_tokens table.
    * Uses AES-256-GCM with a random IV prepended to the ciphertext.
    */
   export function encrypt(plaintext: string): string {
     // AES-256-GCM encryption with random IV
     // Return format: base64(iv + authTag + ciphertext)
   }

   /**
    * Decrypt a token value retrieved from provider_tokens table.
    */
   export function decrypt(encrypted: string): string {
     // Reverse of encrypt()
   }

   /**
    * Get a valid Microsoft access token for the current user.
    * Refreshes the token if expired using the refresh token.
    * Decrypts tokens after reading from DB; encrypts after refresh before storing.
    */
   export async function getMicrosoftToken(userId: string): Promise<string | null> {
     // 1. Fetch token from provider_tokens table
     // 2. Decrypt access_token_encrypted
     // 3. If not expired (with 5-min buffer), return decrypted access_token
     // 4. If expired and has refresh_token_encrypted:
     //    a. Decrypt refresh_token
     //    b. Call Microsoft token endpoint:
     //       POST https://login.microsoftonline.com/{AZURE_AD_TENANT_ID}/oauth2/v2.0/token
     //       with client_id, client_secret, refresh_token, grant_type=refresh_token
     //    c. Encrypt new tokens and store in DB
     //    d. Return new access_token
     // 5. If no token or refresh fails, return null
   }
   ```

5. **Update CSP in next.config.mjs**:

   > **SR Engineer Note [MEDIUM]:** These CSP changes are forward-looking since all Microsoft
   > API calls are server-side (server actions, not browser fetch). However, adding them now
   > prevents issues if any client-side calls are added later.

   Add `https://graph.microsoft.com` and `https://login.microsoftonline.com` to `connect-src`:
   ```javascript
   "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clarity.ms https://graph.microsoft.com https://login.microsoftonline.com",
   ```

6. **Update .env.local.example** to document required env vars:
   ```
   # Microsoft OAuth (for Graph API token refresh)
   # SR REVIEW [CRITICAL]: These are required for the token refresh utility
   AZURE_AD_CLIENT_ID=your-azure-ad-client-id
   AZURE_AD_CLIENT_SECRET=your-azure-ad-client-secret
   AZURE_AD_TENANT_ID=your-azure-ad-tenant-id

   # Provider token encryption (server-side only, generate with: openssl rand -hex 32)
   PROVIDER_TOKEN_ENCRYPTION_KEY=your-64-char-hex-key
   ```

### Must NOT Do:
- Do NOT break the existing Google OAuth login flow
- Do NOT modify the database schema (TASK-1910 handles that)
- Do NOT implement the Graph API contact fetching (TASK-1912 handles that)
- Do NOT change the auth flow for users who log in via Google
- Do NOT store tokens in cookies or localStorage (use database only)

---

## Acceptance Criteria

- [ ] Azure OAuth login requests `Contacts.Read offline_access` scopes
- [ ] Google OAuth login is unchanged
- [ ] Auth callback captures `provider_token` and `provider_refresh_token` for Azure users
- [ ] Token capture happens BEFORE membership/invite/auto-provision logic (no early return bypass)
- [ ] Provider tokens encrypted with `PROVIDER_TOKEN_ENCRYPTION_KEY` before storage
- [ ] Provider tokens stored in `provider_tokens` Supabase table (encrypted columns)
- [ ] Token refresh utility created with encrypt/decrypt functions
- [ ] Token refresh uses `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` env vars
- [ ] `.env.local.example` updated with all 4 new env vars
- [ ] CSP updated to allow `graph.microsoft.com` and `login.microsoftonline.com`
- [ ] Setup callback also captures provider tokens (encrypted)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Application builds successfully (`npm run build`)
- [ ] Existing auth flows still work (can sign in with both providers)

---

## Files to Modify

- `broker-portal/app/login/page.tsx` - Add Contacts.Read and offline_access to Azure scopes
- `broker-portal/app/auth/callback/route.ts` - Capture and store provider tokens after code exchange
- `broker-portal/app/auth/setup/callback/route.ts` - Same token capture for setup flow
- `broker-portal/next.config.mjs` - Add graph.microsoft.com to CSP connect-src

## Files to Create

- `broker-portal/lib/auth/provider-tokens.ts` - Token retrieval + refresh utility

## Files to Read (for context)

- `broker-portal/lib/supabase/server.ts` - Server-side Supabase client creation
- `broker-portal/middleware.ts` - Understand session refresh flow

---

## Testing Expectations

### Unit Tests
- **Required:** No (OAuth flow testing requires real Microsoft endpoints)
- **Manual verification:** Sign in with Microsoft, verify token appears in `provider_tokens` table

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(auth): capture Microsoft provider tokens for Graph API access`
- **Branch:** `feature/task-1911-oauth-token-capture`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from main
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Verified TASK-1910 is merged (provider_tokens table exists)

Implementation:
- [ ] OAuth scopes updated
- [ ] Token capture in auth callback
- [ ] Token capture in setup callback
- [ ] Token refresh utility created
- [ ] CSP updated
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Build passes (npm run build)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Azure OAuth only requests basic profile scopes, no provider tokens stored
- **After**: Azure OAuth requests Contacts.Read, provider tokens captured and stored in DB
- **Actual Tokens**: ~XK (Est: ~15K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `exchangeCodeForSession` response doesn't include `provider_token` (may need Supabase config change)
- You're unsure about the token refresh flow with Microsoft's token endpoint
- CSP changes cause existing functionality to break
- You need to modify the Supabase dashboard Azure provider configuration
- You encounter blockers not covered in the task file
