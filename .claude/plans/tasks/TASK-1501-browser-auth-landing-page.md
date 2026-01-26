# Task TASK-1501: Browser Auth Landing Page

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-483
**Status**: Blocked (Waiting for TASK-1500)
**Execution**: Sequential (Phase 1, Step 2)

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1500 merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1501-browser-auth-page`

---

## Goal

Create a web page in the broker-portal that handles OAuth authentication and redirects to the desktop app via the `magicaudit://` deep link.

## Non-Goals

- Do NOT modify the desktop app login UI (separate task)
- Do NOT implement license validation on the web page
- Do NOT implement team/org membership checks here
- Do NOT create a full web app - just auth pages

---

## Estimated Tokens

**Est. Tokens**: ~30K (ui)
**Token Cap**: ~120K (4x estimate)

---

## Deliverables

### Files to Create

| File | Action | Description |
|------|--------|-------------|
| `broker-portal/app/auth/desktop/page.tsx` | Create | Login page with OAuth buttons |
| `broker-portal/app/auth/desktop/callback/page.tsx` | Create | OAuth callback handler |
| `broker-portal/app/auth/desktop/layout.tsx` | Create | Optional layout wrapper |

### Configuration Changes

- Update Supabase redirect URLs in dashboard

---

## Implementation Notes

### Step 1: Auth Landing Page

