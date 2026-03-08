# TASK-2138: Show Read-Only Users/Settings During Impersonation

**Backlog ID:** BACKLOG-898
**Sprint:** SPRINT-118
**Phase:** Phase 3 - TTL + UI + Stretch (Parallel with TASK-2135, no shared files)
**Depends On:** TASK-2134 (core security work must be done before UI changes)
**Branch:** `fix/task-2138-readonly-users-settings`
**Branch From:** `int/sprint-118-security-hardening`
**Branch Into:** `int/sprint-118-security-hardening`
**Estimated Tokens:** ~10K (ui category x 1.0)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-2131 for full workflow reference.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Show the Users and Settings tabs during impersonation (currently hidden entirely) but render them in read-only mode. The support user should see these pages to match the target user's experience, but all write actions (invite, remove, change role, save settings) must be disabled with a "Read-only during support session" message.

## Non-Goals

- Do NOT remove or weaken existing server-side write guards in `impersonation-guards.ts`
- Do NOT make any other pages read-only
- Do NOT change the impersonation banner or session handling
- Do NOT modify the admin portal

## Deliverables

1. Update: `broker-portal/app/dashboard/layout.tsx` -- show Users/Settings nav during impersonation
2. Update: `broker-portal/app/dashboard/users/page.tsx` -- remove redirect, add read-only rendering
3. Update: `broker-portal/app/dashboard/settings/page.tsx` -- remove redirect, add read-only rendering
4. Update: `broker-portal/app/dashboard/settings/scim/page.tsx` -- remove redirect, add read-only rendering

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/app/dashboard/layout.tsx` -- nav guard only
- `broker-portal/app/dashboard/users/page.tsx`
- `broker-portal/app/dashboard/settings/page.tsx`
- `broker-portal/app/dashboard/settings/scim/page.tsx`

### Files this task must NOT modify:

- `broker-portal/lib/impersonation.ts` -- owned by TASK-2133
- `broker-portal/lib/impersonation-guards.ts` -- owned by TASK-2134
- `broker-portal/middleware.ts` -- owned by TASK-2133
- `broker-portal/app/auth/impersonate/route.ts` -- owned by TASK-2131
- `supabase/migrations/` -- no DB changes needed

### If you need to modify a restricted file:

**STOP** and notify PM.

## Acceptance Criteria

- [ ] Users and Settings nav links visible during impersonation (same as target user would see)
- [ ] Users page renders user list during impersonation
- [ ] Users page: "Invite User", "Remove", "Change Role" buttons disabled or hidden during impersonation
- [ ] Settings page renders current settings during impersonation
- [ ] Settings page: all form fields disabled, save buttons hidden during impersonation
- [ ] SCIM page renders in read-only mode during impersonation
- [ ] Attempting any write action shows "Read-only during support session" message or toast
- [ ] Direct URL access to `/dashboard/users` and `/dashboard/settings` works during impersonation (no redirect)
- [ ] Write guards in `impersonation-guards.ts` remain as server-side defense-in-depth
- [ ] Non-impersonation behavior unchanged
- [ ] All CI checks pass

## Implementation Notes

### Layout.tsx Nav Guard

In `layout.tsx`, around line 90, there is a `!isImpersonating` guard that hides nav links:

```tsx
// CURRENT (hide during impersonation):
{!isImpersonating && (
  <NavLink href="/dashboard/users">Users</NavLink>
)}

// NEW (always show):
<NavLink href="/dashboard/users">Users</NavLink>
```

### Users Page Read-Only Mode

```tsx
// broker-portal/app/dashboard/users/page.tsx

export default async function UsersPage() {
  const impersonation = await getImpersonationSession();
  const isReadOnly = !!impersonation;

  // Remove the impersonation redirect
  // CURRENT: if (impersonation) redirect('/dashboard');
  // NEW: remove that block

  // ... existing data fetching ...

  return (
    <div>
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm text-amber-800">
          Read-only during support session
        </div>
      )}

      {/* User list renders normally */}
      <UserList users={users} />

      {/* Write actions disabled */}
      {!isReadOnly && (
        <Button onClick={inviteUser}>Invite User</Button>
      )}

      {/* Or disable buttons instead of hiding: */}
      <Button disabled={isReadOnly} title={isReadOnly ? 'Read-only during support session' : undefined}>
        Change Role
      </Button>
    </div>
  );
}
```

### Settings Page Read-Only Mode

```tsx
// broker-portal/app/dashboard/settings/page.tsx

export default async function SettingsPage() {
  const impersonation = await getImpersonationSession();
  const isReadOnly = !!impersonation;

  // Remove impersonation redirect

  return (
    <div>
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 text-sm text-amber-800">
          Read-only during support session
        </div>
      )}

      {/* Render settings form with disabled fields */}
      <SettingsForm disabled={isReadOnly} />

      {/* Hide save button during impersonation */}
      {!isReadOnly && <Button type="submit">Save Changes</Button>}
    </div>
  );
}
```

### Key Details

- Use `getImpersonationSession()` (async, from TASK-2133) to detect impersonation state
- Prefer disabling buttons over hiding them -- the user should see what is available but cannot use
- Use consistent read-only banner styling (amber/warning color palette)
- Server-side write guards in `impersonation-guards.ts` remain as defense-in-depth. This task adds UI-level read-only, not new server-side logic.

## Integration Notes

- Imports from: `lib/impersonation.ts` (getImpersonationSession)
- Exports to: None
- Used by: None (end-user facing)
- Depends on: TASK-2134 (core security hardening done first)

## Do / Don't

### Do:

- Use consistent amber/warning banner for read-only message
- Disable write controls (do not just hide -- the user should see them)
- Hide or disable BOTH client-side and server-action-based write triggers
- Test with both impersonation and normal access

### Don't:

- Do NOT remove server-side write guards (keep defense-in-depth)
- Do NOT add new pages or components -- modify existing pages inline
- Do NOT change the impersonation banner component
- Do NOT modify `impersonation-guards.ts`

## When to Stop and Ask

- If the Users or Settings pages have been significantly restructured since Sprint 116
- If there are more write actions than "Invite", "Remove", "Change Role" on Users and "Save" on Settings
- If the pages use client components that need different read-only handling

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI rendering -- visual verification)

### Integration / Feature Tests

- Required scenarios:
  - During impersonation: Users page accessible, write buttons disabled
  - During impersonation: Settings page accessible, form fields disabled
  - During impersonation: SCIM page accessible, read-only
  - Normal access: all write controls enabled

### CI Requirements

- [ ] Type checking
- [ ] Lint
- [ ] Build passes

## PR Preparation

- **Title**: `fix(ui): show read-only Users/Settings during impersonation`
- **Labels**: `ui`, `broker-portal`
- **Depends on**: TASK-2134

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 4 files (layout, users, settings, scim) | +6K |
| Code volume | ~50 lines per file modified | +3K |
| Test complexity | None (visual) | +0K |

**Confidence:** High

**Risk factors:**
- Page structure may have changed since Sprint 116
- Settings/SCIM pages may have many write controls to disable

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] broker-portal/app/dashboard/layout.tsx
- [ ] broker-portal/app/dashboard/users/page.tsx
- [ ] broker-portal/app/dashboard/settings/page.tsx
- [ ] broker-portal/app/dashboard/settings/scim/page.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~10K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** int/sprint-118-security-hardening

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified
- [ ] Task can now be marked complete
