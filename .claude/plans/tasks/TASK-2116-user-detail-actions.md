# TASK-2116: User Detail Page Action Buttons

**Backlog ID:** BACKLOG-837 (P1), BACKLOG-744
**Sprint:** SPRINT-112
**Phase:** Phase 2 - UI (Parallel)
**Depends On:** TASK-2115 (admin write RPCs)
**Branch:** `feature/task-2116-user-actions`
**Branch From:** `int/sprint-112-admin-account-mgmt`
**Branch Into:** `int/sprint-112-admin-account-mgmt`
**Estimated Tokens:** ~15K (service category x 0.5 = ~8K adjusted)

---

## Objective

Add action buttons to the existing user detail page (`/dashboard/users/[id]`) for suspend/unsuspend and edit license operations. Each action requires a confirmation dialog and shows success/error feedback. The page refreshes data after each action.

---

## Context

The user detail page (TASK-2113, SPRINT-111) currently shows read-only user information: profile card, org membership, license info, devices, audit log, and Sentry errors. This task adds interactive write capabilities using the RPCs from TASK-2115.

### Current Page Structure

```
/dashboard/users/[id]/
  page.tsx              -- Server component, fetches all data
  components/
    UserProfileCard.tsx -- Profile info (name, email, status, avatar)
    OrganizationCard.tsx
    LicenseCard.tsx     -- License type, status, expiry, tier
    DevicesTable.tsx
    AuditLogTable.tsx
    SentryErrorsCard.tsx
```

### RPCs Available (from TASK-2115)

- `admin_suspend_user(p_user_id)` -- Returns `{success: true, previous_status: string}`
- `admin_unsuspend_user(p_user_id)` -- Returns `{success: true, previous_status: string}`
- `admin_update_license(p_license_id, p_changes)` -- Returns `{success: true, old_values, new_values}`

---

## Requirements

### Must Do:

1. **Add action buttons to UserProfileCard:**
   - If user status is 'active': show "Suspend User" button (red/destructive style)
   - If user status is 'suspended': show "Unsuspend User" button (green/success style)
   - Button click opens a confirmation dialog (not browser `confirm()` -- use a proper modal/dialog component)
   - Confirmation dialog shows user name and action being taken
   - On confirm: call the RPC, show success toast, refresh page data
   - On error: show error toast with message from RPC
   - Disable button while RPC is in-flight (loading state)

2. **Add "Edit License" button to LicenseCard:**
   - Button opens a modal/dialog with form fields pre-filled with current values:
     - Status (dropdown: active, suspended, expired, cancelled)
     - Expires At (date picker or date input)
     - Subscription Tier (dropdown: free, pro, enterprise -- check actual values in schema)
     - Transaction Limit (number input)
   - Submit calls `admin_update_license` RPC with changed fields only
   - On success: close modal, show success toast, refresh page data
   - On error: show error in modal, keep it open

3. **Convert page to client-side data fetching pattern:**
   - The current page is a server component. Action buttons need client-side interactivity.
   - Options (engineer decides best approach):
     a. Keep server component for initial load, add client component wrappers for action buttons
     b. Add a `useRouter().refresh()` call after mutations to trigger server re-render
   - Recommendation: Use approach (a) -- wrap action buttons in client components, use `useRouter().refresh()` after successful mutations

4. **Add admin-queries helpers:**
   - Add to `admin-portal/lib/admin-queries.ts`:
     ```typescript
     export async function suspendUser(userId: string) { ... }
     export async function unsuspendUser(userId: string) { ... }
     export async function updateLicense(licenseId: string, changes: Record<string, unknown>) { ... }
     ```

### Must NOT Do:
- Do NOT modify the user search page or user search functionality
- Do NOT add impersonation UI (BACKLOG-838)
- Do NOT add role-based permission checks beyond `has_internal_role()` (SPRINT-113 scope)
- Do NOT modify the existing server-side data fetching logic
- Do NOT add new pages or routes -- only modify existing user detail page

---

