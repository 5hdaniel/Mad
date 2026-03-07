# TASK-2123: Admin Portal "View as User" Button

**Backlog ID:** BACKLOG-838, BACKLOG-866
**Sprint:** SPRINT-116
**Phase:** Phase 2 - Portal Integration (Parallel with TASK-2124)
**Depends On:** TASK-2122 (schema + RPCs must be merged first)
**Branch:** `feature/task-2123-admin-view-as-user`
**Branch From:** `int/sprint-116-impersonation`
**Branch Into:** `int/sprint-116-impersonation`
**Estimated Tokens:** ~20K (service category x 0.5 = ~10K adjusted)

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

Add a "View as User" button to the admin portal's user detail page that initiates an impersonation session and opens the broker portal in a new tab with the impersonation token.

## Non-Goals

- Do NOT modify the broker portal -- that is TASK-2124
- Do NOT modify the database schema -- that is TASK-2122
- Do NOT build an impersonation management page (active sessions list, etc.) -- future work
- Do NOT add impersonation state to the admin portal itself -- the admin portal just launches the broker portal
- Do NOT modify the admin portal middleware or RBAC system

## Deliverables

1. Update: `admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx` -- add "View as User" button
2. New file: `admin-portal/app/dashboard/users/[id]/components/ImpersonateButton.tsx` -- client component for impersonation
3. Update: `admin-portal/lib/admin-queries.ts` -- add `startImpersonation()` helper

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx`
- `admin-portal/app/dashboard/users/[id]/components/ImpersonateButton.tsx` (new)
- `admin-portal/lib/admin-queries.ts`

### Files this task must NOT modify:

- `admin-portal/middleware.ts` -- No middleware changes needed
- `admin-portal/lib/permissions.ts` -- `USERS_IMPERSONATE` already exists
- `admin-portal/app/dashboard/users/[id]/page.tsx` -- Server component; only pass permission prop if needed
- Any `broker-portal/` files -- Owned by TASK-2124
- Any `supabase/` files -- Owned by TASK-2122

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] "View as User" button appears on user detail page next to the Suspend button
- [ ] Button is only visible when admin has `users.impersonate` permission
- [ ] Clicking the button shows a confirmation dialog (not browser `confirm()`)
- [ ] Confirmation dialog explains what impersonation means (read-only, 30 min, audit-logged)
- [ ] On confirm: calls `admin_start_impersonation` RPC via the helper
- [ ] On success: opens broker portal in new tab with token as URL parameter
- [ ] On error: shows error toast with descriptive message
- [ ] Button shows loading state while RPC is in-flight
- [ ] Button is disabled for the admin's own user profile (cannot impersonate self)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### ImpersonateButton Component

Create a new client component `ImpersonateButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { startImpersonation } from '@/lib/admin-queries';

interface ImpersonateButtonProps {
  userId: string;
  userName: string;
  isOwnProfile: boolean;
}

export function ImpersonateButton({ userId, userName, isOwnProfile }: ImpersonateButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImpersonate = async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await startImpersonation(userId);

    if (rpcError || !data?.success) {
      setError(rpcError?.message || data?.error || 'Failed to start impersonation');
      setLoading(false);
      return;
    }

    // Open broker portal in new tab with token
    const brokerUrl = process.env.NEXT_PUBLIC_BROKER_PORTAL_URL || 'https://app.keeprcompliance.com';
    window.open(`${brokerUrl}/auth/impersonate?token=${data.token}`, '_blank');

    setShowDialog(false);
    setLoading(false);
  };

  if (isOwnProfile) return null;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
      >
        <Eye className="h-4 w-4" />
        View as User
      </button>

      {/* Confirmation dialog - use same pattern as SuspendDialog */}
      {showDialog && (
        // ... modal overlay with confirmation
      )}
    </>
  );
}
```

### Confirmation Dialog Content

The dialog should include:
- Title: "View as {userName}?"
- Description explaining:
  - "You will see the broker portal exactly as this user sees it."
  - "Session is read-only and lasts 30 minutes."
  - "All activity is logged to the audit trail."
- Confirm button: "Open Broker Portal" (purple theme)
- Cancel button: "Cancel"

### Pattern Reference: SuspendDialog

Look at `admin-portal/app/dashboard/users/[id]/components/SuspendDialog.tsx` for the existing dialog pattern in this codebase. Use the same dialog/modal approach (likely a `<dialog>` element or a portal-based modal).

### admin-queries.ts Addition

```typescript
/**
 * Start an impersonation session via admin_start_impersonation RPC.
 */
