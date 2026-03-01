# Security Vulnerability Audit Report

**Date:** 2026-03-01
**Scope:** Full codebase — Electron app, broker portal (Next.js), Supabase backend
**Auditor:** Automated security analysis

---

## Executive Summary

The Keepr codebase demonstrates **strong security fundamentals** overall. The Electron application properly uses `contextIsolation`, `nodeIntegration: false`, well-scoped `contextBridge` APIs, encrypted SQLite storage with OS keychain integration, and a strict Content Security Policy. However, the audit identified **several findings that warrant attention**, including a critical RLS misconfiguration, path traversal vulnerabilities in IPC handlers, an open redirect in the broker portal, and missing sandbox hardening on popup windows.

### Risk Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| **CRITICAL** | 1 | Open redirect in broker portal middleware |
| **HIGH** | 3 | Path traversal in `open-folder` IPC handler, popup windows missing sandbox, RLS gap on `analytics_events`/`api_usage`/`user_preferences` tables |
| **MEDIUM** | 7 | Missing OAuth state parameter, missing navigation restrictions, auth popups without sandbox, `unsafe-eval` in broker CSP, `next` param redirect, DOCX preview without strict sanitization, dependency vulnerabilities |
| **LOW** | 3 | style-src unsafe-inline, CSP stripping in auth windows, Google Client ID in docs |

---

## CRITICAL Findings

### C1. Open Redirect in Broker Portal Middleware

**File:** `broker-portal/middleware.ts:100-101`
**Severity:** CRITICAL

```typescript
const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/dashboard';
return NextResponse.redirect(new URL(redirectTo, request.url));
```

The `redirectTo` query parameter is used directly in a redirect without validation. An attacker can craft a URL like:

```
https://keeprcompliance.com/login?redirectTo=https://evil.com
```

After a user authenticates, they are redirected to the attacker's site, enabling phishing attacks.

**Also present in:** `broker-portal/app/auth/callback/route.ts:21,64` (the `next` query parameter):

```typescript
const next = searchParams.get('next') ?? '/dashboard';
// ...
return NextResponse.redirect(`${origin}${next}`);
```

**Recommendation:** Validate that the redirect target is a relative path:

```typescript
function safeRedirectPath(input: string): string {
  // Only allow relative paths starting with /
  if (!input.startsWith('/') || input.startsWith('//')) {
    return '/dashboard';
  }
  return input;
}
```

---

## HIGH Findings

### H1. Path Traversal in `open-folder` IPC Handler

**File:** `electron/handlers/conversationHandlers.ts:450-459`
**Severity:** HIGH

```typescript
ipcMain.handle(
  "open-folder",
  async (event: IpcMainInvokeEvent, folderPath: string) => {
    await shell.openPath(folderPath);
    return { success: true };
  }
);
```

The `folderPath` parameter is passed directly to `shell.openPath()` with **no validation** — no path traversal checks, no directory scoping, no length limits. A compromised renderer process (or XSS) could open arbitrary system directories.

**Also affects:** `electron/handlers/systemHandlers.ts:1022-1044` — `system:show-in-folder` validates string length but does not check for `../` traversal sequences.

**Recommendation:** Add path normalization and directory scoping:

```typescript
const normalizedPath = path.resolve(folderPath);
const allowedPaths = [app.getPath("documents"), app.getPath("downloads"), app.getPath("userData")];
if (!allowedPaths.some(base => normalizedPath.startsWith(base))) {
  return { success: false, error: "Access denied" };
}
```

---

### H2. Popup Windows Missing Sandbox and Preload

**File:** `electron/handlers/systemHandlers.ts:1001-1010`
**Severity:** HIGH

```typescript
const popupWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    // No sandbox: true
    // No preload script
  },
});
popupWindow.loadURL(validatedUrl);  // Loads external URL
```

Popup windows created for external URLs lack `sandbox: true` and a preload script. While `contextIsolation` is enabled, adding explicit sandbox mode provides defense-in-depth for untrusted content.

**Recommendation:** Add `sandbox: true` to webPreferences for all windows loading external content. This also applies to auth popup windows in `googleAuthHandlers.ts` and `microsoftAuthHandlers.ts`.

---

### H3. Supabase RLS Gap on Analytics/Preferences/API-Usage Tables

**File:** `supabase_schema.sql:172-188`
**Severity:** HIGH