Create `broker-portal/app/auth/desktop/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DesktopAuthPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const loginWithProvider = async (provider: 'google' | 'azure') => {
    try {
      setLoading(provider);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/desktop/callback`,
          scopes: provider === 'azure' ? 'email profile openid' : undefined,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Magic Audit</h1>
          <p className="mt-2 text-gray-600">Sign in to continue to the desktop app</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Login Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => loginWithProvider('google')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'google' ? (
              <span>Signing in...</span>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 mr-3" />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <button
            onClick={() => loginWithProvider('azure')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'azure' ? (
              <span>Signing in...</span>
            ) : (
              <>
                <MicrosoftIcon className="w-5 h-5 mr-3" />
                <span>Continue with Microsoft</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          After signing in, you&apos;ll be redirected back to Magic Audit.
        </p>
      </div>
    </div>
  );
}

// Simple SVG icons
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
```

### Step 2: OAuth Callback Page

Create `broker-portal/app/auth/desktop/callback/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'loading' | 'redirecting' | 'success' | 'error';

export default function DesktopCallbackPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [deepLinkUrl, setDeepLinkUrl] = useState<string>('');

  const handleCallback = useCallback(async () => {
    const supabase = createClient();

    try {
      // Get session from Supabase (handles hash fragment automatically)
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      if (!session) {
        setStatus('error');
        setErrorMessage('No session found. Please try signing in again.');
        return;
      }

      // Build deep link URL with tokens
      const callbackUrl = new URL('magicaudit://callback');
      callbackUrl.searchParams.set('access_token', session.access_token);
      callbackUrl.searchParams.set('refresh_token', session.refresh_token);

      const deepLink = callbackUrl.toString();
      setDeepLinkUrl(deepLink);
      setStatus('redirecting');

      // Attempt to redirect to desktop app
      window.location.href = deepLink;

      // After a delay, if we're still here, show success with manual link
      setTimeout(() => {
        setStatus('success');
      }, 2000);

    } catch (err) {
      setStatus('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  }, []);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow text-center">

        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-600">Signing you in...</p>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
            <p className="text-gray-900 font-medium">Opening Magic Audit...</p>
            <p className="text-gray-500 text-sm">You should be redirected automatically.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-600">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">Sign in successful!</p>
            <p className="text-gray-500 text-sm">
              If Magic Audit didn&apos;t open automatically, click the button below.
            </p>
            <a
              href={deepLinkUrl}
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Open Magic Audit
            </a>
            <p className="text-gray-400 text-xs mt-4">
              You can close this browser tab after Magic Audit opens.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-600">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">Sign in failed</p>
            <p className="text-red-600 text-sm">{errorMessage}</p>
            <a
              href="/auth/desktop"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </a>
          </>
        )}

      </div>
    </div>
  );
}
```

### Step 3: Layout (Optional)

Create `broker-portal/app/auth/desktop/layout.tsx`:

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in - Magic Audit',
  description: 'Sign in to Magic Audit desktop application',
};

export default function DesktopAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

### Step 4: Update Supabase Configuration

In Supabase Dashboard:
1. Go to Authentication > URL Configuration
2. Add to "Redirect URLs":
   - `https://app.magicaudit.com/auth/desktop/callback`
   - `http://localhost:3000/auth/desktop/callback` (for local dev)

**Note**: Document this requirement for the engineer but actual Supabase config changes may need to be done manually or via Supabase CLI.

---

## Testing Requirements

### Manual Testing

1. **Full OAuth Flow (Google)**:
   - Go to `http://localhost:3000/auth/desktop` (or deployed URL)
   - Click "Continue with Google"
   - Complete Google OAuth
   - Verify redirect to `magicaudit://callback?...`
   - Verify desktop app receives tokens (from TASK-1500)

2. **Full OAuth Flow (Microsoft)**:
   - Same as above with Microsoft

3. **Error Handling**:
   - Test with invalid/expired session
   - Test manual link when auto-redirect fails

4. **Deep Link Fallback**:
   - Block automatic redirect (browser popup blocker)
   - Verify manual "Open Magic Audit" button works

---

## Acceptance Criteria

- [ ] Auth page at `/auth/desktop` shows Google and Microsoft login buttons
- [ ] OAuth flow completes successfully with both providers
- [ ] Callback page receives session from Supabase
- [ ] Callback page redirects to `magicaudit://callback` with tokens
- [ ] Fallback link works if auto-redirect fails
- [ ] Loading/redirect/success/error states clearly shown
- [ ] Error messages are user-friendly
- [ ] Pages are responsive (mobile-friendly not required but nice to have)
- [ ] `npm run type-check` passes in broker-portal
- [ ] `npm run lint` passes in broker-portal

---

## Integration Notes

- **Depends on**: TASK-1500 (deep link handler must receive the callback)
- **Next**: TASK-1502 (user manual test of full auth flow)
- **Later**: Desktop login UI will be updated to open this URL

---

## Do / Don't

### Do:
- Use existing Supabase client from broker-portal
- Handle all OAuth providers consistently
- Show clear status to user at each step
- Provide fallback if automatic redirect fails
- Use consistent styling with broker-portal

### Don't:
- Don't implement any license/org checking on these pages
- Don't store tokens in browser localStorage (they go to desktop via deep link)
- Don't use `window.open()` (use `window.location.href`)
- Don't assume OAuth will always succeed - handle errors

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Supabase OAuth configuration is unclear
- Browser blocks deep link redirect
- Need to support additional OAuth providers
- Styling requirements are unclear

---

## PR Preparation

**Title**: `feat: add browser auth landing page for desktop app`

**Labels**: `sprint-062`, `auth`, `broker-portal`

**PR Body Template**:
```markdown
## Summary
- Create `/auth/desktop` page with Google/Microsoft OAuth buttons
- Create `/auth/desktop/callback` page to redirect to desktop app
- Handle success, error, and fallback states

## Test Plan
- [ ] Google OAuth flow completes
- [ ] Microsoft OAuth flow completes
- [ ] Desktop app opens via deep link (with TASK-1500)
- [ ] Fallback manual link works
- [ ] Error states display correctly

## Supabase Configuration Required
Add to redirect URLs:
- `https://app.magicaudit.com/auth/desktop/callback`
- `http://localhost:3000/auth/desktop/callback` (dev)

## Dependencies
- TASK-1500 must be merged for full flow to work
```

---

## Implementation Summary

*To be completed by Engineer after implementation*

### Files Changed
- [ ] List actual files modified

### Approach Taken
- [ ] Describe implementation decisions

### Testing Done
- [ ] List manual tests performed
- [ ] Note any edge cases discovered

### Notes for SR Review
- [ ] Any concerns or areas needing extra review
