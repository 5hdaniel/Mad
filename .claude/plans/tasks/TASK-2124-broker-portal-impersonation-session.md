# TASK-2124: Broker Portal Impersonation Session & Support Banner

**Backlog ID:** BACKLOG-866
**Sprint:** SPRINT-116
**Phase:** Phase 2 - Portal Integration (Parallel with TASK-2123)
**Depends On:** TASK-2122 (schema + RPCs must be merged first)
**Branch:** `feature/task-2124-broker-impersonation`
**Branch From:** `int/sprint-116-impersonation`
**Branch Into:** `int/sprint-116-impersonation`
**Estimated Tokens:** ~35K (service category x 0.5 = ~18K adjusted)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add an impersonation entry point to the broker portal that accepts an impersonation token via URL, validates it against the database, loads the target user's data without creating a real auth session, and displays a persistent purple support banner with a countdown timer showing the remaining session time.

## Non-Goals

- Do NOT modify the admin portal -- that is TASK-2123
- Do NOT modify the database schema -- that is TASK-2122
- Do NOT implement write operations during impersonation (read-only by design)
- Do NOT create a real Supabase auth session for the target user -- use server-side data loading
- Do NOT modify the existing AuthProvider to handle impersonation state (use a separate provider)
- Do NOT allow navigation to settings or write actions during impersonation

## Deliverables

1. New file: `broker-portal/app/auth/impersonate/route.ts` -- API route to validate token and set impersonation cookie
2. New file: `broker-portal/components/ImpersonationBanner.tsx` -- Persistent purple banner with countdown
3. New file: `broker-portal/components/providers/ImpersonationProvider.tsx` -- Client context for impersonation state
4. New file: `broker-portal/lib/impersonation.ts` -- Server-side helpers for impersonation session management
5. Update: `broker-portal/app/layout.tsx` -- Add ImpersonationProvider wrapper
6. Update: `broker-portal/app/dashboard/layout.tsx` -- Add ImpersonationBanner + conditionally hide write actions
7. Update: `broker-portal/middleware.ts` -- Allow impersonation routes, pass impersonation context

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/app/auth/impersonate/route.ts` (new)
- `broker-portal/components/ImpersonationBanner.tsx` (new)
- `broker-portal/components/providers/ImpersonationProvider.tsx` (new)
- `broker-portal/lib/impersonation.ts` (new)
- `broker-portal/app/layout.tsx`
- `broker-portal/app/dashboard/layout.tsx`
- `broker-portal/middleware.ts`

### Files this task must NOT modify:

- `broker-portal/components/providers/AuthProvider.tsx` -- Do not mix impersonation into normal auth
- `broker-portal/app/auth/callback/route.ts` -- Normal auth flow unchanged
- Any `admin-portal/` files -- Owned by TASK-2123
- Any `supabase/` files -- Owned by TASK-2122

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `/auth/impersonate?token=<UUID>` route validates the token via `admin_validate_impersonation_token` RPC
- [ ] Valid token: sets an HTTP-only impersonation cookie and redirects to `/dashboard`
- [ ] Invalid/expired token: redirects to `/login?error=impersonation_failed`
- [ ] Impersonation cookie contains: session_id, target_user_id, admin_user_id, expires_at
- [ ] Impersonation cookie has `SameSite=Strict`, `Secure=true`, `HttpOnly=true`
- [ ] Impersonation cookie expires at the session's `expires_at` time
- [ ] Dashboard layout shows persistent purple banner at top when impersonating
- [ ] Banner displays: "Support Session -- Viewing as {user_email} -- {MM:SS} remaining -- [End Session]"
- [ ] Countdown timer updates every second and shows time remaining
- [ ] When countdown reaches 0, banner shows "Session Expired" and offers redirect to admin portal
- [ ] "End Session" button calls `admin_end_impersonation` RPC, clears cookie, redirects to admin portal
- [ ] During impersonation, write action buttons/links are hidden or disabled
- [ ] Middleware allows `/auth/impersonate` route without normal auth
- [ ] Middleware detects impersonation cookie and loads data as target user on dashboard routes
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### Architecture Overview

```
Admin Portal                    Broker Portal
    |                               |
    | 1. Calls admin_start_         |
    |    impersonation RPC          |
    |                               |
    | 2. Opens new tab:             |
    |    /auth/impersonate?token=X  |
    |                               |
    |                    3. Route validates token
    |                       via admin_validate_
    |                       impersonation_token RPC
    |                               |
    |                    4. Sets HTTP-only cookie
    |                       with session details
    |                               |
    |                    5. Redirects to /dashboard
    |                               |
    |                    6. Middleware detects cookie,
    |                       creates Supabase admin
    |                       client to load target
    |                       user's data
    |                               |
    |                    7. Dashboard renders with
    |                       target user's data +
    |                       purple banner
