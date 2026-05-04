-- ============================================
-- BACKLOG-1664: Multi-project sprints on PM board
--
-- Problem: pm_get_project_detail currently only returns sprints where
-- pm_sprints.project_id = p_project_id, but sprints are now intended to be
-- standalone — the same sprint can hold tasks from multiple projects.
-- As a result, a project whose tasks live in a sprint with project_id IS NULL
-- does not see that sprint on its project page.
--
-- Fix: rewrite pm_get_project_detail so the sprint lookup is driven by
-- "any non-deleted backlog item in this project points at this sprint",
-- keeping a legacy OR-branch on pm_sprints.project_id for pre-existing data.
-- Also return per-sprint `project_total` + `project_completed` counts scoped
-- to p_project_id so the project page can render a project-scoped progress
-- bar without a second roundtrip.
--
-- Compatibility: the returned JSON shape keeps `project`, `sprints`,
-- `items_by_status` top-level keys and every existing sprint field,
-- including the legacy `item_counts` (by status, sprint-wide) and
-- `total_items` (sprint-wide) keys already consumed by the UI. Two new
-- fields are added per sprint row: `project_total`, `project_completed`.
-- Callers that don't read those fields are unaffected.
--
-- Note: pm_sprints.project_id is deprecated (stays in the schema but
-- should not be filtered on going forward). See BACKLOG-1664.
-- ============================================

CREATE OR REPLACE FUNCTION pm_get_project_detail(
  p_project_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_project JSONB;
  v_sprints JSONB;
  v_items_by_status JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT to_jsonb(p.*) INTO v_project
  FROM pm_projects p
  WHERE p.id = p_project_id AND p.deleted_at IS NULL;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  -- Sprints visible to this project:
  --   * any non-deleted sprint referenced by a non-deleted backlog item
  --     that belongs to this project, OR
  --   * (legacy) sprints still carrying the old pm_sprints.project_id stamp.
  --
  -- For each sprint we return to_jsonb(s.*) merged with four computed fields:
  --   * item_counts       — by-status counts across ALL items in the sprint
  --                         (sprint-wide, not scoped to this project).
  --                         Preserved for back-compat with existing UI.
  --   * total_items       — total items in the sprint (sprint-wide).
  --                         Preserved for back-compat with existing UI.
  --   * project_total     — total items in the sprint that belong to THIS
  --                         project (BACKLOG-1664).
  --   * project_completed — completed items in the sprint that belong to
  --                         THIS project (BACKLOG-1664).
  --
  -- BACKLOG-1051: deleted_at IS NULL filter preserved.
  -- BACKLOG-1664: cross-project lookup + per-project counts.
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(s.*) || jsonb_build_object(
        'item_counts', COALESCE((
          SELECT jsonb_object_agg(bi.status, bi.cnt)
          FROM (
            SELECT i.status, COUNT(*) AS cnt
            FROM pm_backlog_items i
            WHERE i.sprint_id = s.id AND i.deleted_at IS NULL
            GROUP BY i.status
          ) bi
        ), '{}'::jsonb),
        'total_items', (
          SELECT COUNT(*)
          FROM pm_backlog_items i
          WHERE i.sprint_id = s.id AND i.deleted_at IS NULL
        ),
        'project_total', (
          SELECT COUNT(*)
          FROM pm_backlog_items i
          WHERE i.sprint_id = s.id
            AND i.project_id = p_project_id
            AND i.deleted_at IS NULL
        ),
        'project_completed', (
          SELECT COUNT(*)
          FROM pm_backlog_items i
          WHERE i.sprint_id = s.id
            AND i.project_id = p_project_id
            AND i.deleted_at IS NULL
            AND i.status = 'completed'
        )
      )
      ORDER BY s.start_date DESC NULLS LAST, s.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_sprints
  FROM pm_sprints s
  WHERE s.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM pm_backlog_items i
        WHERE i.sprint_id = s.id
          AND i.project_id = p_project_id
          AND i.deleted_at IS NULL
      )
      OR s.project_id = p_project_id  -- legacy: pre-BACKLOG-1664 sprints
    );

  -- Get item counts by status (scoped to this project).
  SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb)
  INTO v_items_by_status
  FROM (
    SELECT i.status, COUNT(*) AS cnt
    FROM pm_backlog_items i
    WHERE i.project_id = p_project_id AND i.deleted_at IS NULL
    GROUP BY i.status
  ) sc;

  RETURN jsonb_build_object(
    'project', v_project,
    'sprints', v_sprints,
    'items_by_status', v_items_by_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_project_detail TO authenticated;
