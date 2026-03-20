-- ============================================
-- PROJECT MANAGEMENT: SCHEMA
-- Migration: 20260316_pm_schema (applied via Supabase MCP)
-- Purpose: Create 14 pm_* tables, indexes, triggers, full-text search
-- Sprint: SPRINT-135 / TASK-2191
-- ============================================

-- ============================================
-- 1. pm_projects (must be FIRST — referenced by sprints, items, labels)
-- ============================================
CREATE TABLE pm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  owner_id UUID REFERENCES auth.users(id),
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. pm_sprints (references pm_projects)
-- ============================================
CREATE TABLE pm_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  goal TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  project_id UUID REFERENCES pm_projects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. pm_backlog_items (references pm_projects, pm_sprints, self-ref parent_id)
-- ============================================
CREATE TABLE pm_backlog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  item_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'feature' CHECK (type IN ('feature', 'bug', 'chore', 'spike', 'epic')),
  area TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred', 'obsolete', 'reopened')),
  sprint_id UUID REFERENCES pm_sprints(id),
  project_id UUID REFERENCES pm_projects(id),
  parent_id UUID REFERENCES pm_backlog_items(id),
  assignee_id UUID REFERENCES auth.users(id),
  est_tokens INT,
  actual_tokens INT,
  variance NUMERIC(8,2),
  sort_order INT NOT NULL DEFAULT 0,
  start_date DATE,
  due_date DATE,
  search_vector TSVECTOR,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  file TEXT
);

-- ============================================
-- 4. pm_tasks (references pm_backlog_items, pm_sprints)
-- ============================================
CREATE TABLE pm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred')),
  backlog_item_id UUID REFERENCES pm_backlog_items(id),
  sprint_id UUID REFERENCES pm_sprints(id),
  assignee_id UUID REFERENCES auth.users(id),
  est_tokens INT,
  actual_tokens INT,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 5. pm_comments (references pm_backlog_items, pm_tasks)
-- ============================================
CREATE TABLE pm_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  body TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_comments_one_parent CHECK (
    (item_id IS NOT NULL AND task_id IS NULL) OR
    (item_id IS NULL AND task_id IS NOT NULL)
  )
);

-- ============================================
-- 6. pm_events (activity audit trail)
-- ============================================
CREATE TABLE pm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 7. pm_task_links (backlog item relationships)
--
-- NAMING NOTE: Despite the name "task_links", this table links
-- **pm_backlog_items** (not pm_tasks). Both source_id and target_id
-- reference pm_backlog_items. The name is a historical artifact;
-- renaming was deferred to avoid breaking existing RPCs and RLS
-- policies that reference this table.
-- ============================================
CREATE TABLE pm_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocked_by', 'blocks', 'related_to', 'parent_child', 'duplicates')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, link_type)
);

-- ============================================
-- 8. pm_labels (tag definitions)
-- ============================================
CREATE TABLE pm_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  project_id UUID REFERENCES pm_projects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 9. pm_item_labels (M:N join items to labels)
-- ============================================
CREATE TABLE pm_item_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES pm_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, label_id)
);

-- ============================================
-- 10. pm_dependencies (task dependency graph)
-- ============================================
CREATE TABLE pm_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'depends_on' CHECK (dependency_type IN ('depends_on', 'blocks')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id),
  CHECK(source_id != target_id)
);

-- ============================================
-- 11. pm_attachments (file attachments)
-- ============================================
CREATE TABLE pm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE,
  task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 12. pm_saved_views (saved filter configurations)
-- ============================================
CREATE TABLE pm_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  filters JSONB NOT NULL DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 13. pm_token_metrics (agent token usage tracking)
-- ============================================
CREATE TABLE pm_token_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  agent_id TEXT,
  agent_type TEXT,
  task_id TEXT,
  description TEXT,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  cache_creation_tokens INT,
  cache_read_tokens INT,
  cost_usd NUMERIC(10,4),
  duration_ms INT,
  api_calls INT,
  model TEXT,
  session_id TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 14. pm_changelog (historical change log)
-- ============================================
CREATE TABLE pm_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  change_date DATE,
  category TEXT,
  description TEXT NOT NULL,
  details TEXT,
  sprint_ref TEXT,
  task_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES: pm_backlog_items