```

### 1. Impersonation Entry Route (`/auth/impersonate/route.ts`)

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  // Validate token using service role client (no user session needed)
  const supabase = await createClient(); // NOTE: may need service role
  const { data, error } = await supabase.rpc('admin_validate_impersonation_token', {
    p_token: token,
  });

  if (error || !data?.valid) {
    const errorCode = data?.error || 'invalid_token';
    return NextResponse.redirect(`${origin}/login?error=impersonation_${errorCode}`);
  }

  // Set impersonation cookie
  const cookieStore = await cookies();
  const impersonationData = {
    session_id: data.session_id,
    target_user_id: data.target_user_id,
    admin_user_id: data.admin_user_id,
    target_email: data.target_email,
    target_name: data.target_name,
    expires_at: data.expires_at,
    started_at: data.started_at,
  };

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.set('impersonation_session', JSON.stringify(impersonationData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: new Date(data.expires_at),
  });

  return response;
}
```

**IMPORTANT:** The token validation RPC is `SECURITY DEFINER`, so it can be called without a user session. However, the broker portal's Supabase client uses the anon key. Verify that the `admin_validate_impersonation_token` function has `GRANT EXECUTE ... TO anon` or `TO authenticated`. If it only grants to `authenticated`, the route may need to use a service role client. Check TASK-2122's implementation for the grant.

If the grant is only to `authenticated`, you have two options:
1. Add a service role Supabase client to the broker portal (recommended)
2. Ask PM to update TASK-2122 to also grant to `anon`

Choose option 1 if possible -- create a `broker-portal/lib/supabase/service.ts` using `SUPABASE_SERVICE_ROLE_KEY` from env.

### 2. ImpersonationProvider (`components/providers/ImpersonationProvider.tsx`)

```typescript
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ImpersonationState {
  isImpersonating: boolean;
  sessionId: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  targetName: string | null;
  adminUserId: string | null;
  expiresAt: Date | null;
  remainingSeconds: number;
  endSession: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  sessionId: null,
  targetUserId: null,
  targetEmail: null,
  targetName: null,
  adminUserId: null,
  expiresAt: null,
  remainingSeconds: 0,
  endSession: async () => {},
});

// Props are passed from the server component that reads the cookie
interface ImpersonationProviderProps {
  children: ReactNode;
  session?: {
    session_id: string;
    target_user_id: string;
    target_email: string;
    target_name: string;
    admin_user_id: string;
    expires_at: string;
  } | null;
}

export function ImpersonationProvider({ children, session }: ImpersonationProviderProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!session) return;

    const expiresAt = new Date(session.expires_at).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const endSession = async () => {
    // Call API route to end session
    await fetch('/api/impersonation/end', { method: 'POST' });
    // Redirect to admin portal
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'https://admin.keeprcompliance.com';
    window.location.href = `${adminUrl}/dashboard/users`;
  };

  const value: ImpersonationState = {
    isImpersonating: !!session,
    sessionId: session?.session_id || null,
    targetUserId: session?.target_user_id || null,
    targetEmail: session?.target_email || null,
    targetName: session?.target_name || null,
    adminUserId: session?.admin_user_id || null,
    expiresAt: session ? new Date(session.expires_at) : null,
    remainingSeconds,
    endSession,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export const useImpersonation = () => useContext(ImpersonationContext);
```

### 3. ImpersonationBanner (`components/ImpersonationBanner.tsx`)

```tsx
'use client';

import { useImpersonation } from '@/components/providers/ImpersonationProvider';
import { Shield, X } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, targetEmail, remainingSeconds, endSession } = useImpersonation();

  if (!isImpersonating) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isExpired = remainingSeconds <= 0;

  return (
    <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span className="font-medium">Support Session</span>
        <span className="text-purple-200">|</span>
        <span>Viewing as <strong>{targetEmail}</strong></span>
        <span className="text-purple-200">|</span>
        {isExpired ? (
          <span className="text-yellow-200 font-medium">Session Expired</span>
        ) : (
          <span className="tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} remaining
          </span>
        )}
      </div>
      <button
        onClick={endSession}
        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-700 hover:bg-purple-800 transition-colors text-xs font-medium"
      >
        <X className="h-3 w-3" />
        End Session
      </button>
    </div>
  );
}
```

