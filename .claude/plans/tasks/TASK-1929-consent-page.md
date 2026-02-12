# Task TASK-1929: Create Admin Consent Page and Callback

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**
See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Create a new `/setup/consent` page that redirects IT admins to Microsoft's admin consent URL so they can pre-approve desktop app permissions (Mail.Read, Contacts.Read) for all tenant users. Also create the `/setup/consent/callback` route to capture the consent result and update the org record.

## Non-Goals

- Do NOT modify the login callback (already fixed in TASK-1926)
- Do NOT modify the main `/setup` page
- Do NOT implement SCIM functionality
- Do NOT handle Google Workspace consent (Microsoft only)
- Do NOT auto-redirect to consent from the setup callback yet (that is TASK-1930)

## Deliverables

1. New page: `broker-portal/app/setup/consent/page.tsx` -- consent redirect page
2. New route: `broker-portal/app/setup/consent/callback/route.ts` -- consent callback
3. Update: `broker-portal/middleware.ts` -- add `/setup/consent` to auth routes (if needed)

## Acceptance Criteria

- [ ] `/setup/consent?tenant={tid}&org={org_id}` page renders with explanation text
- [ ] Page shows "Grant Permissions" button that redirects to Microsoft admin consent URL
- [ ] Page shows "Skip for now" link that goes to `/dashboard`
- [ ] Microsoft admin consent URL format: `https://login.microsoftonline.com/{tenant}/adminconsent?client_id={DESKTOP_CLIENT_ID}&redirect_uri={origin}/setup/consent/callback&state={org_id}`
- [ ] Consent callback captures `admin_consent=True` from query params
- [ ] Consent callback updates `organizations.graph_admin_consent_granted = true` and `graph_admin_consent_at = NOW()`
- [ ] Consent callback redirects to `/dashboard` on success
- [ ] Consent callback handles errors gracefully (shows error, still allows proceeding to dashboard)
- [ ] `NEXT_PUBLIC_DESKTOP_CLIENT_ID` env var is read from `process.env`
- [ ] Page is accessible only to authenticated users (middleware check)
- [ ] TypeScript compiles clean
- [ ] All CI checks pass

## Implementation Notes

### Consent Page (`broker-portal/app/setup/consent/page.tsx`)

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const DESKTOP_CLIENT_ID = process.env.NEXT_PUBLIC_DESKTOP_CLIENT_ID;

function ConsentForm() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenant');
  const orgId = searchParams.get('org');

  const consentUrl = tenantId && DESKTOP_CLIENT_ID
    ? `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${DESKTOP_CLIENT_ID}&redirect_uri=${window.location.origin}/setup/consent/callback&state=${orgId}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Grant Permissions</h1>
          <p className="mt-4 text-gray-600">
            To allow your team members to sync their emails and contacts with Magic Audit,
            you need to grant admin consent for the desktop application.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This grants Mail.Read and Contacts.Read permissions for all users in your organization.
          </p>
        </div>

        <div className="space-y-4">
          {consentUrl ? (
            <a
              href={consentUrl}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              Grant Permissions
            </a>
          ) : (
            <p className="text-red-600 text-sm">
              Configuration error: Desktop app client ID is not set.
            </p>
          )}

          <a
            href="/dashboard"
            className="w-full flex items-center justify-center px-4 py-3 text-gray-600 hover:text-gray-800"
          >
            Skip for now
          </a>
        </div>

        <p className="text-xs text-gray-400 text-center">
          You can grant these permissions later from the organization settings.
        </p>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <ConsentForm />
    </Suspense>
  );
}
```

### Consent Callback (`broker-portal/app/setup/consent/callback/route.ts`)

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Microsoft returns: admin_consent=True&tenant={tid}&state={org_id}
  // Or on error: error={code}&error_description={msg}&state={org_id}
  const adminConsent = searchParams.get('admin_consent');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // org_id

  if (error) {
    console.error('Admin consent error:', error, searchParams.get('error_description'));
    // Still redirect to dashboard - consent is optional
    return NextResponse.redirect(`${origin}/dashboard?consent_error=${error}`);
  }

  if (adminConsent === 'True' && state) {
    const supabase = await createClient();

    // Update organization with consent status
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        graph_admin_consent_granted: true,
        graph_admin_consent_at: new Date().toISOString(),
      })
      .eq('id', state);

    if (updateError) {
      console.error('Failed to update consent status:', updateError);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

### Middleware Update

Check if `/setup/consent` needs to be added to the auth route list in `broker-portal/middleware.ts`. The consent page should be accessible to authenticated users. If the middleware already allows `/setup/*`, no change needed.

### Environment Variable

`NEXT_PUBLIC_DESKTOP_CLIENT_ID` -- This is the Azure app registration client ID for the desktop Electron app. It must be set in the broker portal's environment (Vercel, .env.local).

## Integration Notes

- **Depends on:** TASK-1928 (`graph_admin_consent_granted` column must exist)
- **Depends on:** TASK-1926 (login callback must be stable)
- **Used by:** TASK-1930 (setup callback redirect will point to this page)
- **File conflicts:** None (all new files)

## Do / Don't

### Do:
- Use `Suspense` for `useSearchParams` (Next.js requirement)
- Handle missing `NEXT_PUBLIC_DESKTOP_CLIENT_ID` gracefully (show error, do not crash)
- Allow users to skip consent (it is optional, can be done later)
- Always redirect to dashboard after callback (even on error)

### Don't:
- Do NOT block the user if consent fails (it is a nice-to-have, not a gate)
- Do NOT store any secrets client-side
- Do NOT request scopes in the consent URL (admin consent URL grants app-level permissions)
- Do NOT modify the login page or main setup page

## When to Stop and Ask

- If `NEXT_PUBLIC_DESKTOP_CLIENT_ID` value is not clear (ask PM for the value)
- If middleware structure has changed from what is expected
- If `graph_admin_consent_granted` column does not exist (TASK-1928 must be done first)

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (page rendering and callback are hard to unit test without mocking Microsoft)
- Future: E2E tests with mock consent flow

### Coverage
- Coverage impact: Minimal (new pages, not currently in test suite)

### Integration / Feature Tests
- Required scenarios (manual):
  1. Visit `/setup/consent?tenant=xxx&org=yyy` -> see grant button
  2. Click "Grant Permissions" -> redirected to Microsoft
  3. After consent -> callback updates DB, redirected to dashboard
  4. Click "Skip for now" -> goes to dashboard, no DB update
  5. Missing DESKTOP_CLIENT_ID -> shows configuration error message

### CI Requirements
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Build passes

## PR Preparation

- **Title**: `feat(broker-portal): add admin consent page for Graph API permissions`
- **Labels**: `feature`, `auth`
- **Depends on**: TASK-1928, TASK-1926

---

## PM Estimate (PM-Owned)

**Category:** `ui + service`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (page + callback route) | +15K |
| Files to modify | 1 (middleware, possibly) | +5K |
| Code volume | ~150 lines | +10K |
| Complexity | Medium (Microsoft consent URL format) | +5K |

**Confidence:** Medium

**Risk factors:**
- Microsoft admin consent URL format (verify docs)
- Middleware interaction with `/setup/consent` path

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist
```
Files created:
- [ ] broker-portal/app/setup/consent/page.tsx
- [ ] broker-portal/app/setup/consent/callback/route.ts

Files modified:
- [ ] broker-portal/middleware.ts (if needed)

Features implemented:
- [ ] Consent page with Grant/Skip buttons
- [ ] Microsoft admin consent URL construction
- [ ] Consent callback with DB update
- [ ] Graceful error handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information
**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified
