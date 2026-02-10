# Task TASK-1930: Update Setup Callback to Redirect to Consent Page

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**
See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Update the setup callback (`broker-portal/app/auth/setup/callback/route.ts`) to redirect the IT admin to the `/setup/consent` page after successful org provisioning, instead of directly to `/dashboard`. This connects the setup flow to the admin consent flow.

## Non-Goals

- Do NOT modify the consent page itself (TASK-1929)
- Do NOT modify the login callback (TASK-1926)
- Do NOT add new Supabase migrations
- Do NOT modify the setup page (`/setup`)

## Deliverables

1. Update: `broker-portal/app/auth/setup/callback/route.ts` -- change redirect after successful provisioning

## Acceptance Criteria

- [ ] After successful org provisioning, IT admin is redirected to `/setup/consent?tenant={tid}&org={org_id}` instead of `/dashboard`
- [ ] Tenant ID (`tid`) is extracted from user metadata (same as current extraction logic)
- [ ] Org ID is from the RPC response (`data.organization_id`)
- [ ] Error paths still redirect to `/setup?error=...` (unchanged)
- [ ] TypeScript compiles clean
- [ ] All CI checks pass

## Implementation Notes

### Current Code (line ~111)

```typescript
return NextResponse.redirect(`${origin}/dashboard`);
```

### Replacement

```typescript
// After successful provisioning, redirect to admin consent page
// so IT admin can pre-approve Graph API permissions for all tenant users
const customClaims = user.user_metadata?.custom_claims as { tid?: string } | undefined;
const tenantId = customClaims?.tid || '';

return NextResponse.redirect(
  `${origin}/setup/consent?tenant=${encodeURIComponent(tenantId)}&org=${encodeURIComponent(data.organization_id)}`
);
```

### Key Details

- The `user` variable and `data` variable are already available at line 111 in the current code
- `user` comes from `supabase.auth.getUser()` (called earlier in the route)
- `data` comes from the `auto_provision_it_admin` RPC response
- The tenant ID extraction follows the same pattern used elsewhere in the codebase

## Integration Notes

- **Depends on:** TASK-1929 (`/setup/consent` page must exist -- ALREADY COMPLETED)
- **File:** `broker-portal/app/auth/setup/callback/route.ts` (only file modified)
- **No conflicts** with other tasks (this is the only task touching this file in this sprint)

### SR Review Note: Consent Callback Org Ownership Verification

The consent callback (`/setup/consent/callback/route.ts`, already deployed in TASK-1929) updates `organizations.graph_admin_consent_granted` using the `state` parameter (org_id) from the URL. Currently it trusts the `state` value without verifying that the authenticated user actually owns/admins that org.

**Security recommendation (add as a TODO/follow-up):** The consent callback should verify that the authenticated user is an `it_admin` member of the organization specified in the `state` parameter before updating consent. This prevents a user from granting consent on behalf of an org they do not belong to.

This is a defense-in-depth measure -- the consent URL is only shown to IT admins who just completed setup, so exploitation risk is low. But it should be addressed as a hardening follow-up.

## Do / Don't

### Do:
- Use `encodeURIComponent` for URL parameters
- Preserve all error handling paths exactly as-is
- Test that the user variable is accessible at the point of redirect

### Don't:
- Do NOT change any error handling logic
- Do NOT modify the RPC call or its parameters
- Do NOT change the middleware

## When to Stop and Ask

- If the setup callback structure has changed from what is described
- If `user` or `data` variables are not accessible at the redirect point
- If `/setup/consent` page does not exist (it should already be deployed from TASK-1929)

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No

### Integration / Feature Tests
- Required scenarios (manual):
  1. IT admin completes setup -> redirected to `/setup/consent` (not dashboard)
  2. Setup failure -> still shows setup error page (unchanged)

### CI Requirements
- [ ] Type checking passes
- [ ] Build passes

## PR Preparation

- **Title**: `feat(auth): redirect to admin consent page after org setup`
- **Labels**: `auth`
- **Depends on**: TASK-1929 (COMPLETED -- consent page already deployed)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~5K-10K

**Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file, ~5 lines changed | +5K |
| Complexity | Very low (URL redirect) | +3K |

**Confidence:** High

**Similar past tasks:** Simple redirect changes, ~3-5K

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
- [ ] broker-portal/app/auth/setup/callback/route.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run build passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information
**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified
