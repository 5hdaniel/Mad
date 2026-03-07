# TASK-2114: Admin Audit Log Schema + Logging Helper

**Backlog ID:** BACKLOG-837 (P1), BACKLOG-744
**Sprint:** SPRINT-112
**Phase:** Phase 1 - Schema
**Branch:** Applied via Supabase MCP (no code branch)
**Estimated Tokens:** ~10K (schema category x 1.3 = ~13K adjusted)

---

## Objective

Create the `admin_audit_logs` table and a `log_admin_action()` SECURITY DEFINER helper function in Supabase. This table records all admin portal write operations (suspend, unsuspend, license edits, internal user changes) with actor identity, action type, target, and metadata. Separate from the existing `audit_logs` table which is for user-facing audit trail.

---

## Context

The admin portal currently has zero write operations. SPRINT-112 adds write RPCs (TASK-2115) that need audit logging. This task creates the logging infrastructure that all write RPCs will call.

The existing `audit_logs` table is used for user-facing audit trail (transaction actions logged by the Electron app). Admin actions should NOT go into that table -- they need a separate `admin_audit_logs` table to:
1. Avoid polluting user-facing audit trail
2. Enable admin-specific queries (e.g., "who suspended this user?")
3. Allow different retention policies
4. Provide the audit log that RBAC (SPRINT-113) and impersonation will also reuse

---

## Requirements

### Must Do:

1. Create `admin_audit_logs` table:
   ```sql
   CREATE TABLE public.admin_audit_logs (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     actor_id UUID NOT NULL REFERENCES public.users(id),
     action TEXT NOT NULL,           -- e.g., 'user.suspend', 'user.unsuspend', 'license.update', 'internal_user.add', 'internal_user.remove'
     target_type TEXT NOT NULL,      -- e.g., 'user', 'license', 'internal_role'
     target_id TEXT NOT NULL,        -- UUID of the target entity (TEXT to allow flexibility)
     metadata JSONB DEFAULT '{}',   -- Action-specific data (e.g., old/new values for license edits)
     ip_address TEXT,               -- Optional, captured if available
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. Add RLS policy: only internal users can SELECT from `admin_audit_logs`
   ```sql
   ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Internal users can view admin audit logs"
     ON public.admin_audit_logs
     FOR SELECT
     USING (public.has_internal_role());
   ```

3. Create `log_admin_action()` helper function:
   ```sql
   CREATE OR REPLACE FUNCTION public.log_admin_action(
     p_action TEXT,
     p_target_type TEXT,
     p_target_id TEXT,
     p_metadata JSONB DEFAULT '{}'
   )
   RETURNS UUID
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     v_log_id UUID;
   BEGIN
     -- Verify caller is internal user
     IF NOT public.has_internal_role() THEN
       RAISE EXCEPTION 'Unauthorized: caller is not an internal user';
     END IF;

     INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
     VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata)
     RETURNING id INTO v_log_id;

     RETURN v_log_id;
   END;
   $$;
   ```

4. Add an index on `target_id` for lookups by user/entity:
   ```sql
   CREATE INDEX idx_admin_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
   CREATE INDEX idx_admin_audit_logs_actor ON public.admin_audit_logs(actor_id);
   CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
   ```

5. Grant execute on the helper function:
   ```sql
   GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
   ```

### Must NOT Do:
- Do NOT modify the existing `audit_logs` table
- Do NOT add INSERT/UPDATE/DELETE policies for admin_audit_logs (only the SECURITY DEFINER function writes to it)
- Do NOT create any admin portal code changes (this is schema-only)

---

## Acceptance Criteria

- [ ] `admin_audit_logs` table exists with all columns defined above
- [ ] RLS enabled with SELECT policy for internal users only
- [ ] `log_admin_action()` function exists and is SECURITY DEFINER
- [ ] Calling `log_admin_action('test.action', 'user', '<uuid>')` as internal user succeeds
- [ ] Calling `log_admin_action(...)` as non-internal user raises authorization error
- [ ] Indexes created for target, actor, and created_at columns
- [ ] Regular users cannot SELECT from admin_audit_logs

---

## Files to Modify

- Supabase migration only (via MCP `apply_migration`)
- No code files modified

---

## Testing Expectations

### Manual Verification (via Supabase SQL Editor or MCP)
- [ ] Insert via `log_admin_action()` as internal user -- succeeds
- [ ] Insert via `log_admin_action()` as regular user -- fails with authorization error
- [ ] SELECT from `admin_audit_logs` as internal user -- succeeds
- [ ] SELECT from `admin_audit_logs` as regular user -- returns empty (RLS blocks)

### CI Requirements
- No CI impact (schema-only migration)

---

## Integration Notes

- **TASK-2115** depends on this task -- all write RPCs call `log_admin_action()`
- **SPRINT-113** (RBAC) will reuse this audit log table for permission change tracking
- Future impersonation sprint will also log to this table

---

## Guardrails

**STOP and ask PM if:**
- The existing `audit_logs` table schema conflicts with this design
- `has_internal_role()` function does not exist or behaves unexpectedly
- Migration fails due to missing dependencies

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Results

- **Before**: No admin audit logging capability
- **After**: admin_audit_logs table + log_admin_action() helper ready for write RPCs
- **Actual Tokens**: ~XK (Est: 10K)
- **PR**: [URL after PR created]
