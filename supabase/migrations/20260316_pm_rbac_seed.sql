-- ============================================
-- PM MODULE: RBAC PERMISSIONS SEED DATA
-- Migration: 20260316_pm_rbac_seed
-- Purpose: Seed 5 permission keys for PM module, assign to super-admin role
-- Sprint: SPRINT-135 / TASK-2194
-- ============================================

-- ============================================
-- 1. RBAC Permission Keys
-- ============================================
INSERT INTO admin_permissions (id, key, label, description, category) VALUES
  (gen_random_uuid(), 'pm.view', 'View PM Module', 'View backlog, board, tasks, sprints, projects', 'pm'),
  (gen_random_uuid(), 'pm.edit', 'Edit PM Items', 'Create/edit items, add comments, change status', 'pm'),
  (gen_random_uuid(), 'pm.assign', 'Assign PM Items', 'Assign items to users and sprints', 'pm'),
  (gen_random_uuid(), 'pm.manage', 'Manage PM Module', 'Create/edit sprints and projects, bulk operations', 'pm'),
  (gen_random_uuid(), 'pm.admin', 'Administrate PM Module', 'Delete items, sprints, projects', 'pm');

-- ============================================
-- 2. Role-Permission Assignments
-- super-admin gets: all 5 pm.* permissions
-- ============================================

-- Super Admin role (slug: super-admin)
INSERT INTO admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.slug = 'super-admin'
AND p.key IN ('pm.view', 'pm.edit', 'pm.assign', 'pm.manage', 'pm.admin');
