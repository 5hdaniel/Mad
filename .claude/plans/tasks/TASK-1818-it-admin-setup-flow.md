# TASK-1818: IT Admin Setup Flow + OAuth Scopes Fix

**Backlog ID:** N/A (ad-hoc feature request)
**Sprint:** Standalone task (not part of SPRINT-071)
**Phase:** Implementation complete, pending commit/PR
**Branch:** `feature/it-admin-setup-flow`
**Estimated Turns:** 3-5 (commit, push, PR)
**Estimated Tokens:** ~5K (implementation already done; remaining work is commit/push/PR only)

---

## Objective

Build a dedicated `/setup` page for IT admin onboarding and fix the missing OAuth scopes that caused external-tenant Azure users (e.g., Bret) to fail auto-provisioning due to null email.

---

## Context

The broker portal login page did not request `email profile openid` scopes for Azure OAuth (the desktop app does). For external tenants, Microsoft silently omits the email claim, causing `auth.users.email` to be NULL and auto-provisioning to fail.

**Root cause (two-part):**
1. Missing OAuth scopes on the login page's `signInWithOAuth` call
2. The `auto_provision_it_admin` RPC reads `auth.users.email` directly, which is NULL for external tenants

**Approved plan:** `/Users/daniel/.claude/plans/nifty-swimming-minsky.md`
**SR Engineer review:** `/Users/daniel/.claude/plans/nifty-swimming-minsky-agent-a273bd2.md` (APPROVED WITH CHANGES -- all changes incorporated)

---

## Requirements

### Must Do:
1. **Shared auth helpers** (`lib/auth/helpers.ts`): `extractEmail()` with validated fallback chain (email -> user_metadata.email -> mail -> preferred_username with `@` + `#EXT#` check -> custom_claims.upn with same checks) and `orgNameFromEmail()` extracted from callback route
2. **Login scopes fix** (`app/login/page.tsx`): Add `scopes: 'email profile openid'` for Azure provider
3. **Callback refactor** (`app/auth/callback/route.ts`): Use shared `extractEmail()` and `orgNameFromEmail()` instead of inline implementations
4. **Setup page** (`app/setup/page.tsx`): Microsoft-only, `prompt: 'consent'`, scopes, IT-admin-tailored error messages, authenticated-user redirect
5. **Setup callback** (`app/auth/setup/callback/route.ts`): Azure-only validation, consumer tenant blocking (`9188040d-...`), email extraction with fail-fast, membership check, RPC call
6. **Middleware update** (`middleware.ts`): Add `/setup` to `isAuthRoute` check
7. **Supabase RPC migration**: `auto_provision_it_admin` updated with COALESCE email fallback, TOCTOU fix via `ON CONFLICT`, slug collision handling

### Must NOT Do:
- Do NOT include `components/users/BulkEditRoleModal.tsx`, `UserTableRow.tsx`, or `lib/actions/bulkUpdateRole.ts` in the commit (previous sprint work, not related)
- Do NOT include `.claude/plans/backlog/items/BACKLOG-61*.md` or `BACKLOG-620.md` (unrelated backlog items)
- Do NOT include `scripts/cleanup-macos.sh` (unrelated)
- Do NOT include `TASK-1806-*.md` or `TASK-1808-*.md` task files (unrelated)
- Do NOT commit `tsconfig.tsbuildinfo` (build artifact)

---

## Acceptance Criteria

- [x] `extractEmail()` handles all fallback chain positions with `@` and `#EXT#` validation
- [x] `orgNameFromEmail()` extracted to shared module and used by both callbacks
- [x] Login page sends `email profile openid` scopes for Azure OAuth
- [x] `/setup` page renders Microsoft-only button with `prompt: 'consent'`
- [x] `/setup` page shows IT-admin-tailored error messages
- [x] `/auth/setup/callback` validates Azure-only, blocks consumer tenants, extracts email, provisions org
- [x] Middleware redirects authenticated users from `/setup` to `/dashboard`
- [x] Supabase RPC updated with COALESCE fallback, TOCTOU fix, slug collision handling
- [ ] TypeScript compiles clean (`npm run type-check` in broker-portal)
- [ ] Code committed and pushed to `feature/it-admin-setup-flow`
- [ ] PR created targeting `develop`
- [ ] SR Engineer review and merge

