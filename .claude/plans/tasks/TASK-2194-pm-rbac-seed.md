# Task TASK-2194: Create RBAC Seed Migration

**Status:** In Progress
**Backlog ID:** BACKLOG-957
**Sprint:** SPRINT-135
**Phase:** Phase 1 — Supabase Schema
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2194-pm-rbac-seed`
**Estimated Tokens:** ~8K
**Depends On:** TASK-2191 (tables must exist for context, though this seeds `admin_permissions` which exists already)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Objective

Create a Supabase migration that seeds PM-related RBAC permissions into the existing `admin_permissions` table and assigns them to appropriate roles. This follows the exact same pattern as the support RBAC seed migration.

---

## Context

The admin portal uses an RBAC system with:
- `admin_permissions` — permission key definitions
- `admin_roles` — role definitions (slugs like `super-admin`, `support-agent`, etc.)
- `admin_role_permissions` — M:N join assigning permissions to roles

The support module added its permissions via `supabase/migrations/20260313_support_rbac_seed.sql`. This task does the same for PM permissions.

**Pattern reference:** `supabase/migrations/20260313_support_rbac_seed.sql` — follow this EXACT pattern.

---

## Requirements

### Must Do:

1. **Create migration file** `supabase/migrations/20260316_pm_rbac_seed.sql`

2. **Seed 5 PM permission keys** into `admin_permissions`:

   ```sql
   INSERT INTO admin_permissions (id, key, label, description, category) VALUES
     (gen_random_uuid(), 'pm.view', 'View PM Module', 'View backlog, board, tasks, sprints, projects', 'pm'),
     (gen_random_uuid(), 'pm.edit', 'Edit PM Items', 'Create/edit items, add comments, change status', 'pm'),
     (gen_random_uuid(), 'pm.assign', 'Assign PM Items', 'Assign items to users and sprints', 'pm'),
     (gen_random_uuid(), 'pm.manage', 'Manage PM Module', 'Create/edit sprints and projects, bulk operations', 'pm'),
     (gen_random_uuid(), 'pm.admin', 'Administrate PM Module', 'Delete items, sprints, projects', 'pm');
   ```

3. **Assign permissions to roles:**

   | Role | Permissions |
   |------|-------------|
   | `super-admin` | All 5 (pm.view, pm.edit, pm.assign, pm.manage, pm.admin) |

   **Note:** Unlike support which has `support-agent` and `support-supervisor` roles, the PM module is currently only used by super-admins. We can add more roles later if needed.

   ```sql
   -- Super Admin gets all PM permissions
   INSERT INTO admin_role_permissions (id, role_id, permission_id)
   SELECT gen_random_uuid(), r.id, p.id
   FROM admin_roles r
   CROSS JOIN admin_permissions p
   WHERE r.slug = 'super-admin'
   AND p.key IN ('pm.view', 'pm.edit', 'pm.assign', 'pm.manage', 'pm.admin');
   ```

4. **Apply the migration** using Supabase MCP `apply_migration`

### Must NOT Do:
- Do NOT modify existing permissions (support.*, users.*, etc.)
- Do NOT create new roles — only assign to existing roles
- Do NOT modify the `admin_permissions` or `admin_roles` table structure
- Do NOT add `ON CONFLICT` — these are fresh inserts (no legacy data)

---

## Acceptance Criteria

- [ ] Migration file `supabase/migrations/20260316_pm_rbac_seed.sql` exists and is valid SQL
- [ ] 5 PM permission rows exist in `admin_permissions` with `category = 'pm'`
- [ ] Verify: `SELECT key FROM admin_permissions WHERE category = 'pm' ORDER BY key` returns `pm.admin`, `pm.assign`, `pm.edit`, `pm.manage`, `pm.view`
- [ ] `super-admin` role has all 5 PM permissions assigned
- [ ] Verify: `SELECT p.key FROM admin_role_permissions rp JOIN admin_permissions p ON p.id = rp.permission_id JOIN admin_roles r ON r.id = rp.role_id WHERE r.slug = 'super-admin' AND p.category = 'pm' ORDER BY p.key` returns all 5
- [ ] No existing permission assignments are modified
- [ ] Migration applied via Supabase MCP without errors

---

## Files to Create

- `supabase/migrations/20260316_pm_rbac_seed.sql`

## Files to Read (for context)

- `supabase/migrations/20260313_support_rbac_seed.sql` — **copy this exact pattern**, just change support -> pm
- `admin-portal/lib/permissions.ts` — verify permission key naming convention matches

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Verification:** SQL queries via Supabase MCP

### CI Requirements
- [ ] Migration applies without errors
- [ ] Permission rows verified via SELECT
- [ ] Role assignments verified via SELECT

---

## PR Preparation

- **Title:** `feat(pm): seed RBAC permissions for PM module`
- **Branch:** `feature/TASK-2194-pm-rbac-seed`
- **Target:** `feature/pm-module`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-16*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from feature/pm-module
- [x] Read 20260313_support_rbac_seed.sql for pattern
- [x] Noted start time: 2026-03-16
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Migration applies without errors
- [x] Permission rows verified (5 pm.* keys in admin_permissions)
- [x] Role assignments verified (super-admin has all 5 pm.* permissions)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### What Was Done

- Created `supabase/migrations/20260316_pm_rbac_seed.sql` following the exact pattern from `20260313_support_rbac_seed.sql`
- Seeded 5 PM permission keys: `pm.view`, `pm.edit`, `pm.assign`, `pm.manage`, `pm.admin` into `admin_permissions` with category `pm`
- Assigned all 5 permissions to `super-admin` role via `admin_role_permissions` CROSS JOIN pattern
- Applied migration via Supabase MCP -- verified all 5 rows exist and role assignments are correct
- Verified no existing permissions were modified (all other categories retain original counts)

### Issues/Blockers

None. The `admin_permissions` and `admin_role_permissions` tables matched expected structure. The `super-admin` role slug exists.

### Results

- **Before**: No pm.* permissions in admin_permissions
- **After**: 5 pm.* permissions seeded, assigned to super-admin
- **Actual Tokens**: ~8K (Est: ~8K)
- **PR**: https://github.com/5hdaniel/Mad/pull/1170

---

## Guardrails

**STOP and ask PM if:**
- The `admin_permissions` table structure has changed from what's expected
- The `super-admin` role slug doesn't exist
- You think additional roles should get PM permissions
- You encounter blockers not covered in the task file
