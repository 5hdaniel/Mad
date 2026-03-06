# TASK-2115: Admin Write RPCs (Suspend/Unsuspend, Edit License)

**Backlog ID:** BACKLOG-837 (P1), BACKLOG-744
**Sprint:** SPRINT-112
**Phase:** Phase 1 - Schema
**Depends On:** TASK-2114 (admin_audit_logs + log_admin_action)
**Branch:** Applied via Supabase MCP (no code branch)
**Estimated Tokens:** ~12K (schema category x 1.3 = ~16K adjusted)

---

## Objective

Create SECURITY DEFINER RPC functions for admin write operations: suspend/unsuspend users and edit license details. All functions verify the caller is an internal user and log every action to `admin_audit_logs` via `log_admin_action()`.

---

## Context

The admin portal is currently read-only. This task adds the Supabase-side write functions that the UI (TASK-2116) will call. Using SECURITY DEFINER RPCs ensures:
1. Write logic is centralized in the database (not scattered across Next.js API routes)
2. Authorization is enforced at the database level
3. Audit logging happens atomically with the write
4. The pattern matches existing `admin_search_users` RPC approach

### Current Schema References

- `users` table has a `status` column (TEXT, values: 'active', 'suspended', etc.)
- `licenses` table has: `status` (TEXT), `expires_at` (TIMESTAMPTZ), `subscription_tier` (TEXT), `license_type` (TEXT)
- `has_internal_role()` function returns BOOLEAN -- already exists from SPRINT-109
- `log_admin_action()` function -- created by TASK-2114

---

## Requirements

### Must Do:

1. **`admin_suspend_user(p_user_id UUID)`**
   ```sql
   CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID)
   RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_current_status TEXT;
     v_result JSONB;
   BEGIN
     -- Verify caller is internal
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     -- Cannot suspend internal users (protect admin access)
     IF EXISTS (SELECT 1 FROM public.internal_roles WHERE user_id = p_user_id) THEN
       RAISE EXCEPTION 'Cannot suspend an internal user. Remove their internal role first.';
     END IF;

     -- Get current status
     SELECT status INTO v_current_status FROM public.users WHERE id = p_user_id;
     IF v_current_status IS NULL THEN
       RAISE EXCEPTION 'User not found';
     END IF;
     IF v_current_status = 'suspended' THEN
       RAISE EXCEPTION 'User is already suspended';
     END IF;

     -- Suspend
     UPDATE public.users SET status = 'suspended' WHERE id = p_user_id;

     -- Log action
     PERFORM public.log_admin_action(
       'user.suspend',
       'user',
       p_user_id::TEXT,
       jsonb_build_object('previous_status', v_current_status)
     );

     RETURN jsonb_build_object('success', true, 'previous_status', v_current_status);
   END;
   $$;
   ```

2. **`admin_unsuspend_user(p_user_id UUID)`**
   ```sql
   CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
   RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_current_status TEXT;
   BEGIN
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     SELECT status INTO v_current_status FROM public.users WHERE id = p_user_id;
     IF v_current_status IS NULL THEN
       RAISE EXCEPTION 'User not found';
     END IF;
     IF v_current_status != 'suspended' THEN
       RAISE EXCEPTION 'User is not suspended (current status: %)', v_current_status;
     END IF;

     UPDATE public.users SET status = 'active' WHERE id = p_user_id;

     PERFORM public.log_admin_action(
       'user.unsuspend',
       'user',
       p_user_id::TEXT,
       jsonb_build_object('previous_status', v_current_status)
     );

     RETURN jsonb_build_object('success', true, 'previous_status', v_current_status);
   END;
   $$;
   ```

