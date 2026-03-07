# TASK-2117: Internal User Management Page

**Backlog ID:** BACKLOG-837 (P1), BACKLOG-744
**Sprint:** SPRINT-112
**Phase:** Phase 2 - UI (Parallel)
**Depends On:** TASK-2114 (admin_audit_logs for logging add/remove actions)
**Branch:** `feature/task-2117-internal-users`
**Branch From:** `int/sprint-112-admin-account-mgmt`
**Branch Into:** `int/sprint-112-admin-account-mgmt`
**Estimated Tokens:** ~18K (service category x 0.5 = ~9K adjusted)

---

## Objective

Create an internal user management page at `/dashboard/settings` where admins can view, add, and remove users from the `internal_roles` table. Enable the "Settings" sidebar link. This page is the admin-facing UI for controlling who has access to the admin portal itself.

---

## Context

### Current State

- The `internal_roles` table exists (from SPRINT-109) with columns: `id`, `user_id`, `role` (TEXT: support_agent, support_admin, super_admin), `created_at`, `updated_at`, `created_by`
- The Sidebar has a "Settings" nav item with `enabled: false` showing "Coming soon"
- There is no UI for managing internal roles -- currently done via direct SQL
- The `has_internal_role()` function is used for access control
- `log_admin_action()` from TASK-2114 is available for audit logging

### Target State

A settings page that shows:
1. List of all internal users (name, email, role, added date, added by)
2. "Add Internal User" form (look up user by email, assign role)
3. "Remove" action on each user row (with confirmation)

### Important: No dedicated RPCs exist for this yet

Unlike TASK-2116 (which uses RPCs from TASK-2115), this task needs to create its OWN write RPCs for internal user management as part of the Supabase migration, OR use direct table operations via RLS. The recommended approach is:

**Option A (Recommended):** Create two SECURITY DEFINER RPCs in a migration:
- `admin_add_internal_user(p_user_email TEXT, p_role TEXT)` -- Looks up user by email, inserts into internal_roles, logs action
- `admin_remove_internal_user(p_user_id UUID)` -- Removes from internal_roles, logs action

**Option B:** Use RLS policies to allow internal users to INSERT/DELETE on internal_roles directly.

The engineer should use Option A for consistency with the rest of SPRINT-112's RPC-based approach.

---

## Requirements

### Must Do:

1. **Create Supabase RPCs** (via migration, applied with MCP before UI work):

   ```sql
   -- Add internal user by email
   CREATE OR REPLACE FUNCTION public.admin_add_internal_user(
     p_email TEXT,
     p_role TEXT
   )
   RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_target_user_id UUID;
     v_existing RECORD;
   BEGIN
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     -- Validate role
     IF p_role NOT IN ('support_agent', 'support_admin', 'super_admin') THEN
       RAISE EXCEPTION 'Invalid role: %. Must be support_agent, support_admin, or super_admin', p_role;
     END IF;

     -- Look up user by email
     SELECT id INTO v_target_user_id FROM public.users WHERE email = p_email;
     IF v_target_user_id IS NULL THEN
       RAISE EXCEPTION 'No user found with email: %', p_email;
     END IF;

     -- Check if already has a role
     SELECT * INTO v_existing FROM public.internal_roles WHERE user_id = v_target_user_id;
     IF FOUND THEN
       RAISE EXCEPTION 'User already has internal role: %', v_existing.role;
     END IF;

     -- Insert
     INSERT INTO public.internal_roles (user_id, role, created_by)
     VALUES (v_target_user_id, p_role, auth.uid());

     -- Log
     PERFORM public.log_admin_action(
       'internal_user.add',
       'internal_role',
       v_target_user_id::TEXT,
       jsonb_build_object('email', p_email, 'role', p_role)
     );

     RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id, 'role', p_role);
   END;
   $$;

   -- Remove internal user
   CREATE OR REPLACE FUNCTION public.admin_remove_internal_user(
     p_user_id UUID
   )
   RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_role TEXT;
   BEGIN
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     -- Cannot remove yourself
     IF p_user_id = auth.uid() THEN
       RAISE EXCEPTION 'Cannot remove your own internal role';
     END IF;

     -- Get current role
     SELECT role INTO v_role FROM public.internal_roles WHERE user_id = p_user_id;
     IF v_role IS NULL THEN
       RAISE EXCEPTION 'User does not have an internal role';
     END IF;

     -- Delete
     DELETE FROM public.internal_roles WHERE user_id = p_user_id;

     -- Log
     PERFORM public.log_admin_action(
       'internal_user.remove',
       'internal_role',
       p_user_id::TEXT,
       jsonb_build_object('previous_role', v_role)
     );

     RETURN jsonb_build_object('success', true, 'previous_role', v_role);
   END;
   $$;

   GRANT EXECUTE ON FUNCTION public.admin_add_internal_user TO authenticated;
   GRANT EXECUTE ON FUNCTION public.admin_remove_internal_user TO authenticated;
   ```

2. **Create Settings page at `/dashboard/settings`:**
   - `admin-portal/app/dashboard/settings/page.tsx`
   - Server component that fetches internal users list
   - Query: `SELECT ir.*, u.email, u.display_name, u.avatar_url, creator.email as created_by_email FROM internal_roles ir JOIN users u ON ir.user_id = u.id LEFT JOIN users creator ON ir.created_by = creator.id ORDER BY ir.created_at DESC`

