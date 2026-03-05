# TASK-2105: Create internal_roles Table and Seed Data

---

## WORKFLOW REQUIREMENT

**This task is a Supabase migration — can be applied via MCP or dashboard.**

No application code changes. The PM can apply this directly using `mcp__supabase__apply_migration`.

---

## Goal

Create the `internal_roles` table in Supabase to identify users with internal support/admin access. Seed the initial super_admin user. This table is separate from organization-scoped roles (`organization_members.role`) and controls access to the admin portal at `admin.keeprcompliance.com`.

## Non-Goals

- Do NOT modify existing `organization_members` or `users` tables
- Do NOT create admin RLS policies for other tables yet (that's SPRINT-110)
- Do NOT create the cross-org search RPC yet (that's SPRINT-110)

## Deliverables

1. New table: `public.internal_roles`
2. RLS policies on `internal_roles`
3. Seed data: dhaim@bluespaces.com as super_admin

## Schema

```sql
CREATE TABLE public.internal_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('support_agent', 'support_admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.internal_roles ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own internal role (needed for auth check)
CREATE POLICY "Users can read own internal role"
  ON public.internal_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: super_admins can manage all internal roles
CREATE POLICY "Super admins can manage internal roles"
  ON public.internal_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_internal_roles_user_id ON public.internal_roles(user_id);

-- Seed: dhaim@bluespaces.com as super_admin
INSERT INTO public.internal_roles (user_id, role)
VALUES (
  'a08cfcc6-7e4d-4377-af70-f20ee6b62ca0',
  'super_admin'
);
```

## Role Hierarchy

| Role | Can Access Admin Portal | Can Manage Users | Can Impersonate | Can Manage Internal Roles |
|------|------------------------|-----------------|----------------|--------------------------|
| support_agent | Yes | Read-only | No | No |
| support_admin | Yes | Yes | Yes | No |
| super_admin | Yes | Yes | Yes | Yes |

## Acceptance Criteria

- [ ] `internal_roles` table exists in public schema
- [ ] RLS is enabled
- [ ] Users can only read their own role
- [ ] Super admins can manage all roles
- [ ] dhaim@bluespaces.com has super_admin role
- [ ] `SELECT * FROM internal_roles` returns the seed row when queried as that user

## Integration Notes

- **Blocks:** TASK-2106 (admin portal auth queries this table)
- **Future:** SPRINT-110 will add admin RLS policies on other tables that reference `internal_roles`
- **Future:** SPRINT-111 will use the role hierarchy for impersonation access control

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~5K (can be applied via MCP, minimal agent work)

**Token Cap:** 20K

**Confidence:** High — straightforward DDL.