-- ============================================
CREATE INDEX idx_pm_backlog_items_search ON pm_backlog_items USING GIN (search_vector);
CREATE INDEX idx_pm_backlog_items_status ON pm_backlog_items(status);
CREATE INDEX idx_pm_backlog_items_priority ON pm_backlog_items(priority);
CREATE INDEX idx_pm_backlog_items_sprint ON pm_backlog_items(sprint_id);
CREATE INDEX idx_pm_backlog_items_project ON pm_backlog_items(project_id);
CREATE INDEX idx_pm_backlog_items_parent ON pm_backlog_items(parent_id);
CREATE INDEX idx_pm_backlog_items_assignee ON pm_backlog_items(assignee_id);
CREATE INDEX idx_pm_backlog_items_legacy ON pm_backlog_items(legacy_id);

-- ============================================
-- INDEXES: pm_tasks
-- ============================================
CREATE INDEX idx_pm_tasks_backlog_item ON pm_tasks(backlog_item_id);
CREATE INDEX idx_pm_tasks_sprint ON pm_tasks(sprint_id);
CREATE INDEX idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX idx_pm_tasks_assignee ON pm_tasks(assignee_id);
CREATE INDEX idx_pm_tasks_legacy ON pm_tasks(legacy_id);

-- ============================================
-- INDEXES: pm_comments
-- ============================================
CREATE INDEX idx_pm_comments_item ON pm_comments(item_id);
CREATE INDEX idx_pm_comments_task ON pm_comments(task_id);

-- ============================================
-- INDEXES: pm_events
-- ============================================
CREATE INDEX idx_pm_events_item ON pm_events(item_id);
CREATE INDEX idx_pm_events_task ON pm_events(task_id);
CREATE INDEX idx_pm_events_assignee_created ON pm_events(actor_id, created_at);

-- ============================================
-- INDEXES: pm_token_metrics
-- ============================================
CREATE INDEX idx_pm_token_metrics_task ON pm_token_metrics(task_id);
CREATE INDEX idx_pm_token_metrics_agent ON pm_token_metrics(agent_id);
CREATE INDEX idx_pm_token_metrics_recorded ON pm_token_metrics(recorded_at);

-- ============================================
-- INDEXES: pm_sprints
-- ============================================
CREATE INDEX idx_pm_sprints_legacy ON pm_sprints(legacy_id);
CREATE INDEX idx_pm_sprints_status ON pm_sprints(status);

-- ============================================
-- INDEXES: pm_labels (unique on name + coalesced project_id)
-- ============================================
CREATE UNIQUE INDEX idx_pm_labels_name_project ON pm_labels(name, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'));

-- ============================================
-- INDEXES: pm_changelog
-- ============================================
CREATE INDEX idx_pm_changelog_date ON pm_changelog(change_date);
CREATE INDEX idx_pm_changelog_sprint ON pm_changelog(sprint_ref);

-- ============================================
-- TRIGGERS: updated_at (reuse existing public.update_updated_at_column)
-- ============================================
CREATE TRIGGER pm_projects_updated_at
  BEFORE UPDATE ON pm_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pm_sprints_updated_at
  BEFORE UPDATE ON pm_sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pm_backlog_items_updated_at
  BEFORE UPDATE ON pm_backlog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pm_tasks_updated_at
  BEFORE UPDATE ON pm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pm_comments_updated_at
  BEFORE UPDATE ON pm_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pm_saved_views_updated_at
  BEFORE UPDATE ON pm_saved_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGERS: full-text search vector on pm_backlog_items
-- ============================================
CREATE FUNCTION pm_backlog_items_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.body, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pm_backlog_items_search_update
  BEFORE INSERT OR UPDATE OF title, description, body ON pm_backlog_items
  FOR EACH ROW EXECUTE FUNCTION pm_backlog_items_search_trigger();

-- ============================================
-- TRIGGERS: auto-close backlog item when all tasks completed
-- When a task is marked 'completed', check if ALL sibling tasks
-- for the same backlog_item_id are also 'completed'.
-- If so, auto-set the backlog item status to 'completed'.
-- ============================================
CREATE FUNCTION pm_tasks_auto_close_item() RETURNS trigger AS $$
DECLARE
  v_incomplete_count INT;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.backlog_item_id IS NOT NULL THEN
    -- Count sibling tasks that are NOT completed (excluding soft-deleted)
    SELECT COUNT(*) INTO v_incomplete_count
    FROM pm_tasks
    WHERE backlog_item_id = NEW.backlog_item_id
      AND id != NEW.id
      AND deleted_at IS NULL
      AND status != 'completed';

    -- If no incomplete siblings remain, auto-close the backlog item
    IF v_incomplete_count = 0 THEN
      UPDATE pm_backlog_items
      SET status = 'completed',
          completed_at = now()
      WHERE id = NEW.backlog_item_id
        AND status != 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pm_tasks_auto_close
  AFTER UPDATE OF status ON pm_tasks
  FOR EACH ROW EXECUTE FUNCTION pm_tasks_auto_close_item();
