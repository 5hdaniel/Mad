-- ============================================
-- Fix pm_get_board_tasks to include all statuses
-- Migration: 20260318_pm_board_all_statuses
-- Purpose: Add deferred, obsolete, reopened columns so items don't disappear
-- Sprint: SPRINT-147 / TASK-2244 / BACKLOG-1062
-- ============================================

CREATE OR REPLACE FUNCTION pm_get_board_tasks(
  p_sprint_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_area TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_columns JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Require at least one filter
  IF p_sprint_id IS NULL AND p_project_id IS NULL THEN
    RAISE EXCEPTION 'At least one filter required: p_sprint_id or p_project_id';
  END IF;

  -- Build columns grouped by status (all 8 statuses)
  SELECT jsonb_build_object(
    'pending', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'pending' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'in_progress', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'in_progress' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'testing', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'testing' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'completed', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'completed' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'blocked', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'blocked' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'deferred', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'deferred' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'obsolete', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'obsolete' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb),
    'reopened', COALESCE((
      SELECT jsonb_agg(item_row ORDER BY i_sort ASC)
      FROM (
        SELECT to_jsonb(i.*) AS item_row, i.sort_order AS i_sort
        FROM pm_backlog_items i
        WHERE i.status = 'reopened' AND i.deleted_at IS NULL
          AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
          AND (p_project_id IS NULL OR i.project_id = p_project_id)
          AND (p_area IS NULL OR i.area = p_area)
        ORDER BY i.sort_order ASC
      ) sub
    ), '[]'::jsonb)
  ) INTO v_columns;

  RETURN v_columns;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_board_tasks TO authenticated;