The base schema defines permissive `USING (true)` policies on all tables. Later migrations (`20260221_fix_rls_users_licenses_devices.sql`, `20260124_rls_restore_complete.sql`) properly fix the `users`, `licenses`, `devices`, `organizations`, `organization_members`, and `transaction_submissions` tables with user-scoped policies.

However, the following tables still have overly permissive RLS policies:

- **`analytics_events`** — `FOR ALL USING (true)` (any user can read all analytics)
- **`user_preferences`** — `FOR ALL USING (true)` (any user can read/modify all preferences)
- **`api_usage`** — `FOR ALL USING (true)` (any user can read all API usage records)

The migration `20260221_fix_rls_users_licenses_devices.sql` explicitly notes this: *"user_preferences had FOR ALL USING(true) for both authenticated and anon roles. That table is OUT OF SCOPE for this migration but is flagged for a future task."*

**Impact:** Any authenticated user can read and modify other users' preferences and analytics data via the Supabase client.

**Recommendation:** Add user-scoped policies:

```sql
CREATE POLICY "users_select_own_preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## MEDIUM Findings

### M1. Missing OAuth State Parameter (CSRF Protection)

**Files:** `electron/handlers/googleAuthHandlers.ts`, `electron/handlers/microsoftAuthHandlers.ts`
**Severity:** MEDIUM

Neither Google nor Microsoft OAuth handlers implement the OAuth `state` parameter for CSRF protection. While PKCE provides some protection against authorization code interception, the `state` parameter is the standard defense against cross-site request forgery in OAuth flows.

**Recommendation:** Generate a cryptographically random state value, include it in the authorization URL, and validate it in the callback.

---

### M2. Missing Navigation Restrictions

**File:** `electron/main.ts`
**Severity:** MEDIUM

No `will-navigate` or `setWindowOpenHandler` handlers are registered on the main window. This means renderer-initiated navigation to arbitrary URLs is unrestricted, and `window.open()` calls could create popups to untrusted sites.

**Recommendation:** Add navigation event handlers after window creation:

```typescript
mainWindow.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('app://')) event.preventDefault();
});
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  if (url.startsWith('https://') || url.startsWith('mailto:')) {
    shell.openExternal(url);
  }
  return { action: 'deny' };
});
```

---

### M3. Broker Portal CSP Allows `unsafe-eval`

**File:** `broker-portal/next.config.js:13`
**Severity:** MEDIUM

```javascript
"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms"
```

The broker portal's CSP allows `unsafe-eval` in production to support Microsoft Clarity analytics (`new Function()`). This weakens XSS protections significantly.

**Recommendation:** Evaluate Clarity alternatives or use nonce-based CSP. If Clarity is required, document this as an accepted risk and ensure other XSS protections (input sanitization, output encoding) are robust.

---

### M4. DOCX Preview Uses `dangerouslySetInnerHTML`

**File:** `src/components/transactionDetailsModule/components/modals/AttachmentPreviewModal.tsx:356`
**Severity:** MEDIUM

```tsx
dangerouslySetInnerHTML={{ __html: docxHtml }}
```

The DOCX content is sanitized via `DOMPurify.sanitize(convertResult.value, { USE_PROFILES: { html: true } })` which is good. However, `USE_PROFILES: { html: true }` is a permissive profile that allows many tags and attributes. The email view modals use a more restrictive `ALLOWED_TAGS` list, which is better practice.

**Recommendation:** Use an explicit `ALLOWED_TAGS` and `ALLOWED_ATTR` list instead of the broad `USE_PROFILES: { html: true }` profile, consistent with the approach in `EmailViewModal.tsx`.

---

### M5. Dependency Vulnerabilities

**Severity:** MEDIUM

`npm audit` reports **12 vulnerabilities** (1 moderate, 11 high):

| Package | Severity | Issue |
|---------|----------|-------|
| `tar` < 7.5.8 | HIGH | Arbitrary file read/write via hardlink/symlink chain (GHSA-83g3-92jg-28cx) |
| `ajv` < 6.14.0 | MODERATE | ReDoS with `$data` option |

These are in build-time dependencies (`@electron/rebuild`, `electron-builder`, `node-gyp`) and do not directly affect runtime security, but should be updated to reduce supply chain risk.

**Recommendation:** Run `npm audit fix` for the ajv fix. For tar, evaluate `npm audit fix --force` in a test environment.

---

### M6. `next` Parameter in Auth Callback Allows Path Injection

**File:** `broker-portal/app/auth/callback/route.ts:21,64`
**Severity:** MEDIUM (related to C2)

```typescript
const next = searchParams.get('next') ?? '/dashboard';
return NextResponse.redirect(`${origin}${next}`);
```

While this uses `${origin}${next}` (prepending the origin), if `next` starts with `//evil.com`, the resulting URL `https://keeprcompliance.com//evil.com` could be interpreted as a protocol-relative redirect in some browsers.

