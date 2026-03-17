-- ============================================
-- PROJECT MANAGEMENT: RLS POLICIES
-- Migration: 20260316_pm_rls_policies
-- Purpose: Enable RLS and create SELECT-only policies for internal-only access
-- Sprint: SPRINT-135 / TASK-2192
-- ============================================
-- Core principle: Tables are READ-ONLY at RLS level.
-- ALL writes go through SECURITY DEFINER RPCs (TASK-2193).
-- Internal detection: EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
-- No customer/public access needed — PM module is admin-portal only.
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL 14 pm_* TABLES
-- ============================================
ALTER TABLE pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_item_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_token_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_changelog ENABLE ROW LEVEL SECURITY;

-- ============================================
-- pm_projects: Internal users can read all projects
-- ============================================
CREATE POLICY "Internal users can read pm_projects"
  ON pm_projects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_sprints: Internal users can read all sprints
-- ============================================
CREATE POLICY "Internal users can read pm_sprints"
  ON pm_sprints FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_backlog_items: Internal users can read all backlog items
-- ============================================
CREATE POLICY "Internal users can read pm_backlog_items"
  ON pm_backlog_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_tasks: Internal users can read all tasks
-- ============================================
CREATE POLICY "Internal users can read pm_tasks"
  ON pm_tasks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_comments: Internal users can read all comments
-- ============================================
CREATE POLICY "Internal users can read pm_comments"
  ON pm_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_events: Internal users can read all events
-- ============================================
CREATE POLICY "Internal users can read pm_events"
  ON pm_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_task_links: Internal users can read all task links
-- ============================================
CREATE POLICY "Internal users can read pm_task_links"
  ON pm_task_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_labels: Internal users can read all labels
-- ============================================
CREATE POLICY "Internal users can read pm_labels"
  ON pm_labels FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_item_labels: Internal users can read all item-label associations
-- ============================================
CREATE POLICY "Internal users can read pm_item_labels"
  ON pm_item_labels FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_dependencies: Internal users can read all dependencies
-- ============================================
CREATE POLICY "Internal users can read pm_dependencies"
  ON pm_dependencies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_attachments: Internal users can read all attachments
-- ============================================
CREATE POLICY "Internal users can read pm_attachments"
  ON pm_attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_saved_views: Internal users can read their OWN views + shared views
-- (Unlike other tables, this has per-user visibility)
-- ============================================
CREATE POLICY "Users can read own or shared saved views"
  ON pm_saved_views FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
    AND (user_id = auth.uid() OR is_shared = true)
  );

-- ============================================
-- pm_token_metrics: Internal users can read all token metrics
-- ============================================
CREATE POLICY "Internal users can read pm_token_metrics"
  ON pm_token_metrics FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- pm_changelog: Internal users can read all changelog entries
-- ============================================
CREATE POLICY "Internal users can read pm_changelog"
  ON pm_changelog FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- GRANT SELECT ON PM TABLES TO authenticated
-- (RLS controls what they actually see — only internal_roles users)
-- No anon access needed for PM module (admin-portal only).
-- ============================================
GRANT SELECT ON pm_projects TO authenticated;
GRANT SELECT ON pm_sprints TO authenticated;
GRANT SELECT ON pm_backlog_items TO authenticated;
GRANT SELECT ON pm_tasks TO authenticated;
GRANT SELECT ON pm_comments TO authenticated;
GRANT SELECT ON pm_events TO authenticated;
GRANT SELECT ON pm_task_links TO authenticated;
GRANT SELECT ON pm_labels TO authenticated;
GRANT SELECT ON pm_item_labels TO authenticated;
GRANT SELECT ON pm_dependencies TO authenticated;
GRANT SELECT ON pm_attachments TO authenticated;
GRANT SELECT ON pm_saved_views TO authenticated;
GRANT SELECT ON pm_token_metrics TO authenticated;
GRANT SELECT ON pm_changelog TO authenticated;