## Acceptance Criteria

- [ ] Suspend button visible on user detail page for active users
- [ ] Unsuspend button visible for suspended users
- [ ] Confirmation dialog appears before suspend/unsuspend
- [ ] Suspend -> user status changes to 'suspended', page refreshes to show updated status
- [ ] Unsuspend -> user status changes to 'active', page refreshes to show updated status
- [ ] Edit License button opens modal with current values pre-filled
- [ ] License edit saves changes and page refreshes
- [ ] Error messages shown on RPC failure
- [ ] Buttons show loading state during RPC calls
- [ ] `npm run build` passes with no TypeScript errors

---

## Files to Modify

- `admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx` -- Add suspend/unsuspend buttons
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx` -- Add edit license button + modal
- `admin-portal/lib/admin-queries.ts` -- Add write operation helpers

### Files to Create (new components)

- `admin-portal/app/dashboard/users/[id]/components/SuspendDialog.tsx` -- Confirmation dialog for suspend/unsuspend
- `admin-portal/app/dashboard/users/[id]/components/EditLicenseDialog.tsx` -- License edit modal

### Files to Read (for context)

- `admin-portal/app/dashboard/users/[id]/page.tsx` -- Current page structure
- `admin-portal/lib/admin-queries.ts` -- Existing RPC call patterns
- `admin-portal/lib/supabase/client.ts` -- Browser client for RPC calls

---

## Testing Expectations

### Manual Testing
- [ ] Navigate to user detail -> verify action buttons render correctly based on status
- [ ] Suspend a user -> verify confirmation dialog, status change, page refresh
- [ ] Unsuspend -> verify the reverse flow
- [ ] Edit license -> verify modal opens with current values, saves changes
- [ ] Test error case (e.g., network error) -> verify error message shown
- [ ] `npm run build` passes

### CI Requirements
- [ ] `npm run build` passes (build check for admin-portal)
- [ ] No TypeScript errors

---

## PR Preparation

- **Title:** `feat(admin): add suspend/unsuspend and license edit to user detail page`
- **Branch:** `feature/task-2116-user-actions`
- **Target:** `int/sprint-112-admin-account-mgmt`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-05*

### What Was Done

1. Added `suspendUser()`, `unsuspendUser()`, and `updateLicense()` helper functions to `admin-portal/lib/admin-queries.ts`, following the existing RPC call pattern with typed error handling.
2. Created `SuspendDialog.tsx` -- client component using HTML `<dialog>` element with confirmation flow, optional reason textarea for suspend, loading spinner, and inline error display.
3. Created `EditLicenseDialog.tsx` -- client component with form for status (dropdown), license_type (dropdown), expires_at (date input), and transaction_limit (number input). Only sends changed fields to the RPC.
4. Updated `UserProfileCard.tsx` to import and render `SuspendDialog` next to the user name, showing "Suspend User" (red) for active users or "Unsuspend User" (green) for suspended users.
5. Updated `LicenseCard.tsx` to import and render `EditLicenseDialog` next to each license's status badge.
6. All dialogs use `useRouter().refresh()` after successful mutations to re-fetch server data.

**Approach:** Used option (a) from task -- client component wrappers for action buttons within the existing server-component page. No new UI libraries installed; all dialogs use plain HTML `<dialog>` with Tailwind.

**Deviations:** Used `license_type` field (not `subscription_tier`) per schema correction in task assignment context.

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from int/sprint-112-admin-account-mgmt
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] npm run build passes
- [x] No TypeScript errors

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

**Issues/Blockers:** None

### Results

- **Before**: User detail page is read-only
- **After**: Action buttons for suspend/unsuspend and license editing with confirmation dialogs
- **Actual Tokens**: ~15K (Est: 15K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- The `admin_suspend_user` or `admin_update_license` RPCs are not yet deployed
- The user detail page structure has changed significantly from what is described above
- You need to install new UI dependencies (e.g., dialog/modal library) -- check if an existing pattern exists first
- You encounter blockers not covered in the task file