**Recommendation:** Validate that `next` starts with `/` and does not start with `//`.

---

### M7. CSP Headers Stripped in Auth Windows

**Files:** `electron/handlers/googleAuthHandlers.ts:166-168`, `electron/handlers/microsoftAuthHandlers.ts:141-143`
**Severity:** MEDIUM

Auth popup windows strip CSP headers from Google and Microsoft domains to allow their login pages to function. This is a known trade-off but should be documented as an accepted risk.

---

## LOW Findings

### L1. `style-src 'unsafe-inline'` in Production CSP

**File:** `electron/main.ts:719`

Both dev and production CSP include `style-src 'self' 'unsafe-inline'`. This is common for CSS-in-JS but weakens CSP style injection protections.

### L2. Google Client ID in Documentation

**File:** `GOOGLE_OAUTH_SETUP.md`

A real Google Client ID is committed in the setup guide. While Client IDs are public by design, replacing it with a placeholder reduces project fingerprinting.

### L3. `document.write` in Conversation Modal

**File:** `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx:123`

```typescript
win.document.write(`<img src="${dataUrl}" ...`);
```

Uses `document.write` to render an image in a new window. The `dataUrl` comes from a local data URL (base64), so risk is low, but `document.write` is deprecated and generally discouraged.

---

## Positive Security Findings

The following areas demonstrate strong security practices:

| Area | Details |
|------|---------|
| **Electron Core Config** | `nodeIntegration: false`, `contextIsolation: true` on all windows |
| **Context Bridge** | Well-scoped API exposure, no dangerous module exposure |
| **Database Encryption** | AES-256 via `better-sqlite3-multiple-ciphers`, keys stored in OS keychain via `safeStorage` |
| **Token Encryption** | OAuth tokens encrypted with Electron `safeStorage` API |
| **SQL Injection Prevention** | Field whitelist (`sqlFieldWhitelist.ts`) for dynamic SQL, parameterized queries |
| **Input Validation** | Comprehensive UUID, email, string, UDID validators with regex enforcement |
| **Command Injection Prevention** | UDID validated before `spawn()`, executable paths validated against traversal |
| **Sensitive Data Redaction** | `redactSensitive.ts` redacts emails, tokens, IDs in logs |
| **Deep Link Security** | Token redaction in logs, URL validation, proper Supabase session handling |
| **OAuth Implementation** | PKCE flow for both Google and Microsoft, proper token lifecycle |
| **Session Management** | 30-min idle timeout, 24-hour absolute timeout |
| **XSS Prevention** | DOMPurify sanitization for email HTML rendering, HTML escaping helpers |
| **Permission Handling** | Deny-by-default permission model, explicit whitelist for clipboard/notifications |
| **Production CSP** | No `unsafe-eval`, explicit domain whitelist for `connect-src`, `frame-ancestors: none` |
| **Export Security** | Validates exports don't contain OAuth tokens, API keys, or credentials |

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | C1 — Validate redirect URLs in broker portal middleware and auth callback | Low |
| 2 | H1 — Add path validation/scoping to `open-folder` handler | Low |
| 3 | H2 — Add `sandbox: true` to popup/auth windows | Low |
| 4 | H3 — Fix RLS policies on `analytics_events`, `user_preferences`, `api_usage` | Medium |
| 5 | M1 — Add OAuth state parameter for CSRF protection | Low |
| 6 | M2 — Add `will-navigate` restrictions to main window | Low |
| 7 | M3 — Evaluate Clarity `unsafe-eval` requirement | Medium |
| 8 | M4 — Tighten DOMPurify config for DOCX preview | Low |
| 9 | M5 — Update vulnerable dependencies | Low |
