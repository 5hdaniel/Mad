# SPRINT-113: Admin Portal Granular RBAC System

**Status:** Planned
**Created:** 2026-03-05
**Backlog Item:** BACKLOG-842
**Integration Branch:** `int/sprint-113-admin-rbac`
**Merge Target:** `develop`

---

## Sprint Goal

Evolve the admin portal's simple 3-role system (`support_agent`, `support_admin`, `super_admin`) into a full RBAC system with custom roles and granular permissions. Super admins can create new roles, define what each role can see/do, and assign roles to internal users.

## Dependencies

- **SPRINT-111** (P0 features) — must be complete (establishes the pages/features to gate)
- **SPRINT-112** (account management) — must be complete (establishes the write actions to gate)
- **BACKLOG-842** — parent backlog item

## Context

### Current State (from TASK-2105)

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
```

### Target State

A flexible RBAC where:
- Roles are rows in a `roles` table (not a CHECK constraint)
- Permissions are granular (e.g., `users.view`, `users.edit`, `analytics.view`)
- Role-permission mappings are in a join table
- `super_admin` is a system role that cannot be deleted and has all permissions
- Middleware and RPCs check permissions, not role names

---

## Proposed Schema

### New Tables

```sql
-- 1. Permissions catalog
CREATE TABLE public.admin_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,        -- e.g., 'users.view', 'users.edit', 'analytics.view'
  label TEXT NOT NULL,              -- e.g., 'View Users'
  description TEXT,                 -- e.g., 'Search and view user profiles'
  category TEXT NOT NULL,           -- e.g., 'users', 'analytics', 'audit', 'settings'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Custom roles
CREATE TABLE public.admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,        -- e.g., 'Support Rep', 'R&D'
  slug TEXT NOT NULL UNIQUE,        -- e.g., 'support-rep', 'r-and-d'
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,  -- TRUE for super_admin (cannot delete)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- 3. Role-permission mapping
CREATE TABLE public.admin_role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
```

### Migration of internal_roles

```sql
-- Update internal_roles to reference admin_roles instead of TEXT check
-- Add role_id column, migrate data, drop TEXT role column
ALTER TABLE public.internal_roles ADD COLUMN role_id UUID REFERENCES public.admin_roles(id);
-- Migrate existing rows...
-- ALTER TABLE public.internal_roles DROP COLUMN role;
-- ALTER TABLE public.internal_roles ALTER COLUMN role_id SET NOT NULL;
```

### Seed Permissions

| Key | Label | Category |
|-----|-------|----------|
| `users.view` | View Users | users |
| `users.search` | Search Users | users |
| `users.detail` | View User Detail | users |
| `users.edit` | Edit User Profile | users |
| `users.suspend` | Suspend/Unsuspend Users | users |
| `users.impersonate` | Impersonate Users | users |
| `licenses.view` | View Licenses | licenses |
| `licenses.edit` | Edit Licenses | licenses |
| `transactions.view` | View Transactions | transactions |
| `transactions.edit` | Edit Transactions | transactions |
| `analytics.view` | View Analytics Dashboard | analytics |
| `analytics.export` | Export Analytics Data | analytics |
| `audit.view` | View Audit Logs | audit |
| `sentry.view` | View Sentry Errors | sentry |
| `roles.view` | View Roles & Permissions | settings |
| `roles.manage` | Create/Edit/Delete Roles | settings |
| `internal_users.view` | View Internal Users | settings |
| `internal_users.manage` | Add/Remove Internal Users | settings |

### Seed Roles (System Defaults)

| Role | Slug | Permissions | System |
|------|------|-------------|--------|
| Super Admin | `super-admin` | ALL | Yes (cannot delete) |
| Support Supervisor | `support-supervisor` | users.*, licenses.*, audit.view, sentry.view, analytics.view | No |
| Support Rep | `support-rep` | users.view, users.search, users.detail, licenses.view, audit.view, sentry.view | No |
| R&D | `r-and-d` | analytics.view, sentry.view, audit.view | No |
| Learning & Development | `learning-and-development` | users.view, analytics.view | No |
| Sales | `sales` | users.view, users.search, licenses.view, analytics.view | No |
| Marketing | `marketing` | analytics.view, analytics.export | No |
| Executive | `executive` | analytics.view, analytics.export, audit.view | No |

---

## In-Scope Tasks

| Task | Title | Type | Est. Tokens | Status |
|------|-------|------|-------------|--------|
| TASK-2119 | RBAC schema migration (permissions, roles, role_permissions tables) | schema | ~8K | Pending |
| TASK-2120 | Migrate internal_roles from TEXT role to role_id FK | schema | ~5K | Pending |
| TASK-2121 | Permission-checking helper functions (has_permission RPC) | schema | ~5K | Pending |
| TASK-2122 | Role management UI (create/edit/delete roles, permission matrix) | service | ~35K | Pending |
| TASK-2123 | Update middleware and page guards to check permissions | service | ~15K | Pending |
| TASK-2124 | Update internal user management to assign roles from admin_roles | service | ~10K | Pending |

**Total Estimated:** ~78K tokens

---

## Out of Scope / Deferred

- **Role inheritance / hierarchy** — Flat permission model for v1. Hierarchy (e.g., supervisor inherits rep permissions) is a future enhancement.
- **Field-level permissions** — v1 gates at page/section level, not individual fields.
- **API rate limiting per role** — Not needed yet.
- **Audit log for permission changes** — Will use existing admin_audit_logs from SPRINT-112.

---

## Merge Plan

1. **Phase 1 (Schema):** TASK-2119 + TASK-2120 + TASK-2121 — applied via Supabase MCP, no app code
2. **Phase 2 (UI + Enforcement):** TASK-2122 + TASK-2123 + TASK-2124 — parallel engineer agents with worktree isolation

Integration branch: `int/sprint-113-admin-rbac` → merge to `develop` after all tasks complete.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change to internal_roles table | High | Migration adds role_id first, keeps TEXT role during transition, drops after verification |
| Existing has_internal_role() breaks | High | Update function to check admin_roles table instead of TEXT column; backwards-compatible |
| Permission explosion (too many fine-grained permissions) | Medium | Start with ~18 permissions covering current features; add more as features grow |
| Super admin locked out during migration | High | Migration seeds super-admin role and maps existing super_admin users first |

---

## Testing Plan

- [ ] Existing admin portal functionality unaffected after schema migration
- [ ] Super admin retains full access after migration
- [ ] New role created via UI → user assigned → permissions enforced correctly
- [ ] Removing a permission from a role immediately restricts access
- [ ] System role (super_admin) cannot be deleted
- [ ] Non-super-admin cannot access role management
- [ ] `npm run build` passes
- [ ] No TypeScript errors

---

## Acceptance Criteria

- [ ] Custom roles can be created/edited/deleted by super admins
- [ ] Each role has a granular permission matrix
- [ ] Default roles seeded (Support Rep, Support Supervisor, R&D, L&D, Sales, Marketing, Executive)
- [ ] Internal users assigned to roles via admin_roles (not TEXT column)
- [ ] Middleware checks permissions for page access
- [ ] RPCs check permissions for data access
- [ ] Super admin role is protected (cannot be deleted, always has all permissions)
- [ ] Existing admin portal functionality preserved
