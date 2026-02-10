# Task TASK-1926: Replace Auto-Provision with JIT Join in Login Callback

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Replace the `autoProvisionITAdmin()` call in the login callback (`broker-portal/app/auth/callback/route.ts`, lines 161-174) with JIT join logic. Azure users from a KNOWN tenant should auto-join the existing org; users from an UNKNOWN tenant should see an "org not set up" error instead of having a new duplicate org created.

## Non-Goals

- Do NOT modify the `/setup` flow or `auto_provision_it_admin` RPC (that stays for IT admin setup)
- Do NOT implement admin consent (Phase 2)
- Do NOT touch the pending invite flow (lines 102-158, must remain unchanged)
- Do NOT modify Google OAuth behavior
- Do NOT add SCIM functionality

## Deliverables

1. Update: `broker-portal/app/auth/callback/route.ts` -- replace auto-provision block with JIT join
2. Update: `broker-portal/app/login/page.tsx` -- add `org_not_setup` error message
3. No new files required (JIT RPC created in TASK-1925)

## Acceptance Criteria

- [ ] Azure user from UNKNOWN tenant -> signed out, redirected to `/login?error=org_not_setup`
- [ ] Azure user from KNOWN tenant (org exists with matching `microsoft_tenant_id`) -> JIT-joined with `default_member_role`
- [ ] **JIT-joined users with `agent` role -> redirected to `/download` (not dashboard)** -- this is expected behavior because `ALLOWED_ROLES` in middleware does not include `agent`. This is NOT a bug. (SR Review Clarification)
- [ ] Azure user with existing membership -> goes straight to dashboard (existing behavior preserved)
- [ ] Azure user with pending invite -> invite claimed (existing behavior preserved)
- [ ] Google user without membership -> sees `not_authorized` error (existing behavior preserved)
- [ ] `org_not_setup` error message displayed on login page: "Your organization hasn't been set up yet. Ask your IT administrator to visit the setup page first."
- [ ] `autoProvisionITAdmin` function can be removed from callback route (or kept but not called from the no-membership path)
- [ ] All CI checks pass
- [ ] TypeScript compiles clean

## Implementation Notes

### Current Code to Replace (lines 161-174)

```typescript
// CURRENT (remove this):
// No membership and no pending invite - check if this is a Microsoft user for auto-provisioning
const provider = user.app_metadata?.provider;

if (provider === 'azure') {
  // Auto-provision as IT admin
  const result = await autoProvisionITAdmin(supabase, user);

  if (result.success) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Successfully provisioned IT admin');
    }
    return NextResponse.redirect(`${origin}${next}`);
  }
}
```

### Replacement Logic

```typescript
// NEW (replace with):
// No membership and no pending invite - check if Azure user can JIT-join an existing org
const provider = user.app_metadata?.provider;

if (provider === 'azure') {
  const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
  const tenantId = customClaims?.tid;

  if (tenantId) {
    // Try JIT join to existing org for this tenant
    const { data: jitResult, error: jitError } = await supabase.rpc('jit_join_organization', {
      p_tenant_id: tenantId,
    });

    if (jitResult?.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`JIT joined org ${jitResult.organization_id} with role ${jitResult.role}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (jitError) {
      console.error('JIT join RPC failed:', jitError);
    }

    // Org not found for this tenant - tell user to contact admin
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=org_not_setup`);
  }
}
```

### Login Page Error Message Addition

