# TASK-2103: Infrastructure Domain Setup (Vercel + Supabase + OAuth)

---

## WORKFLOW REQUIREMENT

**This task is MANUAL infrastructure work — no code changes.**

It requires access to:
- Vercel dashboard (project settings)
- Supabase dashboard (auth settings)
- Google Cloud Console (OAuth credentials)
- Azure AD portal (app registrations)

The engineer cannot perform these steps autonomously — this task is a **checklist for the user** (Daniel) to execute, with the engineer available to verify and document completion.

---

## Goal

Configure `app.keeprcompliance.com` as a domain alias for the broker portal across all infrastructure services, **without removing** the existing `www.keeprcompliance.com` configuration. Both domains must work simultaneously during the transition period.

## Non-Goals

- Do NOT remove `www.keeprcompliance.com` from any service
- Do NOT change any code or environment variables (that's TASK-2104)
- Do NOT set up `admin.keeprcompliance.com` yet (that's BACKLOG-837)
- Do NOT modify DNS for `www` to point elsewhere

## Deliverables

No code files. This task produces a verified infrastructure checklist.

## Steps (User-Executed)

### 1. Vercel: Add Domain Alias

- Go to Vercel project settings > Domains
- Add `app.keeprcompliance.com` as a domain
- Configure DNS (CNAME to `cname.vercel-dns.com` or A record as Vercel instructs)
- Verify domain is active and serving the broker portal
- Keep `www.keeprcompliance.com` active

### 2. Supabase: Add Redirect URLs

- Go to Supabase dashboard > Authentication > URL Configuration
- Add to "Redirect URLs":
  - `https://app.keeprcompliance.com/**`
  - `https://app.keeprcompliance.com/auth/callback`
- Keep existing `www.keeprcompliance.com` redirect URLs

### 3. Google OAuth: Add Redirect URIs

- Go to Google Cloud Console > APIs & Services > Credentials
- Edit the OAuth 2.0 Client ID used by the broker portal
- Add to "Authorized redirect URIs":
  - `https://app.keeprcompliance.com/auth/callback`
  - `https://app.keeprcompliance.com/api/auth/callback/google` (if using NextAuth)
- Add to "Authorized JavaScript origins":
  - `https://app.keeprcompliance.com`
- Keep existing `www` URIs

### 4. Azure AD: Add Redirect URIs

- Go to Azure Portal > App Registrations > Keepr app
- Under "Authentication" > "Web" platform
- Add redirect URI:
  - `https://app.keeprcompliance.com/auth/callback`
  - `https://app.keeprcompliance.com/api/auth/callback/azure-ad` (if using NextAuth)
- Keep existing `www` URIs

### 5. Verification

After all steps complete, verify:
- [ ] `https://app.keeprcompliance.com` loads the broker portal
- [ ] `https://www.keeprcompliance.com` still loads the broker portal
- [ ] Google login works on `app.keeprcompliance.com` (redirects back correctly)
- [ ] Microsoft login works on `app.keeprcompliance.com` (redirects back correctly)
- [ ] Supabase auth callback succeeds on `app.keeprcompliance.com`

## Acceptance Criteria

- [ ] `app.keeprcompliance.com` resolves and serves the broker portal
- [ ] Google OAuth redirect URI includes `app.keeprcompliance.com`
- [ ] Azure AD redirect URI includes `app.keeprcompliance.com`
- [ ] Supabase redirect URLs include `app.keeprcompliance.com`
- [ ] All existing `www.keeprcompliance.com` configurations remain intact
- [ ] Login flow tested successfully on `app.keeprcompliance.com`

## Integration Notes

- **Blocks:** TASK-2104 (code changes should only happen after infra is verified)
- **Related:** BACKLOG-837 will later add `admin.keeprcompliance.com` using the same pattern

## When to Stop and Ask

- If the Vercel project uses a different domain configuration than expected
- If Supabase auth settings show unexpected redirect URL patterns
- If Google/Azure OAuth has multiple client IDs and it's unclear which one to update

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~5K (engineer verifies; user does manual steps)

**Token Cap:** 20K

**Confidence:** High — this is manual infra work, minimal agent tokens needed.