---

## Files Changed

### New Files:
- `broker-portal/lib/auth/helpers.ts` -- shared `extractEmail()` and `orgNameFromEmail()`
- `broker-portal/app/setup/page.tsx` -- IT admin setup page
- `broker-portal/app/auth/setup/callback/route.ts` -- setup callback route

### Modified Files:
- `broker-portal/app/login/page.tsx` -- added Azure scopes (+1 line)
- `broker-portal/app/auth/callback/route.ts` -- refactored to use shared helpers (-24/+8 lines)
- `broker-portal/middleware.ts` -- added `/setup` to `isAuthRoute` (+1 line change)

### Supabase Migration (already applied):
- `fix_auto_provision_email_fallback` -- RPC updated with COALESCE, TOCTOU fix, slug collision handling

---

## Files to Read (for context)

- `/Users/daniel/.claude/plans/nifty-swimming-minsky.md` -- approved plan
- `/Users/daniel/.claude/plans/nifty-swimming-minsky-agent-a273bd2.md` -- SR review with all issues addressed

---

## Testing Expectations

### Unit Tests
- **Required:** No (deferred per SR review S2 -- will be added in follow-up)
- **Future:** Unit tests for `extractEmail()` with various Microsoft user_metadata shapes

### CI Requirements
- [ ] TypeScript compilation passes
- [ ] Build succeeds
- [ ] Lint passes

---

## PR Preparation

- **Title:** `feat(broker-portal): add IT admin setup flow and fix OAuth scopes`
- **Branch:** `feature/it-admin-setup-flow`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [ ] Noted start time: ___
- [x] Read task file completely

Implementation:
- [x] Code complete
- [ ] Tests pass locally (npm run type-check in broker-portal)
- [ ] Lint passes (npm run lint in broker-portal)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: External-tenant Azure users (e.g., Bret) fail auto-provisioning due to null email; no dedicated setup flow for IT admins
- **After**: Dedicated /setup page with proper OAuth scopes, email fallback chain, consumer tenant blocking, and RPC-level email fallback
- **Actual Turns**: TBD
- **Actual Tokens**: ~TBD
- **Actual Time**: TBD
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
Implementation was done outside the formal handoff workflow (no agent metrics tracked during coding). The Engineer agent is being invoked now to handle commit, push, and PR creation.

**Issues encountered:**
None during implementation. Code compiles clean.

---

## Guardrails

**STOP and ask PM if:**
- The commit includes files not listed in the "Files Changed" section above
- TypeScript compilation fails
- You encounter merge conflicts with develop
- You encounter blockers not covered in the task file

---

## SR Engineer Review Items (All Addressed)

| ID | Priority | Issue | Status |
|----|----------|-------|--------|
| C1 | Critical | RPC reads auth.users.email directly | Fixed: COALESCE fallback in migration |
| C2 | Critical | Azure app needs email + xms_edov optional claims | Documented in plan Step 7 (manual config) |
| I1 | Important | extractEmail needs @ validation and #EXT# filtering | Fixed: isValidEmail() helper |
| I2 | Important | Slug collision handling in RPC | Fixed: in migration |
| I3 | Important | TOCTOU race on concurrent provisioning | Fixed: ON CONFLICT in migration |
| I4 | Important | Block consumer tenant IDs | Fixed: CONSUMER_TENANT_ID check |
| S1 | Suggestion | Add /setup to middleware auth redirect | Fixed: isAuthRoute updated |
| S3 | Suggestion | IT admin-tailored error messages | Fixed: ERROR_MESSAGES map |
| S5 | Suggestion | Add user_metadata.mail to fallback chain | Fixed: in extractEmail() |