Add to the `ERROR_MESSAGES` object in `broker-portal/app/login/page.tsx`:

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Authentication failed. Please try again.',
  not_authorized:
    'Your account is not authorized to access the broker portal. Contact your administrator.',
  org_not_setup:
    "Your organization hasn't been set up yet. Ask your IT administrator to visit the setup page first.",
};
```

### Cleanup

After replacing the auto-provision block, the `autoProvisionITAdmin` function at the top of the file (lines 23-65) is no longer called from the callback. You have two options:

1. **Remove it entirely** (preferred) -- it is only used in this file and the setup callback has its own provisioning via `auto_provision_it_admin` RPC directly
2. **Keep it but add a comment** that it is unused in this route

Check: Is `autoProvisionITAdmin` imported or used anywhere else?
- `broker-portal/app/auth/setup/callback/route.ts` calls `auto_provision_it_admin` RPC directly (does NOT use this function)
- So it is safe to remove from the callback route

## Integration Notes

- **Depends on:** TASK-1925 (`jit_join_organization` RPC must exist before this code can work)
- **Imports from:** `@/lib/auth/helpers` (extractEmail, orgNameFromEmail -- already imported)
- **Used by:** TASK-1930 (builds on stable callback behavior). TASK-1929 is already completed.
- **Shared file concern:** `broker-portal/app/auth/callback/route.ts` is also modified by TASK-1930 indirectly (via setup callback, different file)

### SR Review Note: Agent Role Redirect Behavior

JIT-joined users will typically receive the `agent` role (the `default_member_role` after the prerequisite migration). The broker portal middleware's `ALLOWED_ROLES` does NOT include `agent`, so these users will be redirected to `/download` instead of `/dashboard`. This is **expected and correct behavior** -- agent-role users use the desktop app, not the broker portal dashboard. The broker portal dashboard is for `broker`, `admin`, and `it_admin` roles.

Do NOT attempt to "fix" this redirect. It is working as designed.

## Do / Don't

### Do:
- Preserve the pending invite flow exactly as-is (lines 102-158)
- Preserve the existing membership check (lines 88-100)
- Use the `jit_join_organization` RPC (not inline SQL)
- Sign out the user before redirecting to error page
- Add development-only console.log for debugging

### Don't:
- Do NOT call `autoProvisionITAdmin` for any login path
- Do NOT modify the setup callback (`/auth/setup/callback/route.ts`)
- Do NOT add new dependencies/imports beyond what already exists
- Do NOT change the behavior for Google users
- Do NOT modify the middleware

## When to Stop and Ask

- If `jit_join_organization` RPC does not exist yet (TASK-1925 must be merged first)
- If the callback route structure has changed significantly from what is described here
- If you discover other callers of `autoProvisionITAdmin` function
- If TypeScript compilation fails on the RPC call typing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (route handler testing is complex with Supabase mocking; manual verification)
- Future: Consider adding integration tests for callback routes

### Coverage

- Coverage impact: No change (route handlers not currently tested)

### Integration / Feature Tests

- Required scenarios (manual verification):
  1. Azure user, unknown tenant -> `/login?error=org_not_setup` with message displayed
  2. Azure user, known tenant -> auto-joined, redirected to dashboard
  3. Azure user, existing member -> dashboard directly
  4. Azure user, pending invite -> invite claimed, dashboard
  5. Google user, no membership -> `/login?error=not_authorized`
  6. Any user, valid membership -> dashboard

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

## PR Preparation

- **Title**: `fix(auth): replace auto-provision with JIT join for Azure users`
- **Labels**: `auth`, `bug-fix`
- **Depends on**: TASK-1925 (JIT Join RPC must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 (callback route, login page) | +10K |
| Code volume | ~30 lines changed | +5K |
| Complexity | Low (replacing existing pattern) | +5K |
| Test complexity | Low (manual verification) | +5K |

**Confidence:** High

**Risk factors:**
- TypeScript typing for RPC response (minor)
- Ensuring no regression in invite claim flow

**Similar past tasks:** TASK-1818 (IT admin setup flow, actual ~5K for similar changes)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] broker-portal/app/auth/callback/route.ts
- [ ] broker-portal/app/login/page.tsx

Features implemented:
- [ ] JIT join call for Azure users from known tenants
- [ ] org_not_setup error for Azure users from unknown tenants
- [ ] Removed autoProvisionITAdmin function from callback
- [ ] Added org_not_setup error message to login page

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm run build passes (broker-portal)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK

### Notes

**Issues/Blockers:** None / <describe>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A

### Merge Information

**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified: `gh pr view <PR> --json state` shows `MERGED`