### 4. Impersonation Helpers (`lib/impersonation.ts`)

```typescript
import { cookies } from 'next/headers';

export interface ImpersonationSession {
  session_id: string;
  target_user_id: string;
  admin_user_id: string;
  target_email: string;
  target_name: string;
  expires_at: string;
  started_at: string;
}

/**
 * Read impersonation session from cookie (server-side only).
 * Returns null if no active impersonation or if session is expired.
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('impersonation_session')?.value;
  if (!raw) return null;

  try {
    const session: ImpersonationSession = JSON.parse(raw);

    // Check expiry
    if (new Date(session.expires_at) <= new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
```

### 5. End Session API Route

Create `broker-portal/app/api/impersonation/end/route.ts`:

```typescript
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getImpersonationSession } from '@/lib/impersonation';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getImpersonationSession();

  if (session) {
    // Call RPC to end session (needs admin's auth or service role)
    // Since the admin isn't logged in to the broker portal,
    // use a service role client
    try {
      const supabase = await createClient(); // or service role client
      await supabase.rpc('admin_end_impersonation', {
        p_session_id: session.session_id,
      });
    } catch (e) {
      console.error('Error ending impersonation session:', e);
    }
  }

  // Clear the cookie
  const cookieStore = await cookies();
  cookieStore.delete('impersonation_session');

  return NextResponse.json({ success: true });
}
```

**IMPORTANT NOTE on auth for ending sessions:** The `admin_end_impersonation` RPC checks `auth.uid()` which would be the admin's ID. But the broker portal doesn't have the admin's session. Two approaches:

Option A (Recommended): Create a new simpler RPC `end_impersonation_by_session_id(p_session_id, p_token)` that validates by matching the token rather than `auth.uid()`. This would go in TASK-2122 but since it's already complete, the engineer should check: if `admin_end_impersonation` requires `auth.uid()` matching, create a `broker_end_impersonation` RPC that validates by token instead. Add it as a small migration file.

Option B: Use a Supabase service role client that bypasses RLS and directly updates the session.

The engineer should evaluate which approach is cleaner. If adding a migration, name it `20260308_broker_end_impersonation.sql`.

### 6. Layout Updates

**`app/layout.tsx`** -- Add ImpersonationProvider:

```tsx
import { ImpersonationProvider } from '@/components/providers/ImpersonationProvider';
import { getImpersonationSession } from '@/lib/impersonation';

export default async function RootLayout({ children }) {
  const impersonationSession = await getImpersonationSession();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ImpersonationProvider session={impersonationSession}>
            <main className="min-h-screen">{children}</main>
          </ImpersonationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

**`app/dashboard/layout.tsx`** -- Add banner + hide write actions:

```tsx
// Add ImpersonationBanner above the nav
<div className="min-h-screen bg-gray-100">
  <ImpersonationBanner />
  <nav className="bg-white shadow-sm">
    {/* existing nav content */}
    {/* Conditionally hide settings link during impersonation */}
  </nav>
  <main>{children}</main>
</div>
```

### 7. Middleware Updates

The middleware needs to:
1. Allow `/auth/impersonate` without requiring authentication
2. When impersonation cookie exists on `/dashboard` routes, skip normal auth redirect and allow access

```typescript
// In middleware.ts, add to the matcher logic:
const isImpersonationRoute = pathname === '/auth/impersonate';

// Skip auth check for impersonation route
if (isImpersonationRoute) {
  return response;
}

// For dashboard routes, check for impersonation cookie
const impersonationCookie = request.cookies.get('impersonation_session');
if (isProtectedRoute && impersonationCookie) {
  // Impersonation session active -- allow access without normal auth
  // The page components will load data for the target user
  return response;
}
```

### 8. Data Loading During Impersonation

For the dashboard pages to load the target user's data instead of the logged-in user's data, the server components need to check for the impersonation session and query data for the target user.

**Approach:** In `app/dashboard/page.tsx` and other server components that call `supabase.auth.getUser()`, add a check:

```typescript
import { getImpersonationSession } from '@/lib/impersonation';

// In server component:
const impersonation = await getImpersonationSession();
const effectiveUserId = impersonation?.target_user_id || user.id;

