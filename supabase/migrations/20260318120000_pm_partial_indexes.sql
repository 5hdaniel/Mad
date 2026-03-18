-- ============================================
-- PM MODULE: PARTIAL INDEXES FOR PERFORMANCE
-- Migration: 20260318120000_pm_partial_indexes
-- Purpose: Add partial indexes on frequently queried columns,
--          excluding soft-deleted rows for better query performance.
-- Sprint: TASK-2253 / BACKLOG-1064
-- ============================================

-- Active backlog items filtered by status and priority (excludes soft-deleted)
CREATE INDEX IF NOT EXISTS idx_pm_backlog_items_active
  ON pm_backlog_items (status, priority)
  WHERE deleted_at IS NULL;

-- Active tasks filtered by status (excludes soft-deleted)
CREATE INDEX IF NOT EXISTS idx_pm_tasks_active
  ON pm_tasks (status)
  WHERE deleted_at IS NULL;

-- Sprints scoped to a project (only rows with a project_id)
CREATE INDEX IF NOT EXISTS idx_pm_sprints_project
  ON pm_sprints (project_id)
  WHERE project_id IS NOT NULL;
