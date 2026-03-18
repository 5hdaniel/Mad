-- ============================================
-- PM MODULE: RBAC PERMISSIONS SEED DATA
-- Migration: 20260316_pm_rbac_seed
-- Purpose: Seed 5 permission keys for PM module, assign to super-admin role
-- Sprint: SPRINT-135 / TASK-2194
-- ============================================

-- ============================================
-- 1. RBAC Permission Keys (idempotent via WHERE NOT EXISTS)
-- ============================================
INSERT INTO admin_permissions (id, key, label, description, category)
SELECT gen_random_uuid(), v.key, v.label, v.description, v.category
FROM (VALUES
  ('pm.view',   'View PM Module',          'View backlog, board, tasks, sprints, projects', 'pm'),
  ('pm.edit',   'Edit PM Items',           'Create/edit items, add comments, change status', 'pm'),
  ('pm.assign', 'Assign PM Items',         'Assign items to users and sprints', 'pm'),
  ('pm.manage', 'Manage PM Module',        'Create/edit sprints and projects, bulk operations', 'pm'),
  ('pm.admin',  'Administrate PM Module',  'Delete items, sprints, projects', 'pm')
) AS v(key, label, description, category)
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions ap WHERE ap.key = v.key
);

-- ============================================
-- 2. Role-Permission Assignments (idempotent via WHERE NOT EXISTS)
-- super-admin gets: all 5 pm.* permissions
-- ============================================

-- Super Admin role (slug: super-admin)
INSERT INTO admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.slug = 'super-admin'
AND p.key IN ('pm.view', 'pm.edit', 'pm.assign', 'pm.manage', 'pm.admin')
AND NOT EXISTS (
  SELECT 1 FROM admin_role_permissions arp
  WHERE arp.role_id = r.id AND arp.permission_id = p.id
);