// Use effectiveUserId for data queries
```

**IMPORTANT:** Since RLS is tied to `auth.uid()`, queries during impersonation won't return the target user's data with the normal client. Two solutions:

Option A (Recommended): Use a Supabase service role client during impersonation to bypass RLS. Create `broker-portal/lib/supabase/service.ts`:
```typescript
import { createClient as createAdminClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

Then in server components during impersonation, use the service client with `.eq('user_id', effectiveUserId)` filters.

Option B: Create RLS-aware views/RPCs for impersonation data access.

The engineer should use Option A for simplicity, but ensure the service role key is only used server-side (never exposed to client).

### Environment Variables Needed

Add to `broker-portal/.env.local.example`:
```
NEXT_PUBLIC_ADMIN_PORTAL_URL=https://admin.keeprcompliance.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Integration Notes

- **Depends on:** TASK-2122 (`admin_validate_impersonation_token` and `admin_end_impersonation` RPCs)
- **Parallel with:** TASK-2123 (admin portal -- no shared files)
- **Uses:** Broker portal's existing Supabase client infrastructure
- **Token URL format:** `/auth/impersonate?token=<UUID>` (TASK-2123 opens this URL)

## Do / Don't

### Do:
- Use HTTP-only cookies for impersonation state (not localStorage)
- Use `SameSite=Strict` and `Secure=true` for the impersonation cookie
- Use purple color theme (#7c3aed / purple-600) for the banner -- visually distinct
- Use tabular-nums for the countdown timer (prevents layout shift)
- Make the banner sticky (fixed to top, z-50) so it's always visible
- Add `SUPABASE_SERVICE_ROLE_KEY` to env for server-side data access
- Ensure the service role key is NEVER exposed to client-side code

### Don't:
- Do NOT create a real Supabase auth session for the target user
- Do NOT modify the existing AuthProvider
- Do NOT allow write operations during impersonation (hide buttons, disable forms)
- Do NOT expose the impersonation token in client-side JavaScript
- Do NOT allow impersonation session to extend beyond 30 minutes
- Do NOT hardcode admin portal URL -- use environment variable

## When to Stop and Ask

- If `admin_validate_impersonation_token` RPC requires `authenticated` role and anon can't call it
- If the broker portal's RLS prevents loading target user data even with service role client
- If the middleware changes break existing auth flow
- If you need to modify AuthProvider.tsx (scope boundary violation)
- If the data loading pattern is significantly different from what's described

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (broker portal has limited test setup)
- Check `broker-portal/package.json` for test scripts

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Manual verification:
  - Navigate to `/auth/impersonate?token=<valid-token>` -- should redirect to dashboard
  - Navigate to `/auth/impersonate?token=<invalid-token>` -- should redirect to login with error
  - Purple banner visible with correct user email
  - Countdown timer decrements correctly
  - "End Session" clears cookie and redirects to admin portal
  - Write actions (submit, edit, etc.) are hidden during impersonation
  - Expired session shows "Session Expired" message

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check` or `npx tsc --noEmit` in broker-portal)
- [ ] Lint checks (if configured)
- [ ] Build succeeds (`npm run build` in broker-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker): add impersonation session and support banner`
- **Labels**: `broker-portal`, `sprint-116`
- **Depends on**: TASK-2122 (schema must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~18K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 new files | +15K |
| Files to modify | 3 existing files | +10K |
| Code volume | ~400 lines new, ~50 lines modified | +10K |
| Middleware complexity | Auth flow changes need care | +5K |
| Service multiplier | x 0.5 | Applied |

**Confidence:** Medium

**Risk factors:**
- RLS bypass for impersonation data loading adds complexity
- Middleware changes could break existing auth flow
- Service role client setup adds an additional file
- Cookie-based session management is security-sensitive

**Similar past tasks:** TASK-2116 (user detail actions) was simpler; this is more complex due to cross-portal auth

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] broker-portal/app/auth/impersonate/route.ts
- [ ] broker-portal/components/ImpersonationBanner.tsx
- [ ] broker-portal/components/providers/ImpersonationProvider.tsx
- [ ] broker-portal/lib/impersonation.ts
- [ ] broker-portal/lib/supabase/service.ts
- [ ] broker-portal/app/api/impersonation/end/route.ts

Files modified:
- [ ] broker-portal/app/layout.tsx
- [ ] broker-portal/app/dashboard/layout.tsx
- [ ] broker-portal/middleware.ts
- [ ] broker-portal/.env.local.example

Features implemented:
- [ ] Token validation and cookie setting
- [ ] ImpersonationProvider with countdown timer
- [ ] Purple support banner
- [ ] End session functionality
- [ ] Middleware impersonation bypass
- [ ] Write action hiding during impersonation

Verification:
- [ ] npm run type-check passes (in broker-portal/)
- [ ] npm run build passes (in broker-portal/)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~35K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-116-impersonation

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
