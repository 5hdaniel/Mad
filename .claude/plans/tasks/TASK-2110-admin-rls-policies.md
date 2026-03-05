# TASK-2110: Admin RLS Policies and has_internal_role() Function

---

## WORKFLOW REQUIREMENT

**This task is a Supabase migration — can be applied via MCP.**

No application code changes. PM applies directly using `mcp__supabase__apply_migration`.

---

## Goal

Create a generalized `has_internal_role(user_id UUID)` SECURITY DEFINER function and add SELECT-only RLS policies on 6 tables, allowing internal role holders to read all rows cross-org.

## Non-Goals

- Do NOT add write (INSERT/UPDATE/DELETE) policies — that's SPRINT-112
- Do NOT modify existing RLS policies
- Do NOT add policies on `internal_roles` (already handled)

## Schema

```sql
-- 1. Create has_internal_role() function (any role qualifies for read access)
CREATE OR REPLACE FUNCTION public.has_internal_role(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_roles
    WHERE user_id = check_user_id
  );
$$;

-- 2. Admin SELECT policies on 6 tables (read-only)
CREATE POLICY "internal_users_can_read_all_users"
  ON public.users FOR SELECT
  USING (has_internal_role(auth.uid()));

CREATE POLICY "internal_users_can_read_all_organizations"
  ON public.organizations FOR SELECT
  USING (has_internal_role(auth.uid()));

CREATE POLICY "internal_users_can_read_all_organization_members"
  ON public.organization_members FOR SELECT
  USING (has_internal_role(auth.uid()));

CREATE POLICY "internal_users_can_read_all_licenses"
  ON public.licenses FOR SELECT
  USING (has_internal_role(auth.uid()));

CREATE POLICY "internal_users_can_read_all_devices"
  ON public.devices FOR SELECT
  USING (has_internal_role(auth.uid()));

CREATE POLICY "internal_users_can_read_all_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (has_internal_role(auth.uid()));
```

## Why `has_internal_role()` vs `is_super_admin()`

- `is_super_admin()` checks for `role = 'super_admin'` specifically
- All three roles (support_agent, support_admin, super_admin) need read access
- `has_internal_role()` checks for ANY entry in `internal_roles`
- Role-based differentiation (read vs write) will be added in SPRINT-112

## Security Notes

- SELECT-only — no write access granted
- SECURITY DEFINER bypasses RLS on `internal_roles` to avoid recursion (same pattern as `is_super_admin()`)
- Regular users (no internal role) are completely unaffected — these are additive permissive policies
- The anon key can only exercise these policies with a valid internal role session

## Acceptance Criteria

- [ ] `has_internal_role()` function exists
- [ ] All 6 tables have admin SELECT policy
- [ ] Internal user can `SELECT * FROM users` and see all rows (not just own org)
- [ ] Regular user still sees only org-scoped data
- [ ] No existing policies modified

## Integration Notes

- **Blocks:** TASK-2111, TASK-2112, TASK-2113, TASK-2108
- **Uses:** `is_super_admin()` pattern from SPRINT-109

---

## PM Estimate

**Category:** `schema`
**Estimated Tokens:** ~5K (single migration via MCP)
**Token Cap:** 20K
**Confidence:** High — straightforward DDL, proven pattern from `is_super_admin()`.