3. **`admin_update_license(p_license_id UUID, p_changes JSONB)`**
   ```sql
   CREATE OR REPLACE FUNCTION public.admin_update_license(
     p_license_id UUID,
     p_changes JSONB
   )
   RETURNS JSONB
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_license RECORD;
     v_old_values JSONB;
   BEGIN
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     -- Get current license
     SELECT * INTO v_license FROM public.licenses WHERE id = p_license_id;
     IF NOT FOUND THEN
       RAISE EXCEPTION 'License not found';
     END IF;

     -- Capture old values for audit
     v_old_values := jsonb_build_object(
       'status', v_license.status,
       'expires_at', v_license.expires_at,
       'subscription_tier', v_license.subscription_tier,
       'transaction_limit', v_license.transaction_limit
     );

     -- Apply allowed changes (whitelist approach)
     IF p_changes ? 'status' THEN
       UPDATE public.licenses SET status = (p_changes->>'status') WHERE id = p_license_id;
     END IF;
     IF p_changes ? 'expires_at' THEN
       UPDATE public.licenses SET expires_at = (p_changes->>'expires_at')::TIMESTAMPTZ WHERE id = p_license_id;
     END IF;
     IF p_changes ? 'subscription_tier' THEN
       UPDATE public.licenses SET subscription_tier = (p_changes->>'subscription_tier') WHERE id = p_license_id;
     END IF;
     IF p_changes ? 'transaction_limit' THEN
       UPDATE public.licenses SET transaction_limit = (p_changes->>'transaction_limit')::INTEGER WHERE id = p_license_id;
     END IF;

     -- Log action
     PERFORM public.log_admin_action(
       'license.update',
       'license',
       p_license_id::TEXT,
       jsonb_build_object('old_values', v_old_values, 'new_values', p_changes, 'user_id', v_license.user_id)
     );

     RETURN jsonb_build_object('success', true, 'old_values', v_old_values, 'new_values', p_changes);
   END;
   $$;
   ```

4. Grant execute on all new functions:
   ```sql
   GRANT EXECUTE ON FUNCTION public.admin_suspend_user TO authenticated;
   GRANT EXECUTE ON FUNCTION public.admin_unsuspend_user TO authenticated;
   GRANT EXECUTE ON FUNCTION public.admin_update_license TO authenticated;
   ```

### Must NOT Do:
- Do NOT create RPCs for impersonation (out of scope, BACKLOG-838)
- Do NOT add role-based permission checks beyond `has_internal_role()` (that is SPRINT-113)
- Do NOT modify existing RPCs (`admin_search_users`, `admin_get_user_detail`)
- Do NOT create any admin portal code changes (this is schema-only)

---

## Acceptance Criteria

- [ ] `admin_suspend_user(uuid)` sets user status to 'suspended' and logs to admin_audit_logs
- [ ] `admin_unsuspend_user(uuid)` sets user status to 'active' and logs to admin_audit_logs
- [ ] `admin_update_license(uuid, changes)` updates allowed fields and logs old/new values
- [ ] All three functions reject non-internal callers with authorization error
- [ ] Cannot suspend an internal user (protection against locking out admins)
- [ ] Cannot suspend an already-suspended user (idempotency check)
- [ ] Cannot unsuspend a non-suspended user

---

## Files to Modify

- Supabase migration only (via MCP `apply_migration`)
- No code files modified

---

## Testing Expectations

### Manual Verification (via Supabase SQL Editor or MCP)
- [ ] Suspend a test user -> status becomes 'suspended', audit log entry created with actor_id
- [ ] Try to suspend again -> error "already suspended"
- [ ] Unsuspend -> status becomes 'active', audit log entry created
- [ ] Update license expiry -> new date persists, audit log has old/new values
- [ ] Call any function as non-internal user -> authorization error
- [ ] Try to suspend an internal user -> error "Cannot suspend an internal user"

### CI Requirements
- No CI impact (schema-only migration)

---

## Integration Notes

- **TASK-2116** depends on this: user detail page will call these RPCs via `supabase.rpc()`
- **TASK-2117** will need similar RPCs for internal user management (add/remove from internal_roles). Those RPCs should follow the same pattern and also call `log_admin_action()`.
- **SPRINT-113** will wrap these RPCs with permission checks (e.g., `users.suspend` permission required)

---

## Guardrails

**STOP and ask PM if:**
- The `users.status` column does not exist or uses different values than expected
- The `licenses` table schema differs from what is described above
- `log_admin_action()` from TASK-2114 is not yet applied
- Any existing RLS policy conflicts with the SECURITY DEFINER approach

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Results

- **Before**: Admin portal is read-only, no write RPCs
- **After**: Three admin write RPCs with audit logging
- **Actual Tokens**: ~XK (Est: 12K)
- **PR**: [URL after PR created]
