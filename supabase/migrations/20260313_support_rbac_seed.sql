-- ============================================
-- SUPPORT TICKETING: RBAC PERMISSIONS + CATEGORY SEED DATA
-- Migration: 20260313_support_rbac_seed
-- Purpose: Seed 5 permission keys, 7 categories with subcategories, role assignments
-- Sprint: SPRINT-130 / TASK-2171
-- ============================================

-- ============================================
-- 1. RBAC Permission Keys
-- ============================================
INSERT INTO admin_permissions (id, key, label, description, category) VALUES
  (gen_random_uuid(), 'support.view', 'View Support Queue', 'View the support ticket queue', 'support'),
  (gen_random_uuid(), 'support.respond', 'Respond to Tickets', 'Reply to tickets and add internal notes', 'support'),
  (gen_random_uuid(), 'support.assign', 'Assign Tickets', 'Assign and reassign tickets to agents', 'support'),
  (gen_random_uuid(), 'support.manage', 'Manage Tickets', 'Change ticket status, priority, and category', 'support'),
  (gen_random_uuid(), 'support.admin', 'Administrate Support', 'Delete tickets, configure categories, reopen closed tickets', 'support');

-- ============================================
-- 2. Role-Permission Assignments
-- support-agent gets: view, respond, assign, manage
-- support-supervisor gets: all 5
-- super-admin gets: all 5
-- ============================================

-- Support Agent role (slug: support-agent)
INSERT INTO admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.slug = 'support-agent'
AND p.key IN ('support.view', 'support.respond', 'support.assign', 'support.manage');

-- Support Supervisor role (slug: support-supervisor)
INSERT INTO admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.slug = 'support-supervisor'
AND p.key IN ('support.view', 'support.respond', 'support.assign', 'support.manage', 'support.admin');

-- Super Admin role (slug: super-admin)
INSERT INTO admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.slug = 'super-admin'
AND p.key IN ('support.view', 'support.respond', 'support.assign', 'support.manage', 'support.admin');

-- ============================================
-- 3. Category Seed Data (7 top-level + subcategories)
-- ============================================

-- Authentication & Access
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Authentication & Access', 'authentication-access', 'Login, MFA, and account access issues', 1);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000001-0000-0000-0000-000000000011', 'Login failure', 'login-failure', 1, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000012', 'MFA/2FA issue', 'mfa-2fa-issue', 2, 'a0000001-0000-0000-0000-000000000001'),
  ('a0000001-0000-0000-0000-000000000013', 'Account lockout', 'account-lockout', 3, 'a0000001-0000-0000-0000-000000000001');

-- Product Technical
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000002-0000-0000-0000-000000000001', 'Product Technical', 'product-technical', 'Bugs, performance, and data issues', 2);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000002-0000-0000-0000-000000000011', 'App bug/error', 'app-bug-error', 1, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000012', 'Performance issue', 'performance-issue', 2, 'a0000002-0000-0000-0000-000000000001'),
  ('a0000002-0000-0000-0000-000000000013', 'Data sync/import/export', 'data-sync-import-export', 3, 'a0000002-0000-0000-0000-000000000001');

-- Billing & Subscription
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000003-0000-0000-0000-000000000001', 'Billing & Subscription', 'billing-subscription', 'Invoices, payments, plan changes', 3);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000003-0000-0000-0000-000000000011', 'Invoice/payment issue', 'invoice-payment-issue', 1, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000012', 'Plan/seat change', 'plan-seat-change', 2, 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-0000-0000-0000-000000000013', 'Refund/cancellation request', 'refund-cancellation-request', 3, 'a0000003-0000-0000-0000-000000000001');

-- Compliance Guidance (with disclaimer metadata)
INSERT INTO support_categories (id, name, slug, description, sort_order, metadata) VALUES
  ('a0000004-0000-0000-0000-000000000001', 'Compliance Guidance', 'compliance-guidance', 'Product capability and compliance questions', 4,
   '{"disclaimer": "We provide product guidance and workflow support. We do not provide legal advice."}'::jsonb);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000004-0000-0000-0000-000000000011', 'Product capability clarification', 'product-capability-clarification', 1, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000012', 'Process/policy question', 'process-policy-question', 2, 'a0000004-0000-0000-0000-000000000001'),
  ('a0000004-0000-0000-0000-000000000013', 'Documentation request', 'documentation-request', 3, 'a0000004-0000-0000-0000-000000000001');

-- IT / Organization Setup
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000005-0000-0000-0000-000000000001', 'IT / Organization Setup', 'it-organization-setup', 'SSO, SCIM, and provisioning', 5);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000005-0000-0000-0000-000000000011', 'SSO setup', 'sso-setup', 1, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000012', 'SCIM setup', 'scim-setup', 2, 'a0000005-0000-0000-0000-000000000001'),
  ('a0000005-0000-0000-0000-000000000013', 'Provisioning/user management', 'provisioning-user-management', 3, 'a0000005-0000-0000-0000-000000000001');

-- How-To / Training
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000006-0000-0000-0000-000000000001', 'How-To / Training', 'how-to-training', 'Workflow and best-practice questions', 6);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000006-0000-0000-0000-000000000011', 'Workflow question', 'workflow-question', 1, 'a0000006-0000-0000-0000-000000000001'),
  ('a0000006-0000-0000-0000-000000000012', 'Best-practice guidance', 'best-practice-guidance', 2, 'a0000006-0000-0000-0000-000000000001');

-- Feature Request
INSERT INTO support_categories (id, name, slug, description, sort_order) VALUES
  ('a0000007-0000-0000-0000-000000000001', 'Feature Request', 'feature-request', 'New features and enhancements', 7);

INSERT INTO support_categories (id, name, slug, sort_order, parent_id) VALUES
  ('a0000007-0000-0000-0000-000000000011', 'New feature', 'new-feature', 1, 'a0000007-0000-0000-0000-000000000001'),
  ('a0000007-0000-0000-0000-000000000012', 'Enhancement request', 'enhancement-request', 2, 'a0000007-0000-0000-0000-000000000001');
