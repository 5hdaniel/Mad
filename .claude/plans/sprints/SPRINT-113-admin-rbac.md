# SPRINT-113: Admin Portal Granular RBAC System

**Status:** Testing
**Created:** 2026-03-05
**Backlog Item:** BACKLOG-850
**Integration Branch:** `int/sprint-113-admin-rbac`
**Merge Target:** `develop`

---

## Sprint Goal

Evolve the admin portal's simple 3-role system (`support_agent`, `support_admin`, `super_admin`) into a full RBAC system with custom roles and granular permissions. Super admins can create new roles, define what each role can see/do, and assign roles to internal users.

## Dependencies

- **SPRINT-111** (P0 features) — must be complete (establishes the pages/features to gate)
- **SPRINT-112** (account management) — recommended but not a hard dependency. RBAC can be implemented without account management existing first, though the recommended sprint order is 112 -> 113 -> impersonation. If SPRINT-112 is not yet complete, RBAC permissions for write actions (e.g., `users.suspend`, `licenses.edit`) can be seeded but will have no effect until the write RPCs from SPRINT-112 exist.
- **BACKLOG-850** — parent backlog item

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

### Original Tasks (Phase 1-2)

| Task | Title | Type | Est. Tokens | Status |
|------|-------|------|-------------|--------|
| TASK-2119 | RBAC schema migration (permissions, roles, role_permissions tables) | schema | ~8K | Pending |
| TASK-2120 | Migrate internal_roles from TEXT role to role_id FK | schema | ~5K | Pending |
| TASK-2121 | Permission-checking helper functions (has_permission RPC) | schema | ~5K | Pending |
| TASK-2122 | Role management UI (create/edit/delete roles, permission matrix) | service | ~35K | Pending |
| TASK-2123 | Update middleware and page guards to check permissions | service | ~15K | Pending |
| TASK-2124 | Update internal user management to assign roles from admin_roles | service | ~10K | Pending |
| TASK-2125 | Group Settings sidebar items under collapsible sub-nav | service | ~8K | In Progress |

### SR Engineer Findings - Pre-Merge Blockers (Phase 3)

Added 2026-03-06 from SR Engineer code review. ALL items must be resolved before sprint merges to develop.

**CRITICAL (P0) - Functional bugs / broken flows:**

| Backlog | Title | Type | Est. Tokens | Status |
|---------|-------|------|-------------|--------|
| BACKLOG-880 | Middleware N+1 RPC calls - create `has_any_permission` batch RPC | bug | ~15K | Pending |
| BACKLOG-883 | Bulk remove only removes last selected user (state overwrites) | bug | ~10K | Pending |
| BACKLOG-884 | isSubmitting double-set in AddInternalUserForm | bug | ~3K | Pending |
| BACKLOG-885 | Create-user flow broken - public.users not populated by trigger | bug | ~25K | Pending |

**HIGH (P1) - Security / reliability issues:**

| Backlog | Title | Type | Est. Tokens | Status |
|---------|-------|------|-------------|--------|
| BACKLOG-886 | Create-user route does not validate roleSlug against admin_roles | bug | ~5K | Pending |
| BACKLOG-887 | Orphaned auth user on role assignment failure | bug | ~8K | Pending |
| BACKLOG-888 | Open redirect protection incomplete - backslash and encoded chars bypass | bug | ~3K | Pending |
| BACKLOG-889 | Permissions cached indefinitely - stale after role change | bug | ~8K | Pending |

**Phase 3 Subtotal:** ~77K tokens
**Notes:**
- BACKLOG-885 + BACKLOG-886 + BACKLOG-887 share the invite route and can be addressed in a single task
- BACKLOG-880 was previously logged as Medium priority; upgraded to Critical per SR findings
- BACKLOG-883 supersedes incomplete fix in BACKLOG-869
- BACKLOG-888 is a follow-up to incomplete fix in BACKLOG-867