export async function startImpersonation(
  targetUserId: string
): Promise<RpcResult<{ success: boolean; token: string; session_id: string; expires_at: string; error?: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_start_impersonation', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as { success: boolean; token: string; session_id: string; expires_at: string; error?: string }, error: null };
}
```

### UserProfileCard Update

Add the ImpersonateButton to the action buttons area (next to SuspendDialog):

```tsx
// In UserProfileCard.tsx, add to the flex container with SuspendDialog:
<div className="flex items-center gap-2">
  {canImpersonate && (
    <ImpersonateButton
      userId={user.id}
      userName={displayName}
      isOwnProfile={isOwnProfile}
    />
  )}
  <SuspendDialog ... />
</div>
```

### Permission Check

The `canImpersonate` prop should be passed from the server component (page.tsx). Check the `users.impersonate` permission there:

```typescript
// In page.tsx, add to the parallel queries:
const hasImpersonatePerm = await supabase.rpc('has_permission', {
  check_user_id: adminUser.id,
  required_permission: 'users.impersonate',
});
```

Then pass `canImpersonate={hasImpersonatePerm.data === true}` and `isOwnProfile={adminUser.id === id}` to UserProfileCard, which passes them to ImpersonateButton.

**NOTE:** This means page.tsx will need a small update to pass these new props. This is acceptable since no other parallel task touches page.tsx.

### Environment Variable

Add `NEXT_PUBLIC_BROKER_PORTAL_URL` to the admin portal env. The value should be:
- Production: `https://app.keeprcompliance.com`
- Development: `http://localhost:3001` (or whatever port broker portal runs on)

Update `admin-portal/.env.local.example` with this variable.

## Integration Notes

- **Depends on:** TASK-2122 (schema -- `admin_start_impersonation` RPC must exist)
- **Exports to:** TASK-2124 (broker portal will handle the `/auth/impersonate?token=...` route)
- **Uses:** `admin-portal/lib/admin-queries.ts` (existing pattern for RPC calls)
- **Uses:** `admin-portal/lib/permissions.ts` PERMISSIONS.USERS_IMPERSONATE (existing)

## Do / Don't

### Do:
- Follow the existing SuspendDialog pattern for the confirmation modal
- Use purple color theme for impersonation UI (distinct from red/destructive suspend)
- Include the Eye icon from lucide-react for visual consistency
- Add loading state to prevent double-clicks
- Use `window.open()` to open broker portal in a new tab

### Don't:
- Do NOT navigate the admin portal itself to the broker portal
- Do NOT store impersonation state in the admin portal (it's stateless from admin's perspective)
- Do NOT show the button if the admin doesn't have the permission
- Do NOT use browser `confirm()` -- use a proper React dialog
- Do NOT hardcode the broker portal URL -- use an environment variable

## When to Stop and Ask

- If SuspendDialog uses a component library not obvious from the code (need to match pattern)
- If `page.tsx` structure has changed significantly from what's documented above
- If `admin_start_impersonation` RPC doesn't exist yet (TASK-2122 dependency not merged)
- If you can't determine the correct broker portal URL format

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI component -- visual testing preferred)
- The admin-portal project may not have a test setup. Check `admin-portal/package.json` for test scripts.

### Coverage

- Coverage impact: N/A for admin portal (no test infrastructure currently)

### Integration / Feature Tests

- Manual verification:
  - Button appears for users with `users.impersonate` permission
  - Button hidden for users without permission
  - Button hidden on own profile
  - Clicking opens confirmation dialog
  - Confirming calls RPC and opens new tab
  - Error handling shows error message

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check` in admin-portal)
- [ ] Lint checks (`npm run lint` in admin-portal)
- [ ] Build succeeds (`npm run build` in admin-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(admin): add View as User impersonation button`
- **Labels**: `admin-portal`, `sprint-116`
- **Depends on**: TASK-2122 (schema must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~10K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new component | +5K |
| Files to modify | 2 files (small changes each) | +5K |
| Code volume | ~150 lines new, ~20 lines modified | +5K |
| Test complexity | None (manual testing) | 0K |
| Service multiplier | x 0.5 | Applied |

**Confidence:** High

**Risk factors:**
- Dialog pattern in SuspendDialog might be complex to replicate
- Environment variable setup might need Vercel config

**Similar past tasks:** TASK-2116 (user detail actions, actual: ~12K tokens)

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
- [ ] admin-portal/app/dashboard/users/[id]/components/ImpersonateButton.tsx

Files modified:
- [ ] admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx
- [ ] admin-portal/app/dashboard/users/[id]/page.tsx
- [ ] admin-portal/lib/admin-queries.ts
- [ ] admin-portal/.env.local.example

Features implemented:
- [ ] View as User button with permission gate
- [ ] Confirmation dialog
- [ ] RPC call and error handling
- [ ] Opens broker portal in new tab with token

Verification:
- [ ] npm run type-check passes (in admin-portal/)
- [ ] npm run lint passes (in admin-portal/)
- [ ] npm run build passes (in admin-portal/)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