3. **Internal Users table component:**
   - Columns: Name/Email, Role, Added Date, Added By, Actions
   - Role shown as badge (color-coded: super_admin=red, support_admin=orange, support_agent=blue)
   - "Remove" button on each row (except current user's own row)
   - Confirmation dialog before removal

4. **Add Internal User form:**
   - Email input field
   - Role dropdown (support_agent, support_admin, super_admin)
   - "Add User" button
   - Error message if user not found or already has role
   - Success message + table refresh on success

5. **Enable Settings in Sidebar:**
   - In `admin-portal/components/layout/Sidebar.tsx`, change Settings `enabled: false` to `enabled: true`

### Must NOT Do:
- Do NOT add RBAC/permission-based access control (SPRINT-113)
- Do NOT allow removing your own internal role (safety check in RPC)
- Do NOT modify any other pages or routes
- Do NOT create role management UI (that is SPRINT-113 -- creating/editing roles themselves)

---

## Acceptance Criteria

- [ ] `/dashboard/settings` page renders with internal users table
- [ ] Table shows all current internal users with name, email, role, dates
- [ ] Add Internal User form works: enter email + select role -> user added to table
- [ ] Error shown if email not found or user already has a role
- [ ] Remove button removes user (with confirmation dialog)
- [ ] Cannot remove your own role (button disabled or hidden for current user)
- [ ] All add/remove actions logged in admin_audit_logs
- [ ] Settings link enabled in sidebar navigation
- [ ] `npm run build` passes with no TypeScript errors

---

## Files to Modify

- `admin-portal/components/layout/Sidebar.tsx` -- Enable Settings nav item

### Files to Create

- `admin-portal/app/dashboard/settings/page.tsx` -- Settings page
- `admin-portal/app/dashboard/settings/components/InternalUsersTable.tsx` -- User table (client component)
- `admin-portal/app/dashboard/settings/components/AddInternalUserForm.tsx` -- Add user form (client component)
- `admin-portal/app/dashboard/settings/components/RemoveUserDialog.tsx` -- Confirmation dialog

### Files to Read (for context)

- `admin-portal/components/layout/Sidebar.tsx` -- Current nav items
- `admin-portal/app/dashboard/users/page.tsx` -- Pattern reference for search UI
- `admin-portal/lib/admin-queries.ts` -- Pattern reference for RPC calls

---

## Testing Expectations

### Manual Testing
- [ ] Navigate to Settings -> internal users table loads
- [ ] Add a user with valid email -> appears in table
- [ ] Try adding user with invalid email -> error message
- [ ] Try adding user who already has a role -> error message
- [ ] Remove a user -> confirmation dialog -> user removed from table
- [ ] Verify admin_audit_logs has entries for add/remove actions
- [ ] Settings link in sidebar is enabled and navigates correctly

### CI Requirements
- [ ] `npm run build` passes
- [ ] No TypeScript errors

---

## PR Preparation

- **Title:** `feat(admin): add internal user management settings page`
- **Branch:** `feature/task-2117-internal-users`
- **Target:** `int/sprint-112-admin-account-mgmt`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-05*

### What was done

1. Applied Supabase migration with two SECURITY DEFINER RPCs:
   - `admin_add_internal_user(p_email, p_role)` - looks up user by email, inserts into internal_roles, logs action
   - `admin_remove_internal_user(p_user_id)` - removes from internal_roles with self-removal protection, logs action
   - Fixed `has_internal_role()` calls to pass `auth.uid()` parameter (task SQL had zero-arg calls)

2. Created Settings page at `/dashboard/settings`:
   - Server component fetches internal users with joined user/creator data
   - Client component orchestrates table, add form, and remove dialog
   - `InternalUsersTable` - shows all internal users with color-coded role badges (red=super_admin, orange=support_admin, blue=support_agent)
   - `AddInternalUserForm` - email + role dropdown with inline success/error messages
   - `RemoveUserDialog` - modal confirmation dialog before removal
   - Current user's row shows "(you)" label and hides Remove button

3. Enabled Settings link in Sidebar (`enabled: false` -> `enabled: true`)

### Deviation

- The SQL in the task file used `has_internal_role()` (zero-arg) but the actual function signature is `has_internal_role(check_user_id UUID)`. Fixed to use `has_internal_role(auth.uid())` in both RPCs.

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from int/sprint-112-admin-account-mgmt
- [x] Noted start time: 2026-03-05
- [x] Read task file completely

Implementation:
- [x] Supabase RPCs applied (admin_add_internal_user, admin_remove_internal_user)
- [x] Settings page created
- [x] Sidebar Settings link enabled
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

### Results

- **Before**: No internal user management UI; Settings link disabled
- **After**: Full internal user management at /dashboard/settings with add/remove RPCs
- **Actual Tokens**: ~18K (Est: 18K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- `log_admin_action()` from TASK-2114 is not deployed yet
- The `internal_roles` table schema differs from what is described
- You need to install new dependencies for UI components
- The Settings nav item pattern in Sidebar.tsx has changed
- You encounter blockers not covered in the task file