**Total Estimated (all phases):** ~163K tokens

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
3. **Phase 3 (SR Findings - Pre-Merge Fixes):** BACKLOG-880 through BACKLOG-889 — fix critical bugs and security issues found during SR review

**Phase 3 Dependency Graph:**
```
BACKLOG-884 (isSubmitting fix)          -- independent, trivial
BACKLOG-888 (open redirect fix)         -- independent, trivial
BACKLOG-880 (has_any_permission RPC)    -- independent (middleware + new RPC)
BACKLOG-883 (bulk remove fix)           -- independent (InternalUsersTable + SettingsManager)
BACKLOG-889 (permissions cache refresh) -- independent (PermissionsProvider)
BACKLOG-885 (create-user flow)   ─┐
BACKLOG-886 (roleSlug validation) ├──── same file: invite/route.ts (sequential or combined)
BACKLOG-887 (orphaned auth user)  ┘
```

**Recommended execution:**
- **Parallel batch A:** BACKLOG-884, BACKLOG-888 (trivial fixes, ~3K each)
- **Parallel batch B:** BACKLOG-880, BACKLOG-883, BACKLOG-889 (independent files)
- **Sequential:** BACKLOG-885 + BACKLOG-886 + BACKLOG-887 (combined into single task on invite route)

Integration branch: `int/sprint-113-admin-rbac` → merge to `develop` after all phases complete.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change to internal_roles table | High | Migration adds role_id first, keeps TEXT role during transition, drops after verification |
| Existing has_internal_role() breaks | High | Update function to check admin_roles table instead of TEXT column; backwards-compatible |
| Permission explosion (too many fine-grained permissions) | Medium | Start with ~18 permissions covering current features; add more as features grow |
| Super admin locked out during migration | High | Migration seeds super-admin role and maps existing super_admin users first |
| Create-user flow fails silently (BACKLOG-885) | Critical | handle_new_user trigger creates profiles not public.users; invite route must handle all 3 existence states |
| Open redirect bypass (BACKLOG-888) | High | Current fix only blocks `//`; must also block `\` and encoded chars via stricter regex |
| Orphaned auth users on partial failure (BACKLOG-887) | Medium | Invite route needs rollback/cleanup if RPC fails after createUser succeeds |
| Stale permissions after role change (BACKLOG-889) | Medium | PermissionsProvider caches forever; needs refetch mechanism |

---

## Testing Plan

- [x] Existing admin portal functionality unaffected after schema migration
- [x] Super admin retains full access after migration
- [x] New role created via UI → user assigned → permissions enforced correctly
- [x] Removing a permission from a role immediately restricts access
- [x] System role (super_admin) cannot be deleted
- [x] Non-super-admin cannot access role management
- [x] `npm run build` passes
- [x] No TypeScript errors

---

## Acceptance Criteria

- [x] Custom roles can be created/edited/deleted by super admins
- [x] Each role has a granular permission matrix
- [ ] Default roles seeded (Support Rep, Support Supervisor, R&D, L&D, Sales, Marketing, Executive) — L&D missing, fix/QA-113-002 in progress
- [x] Internal users assigned to roles via admin_roles (not TEXT column)
- [x] Middleware checks permissions for page access
- [x] RPCs check permissions for data access
- [x] Super admin role is protected (cannot be deleted, always has all permissions)
- [x] Existing admin portal functionality preserved

---

## QA Results

**QA Completed:** 2026-03-06
**Pass Rate:** 13/14 run tests (93%) — 4 skipped

### Test Results

| Test ID | Title | Status | Notes |
|---------|-------|--------|-------|
| TEST-113-001 | Super Admin Retains Full Dashboard Access | PASS | All 6 sidebar items, role label correct |
| TEST-113-002 | Seeded Default Roles Present | FAIL | L&D role missing from seed — fix/QA-113-002 open |
| TEST-113-003 | Permission Matrix Correct for Seeded Roles | PASS | Support Rep and Marketing permissions verified |
| TEST-113-004 | Create a Custom Role | PASS | Name, description, empty matrix, permissions persist |
| TEST-113-005 | Assign Custom Role and Verify Enforcement | PASS | Critical bug found and fixed: `is_super_admin()` TEXT ref |
| TEST-113-006 | Remove Permission and Verify Immediate Restriction | PASS | Sidebar and middleware both enforce immediately |
| TEST-113-007 | Super Admin Role Cannot Be Deleted or Edited | PASS | System badge, read-only matrix, no delete button |
| TEST-113-008 | Non-Super-Admin Cannot Access Role Management | PASS | Settings hidden; Roles tab hidden without roles.view |
| TEST-113-009 | Delete a Custom Role | PASS | Confirmation dialog; RPC blocks deletion with active users |
| TEST-113-010 | Audit Log Page Loads and Displays Entries | PASS | 23 entries, all action types captured, badges correct |
| TEST-113-011 | Audit Log Filters Work Correctly | PASS | Search RPC fixed to partial match across actor/metadata |
| TEST-113-012 | Audit Log Pagination | SKIP | Only 23 entries; threshold is 25 |
| TEST-113-013 | Impersonate Button Visibility | SKIP | Feature scrapped — BACKLOG-838 deferred |
| TEST-113-014 | Start Impersonation Session | SKIP | Feature scrapped — BACKLOG-838 deferred |
| TEST-113-015 | Impersonation View and End Session | SKIP | Feature scrapped — BACKLOG-838 deferred |
| TEST-113-016 | Add User Flow Uses Role Slugs | PASS | Dropdown shows display names, submits slugs correctly |
| TEST-113-017 | Audit Log Blocked Without audit.view | PASS | Covered by TEST-113-006 evidence |
| TEST-113-018 | Build Passes With No TypeScript Errors | PASS | tsc --noEmit clean, npm run build clean |

### Bugs Found During QA

| Severity | Description | Resolution |
|----------|-------------|------------|
| Critical | `is_super_admin()` RLS function still referenced old TEXT `role` column after migration, breaking super admin RLS policies | Fixed: function updated to join on `admin_roles.is_system = TRUE` |
| Medium | `admin_get_audit_logs` search did exact match on `target_id` only; actor email/name search non-functional | Fixed: broadened to partial match across `target_id`, `metadata`, actor email, actor display name |

### Behaviour Changes Noted

| Description |
|-------------|
| Delete role RPC blocks deletion when users are still assigned (safer than silent auto-reassign) |
| Permission editor opens below roles list — minor scroll UX friction, not a blocker |

### Issues Found

| Test | Issue | Fix Branch | Fix Status |
|------|-------|------------|------------|
| TEST-113-002 | "Learning & Development" role missing from database seed | fix/QA-113-002-seed-learning-and-development | PR pending — not merged |

### Deferred Items

| Test | Reason | Target |
|------|--------|--------|
| TEST-113-012 | Pagination requires 25+ entries; only 23 in session | Retry with populated dataset |
| TEST-113-013/014/015 | Impersonation scrapped — admin-portal-only view insufficient | BACKLOG-866: broker portal impersonation |

### Merge Recommendation

**BLOCKED** -- PR #1062 cannot merge to `develop` until ALL of the following are resolved:

**From QA:**
1. `fix/QA-113-002` PR merged (or L&D role inserted directly via Supabase)
2. The two in-session critical fixes (`is_super_admin()` + audit log search) confirmed committed to the branch

**From SR Engineer Code Review (2026-03-06) -- 8 new blockers:**
3. BACKLOG-880: Middleware N+1 RPC calls (P0)
4. BACKLOG-883: Bulk remove only removes last user (P0)
5. BACKLOG-884: isSubmitting double-set (P0)
6. BACKLOG-885: Create-user flow broken (P0)
7. BACKLOG-886: roleSlug not validated (P1)
8. BACKLOG-887: Orphaned auth user on failure (P1)
9. BACKLOG-888: Open redirect bypass via backslash/encoding (P1)
10. BACKLOG-889: Permissions cached indefinitely (P1)
