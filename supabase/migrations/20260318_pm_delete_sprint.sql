-- Add soft-delete column to pm_sprints (matches pm_backlog_items pattern)
ALTER TABLE pm_sprints ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- pm_delete_sprint: Soft-delete a sprint (sets deleted_at)
CREATE OR REPLACE FUNCTION pm_delete_sprint(
  p_sprint_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_sprint_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  UPDATE pm_sprints
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_sprint_id AND deleted_at IS NULL
  RETURNING name INTO v_sprint_name;

  IF v_sprint_name IS NULL THEN
    RAISE EXCEPTION 'Sprint not found or already deleted';
  END IF;

  RETURN jsonb_build_object('success', true, 'sprint_id', p_sprint_id, 'name', v_sprint_name);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_delete_sprint TO authenticated;

-- Update pm_list_sprints to filter out soft-deleted sprints
CREATE OR REPLACE FUNCTION pm_list_sprints()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_sprints JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(sprint_row ORDER BY s_created DESC), '[]'::jsonb)
  INTO v_sprints
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'legacy_id', s.legacy_id,
      'name', s.name,
      'goal', s.goal,
      'status', s.status,
      'start_date', s.start_date,
      'end_date', s.end_date,
      'project_id', s.project_id,
      'created_at', s.created_at,
      'item_counts', COALESCE((
        SELECT jsonb_object_agg(status, cnt)
        FROM (
          SELECT i.status, COUNT(*) AS cnt
          FROM pm_backlog_items i
          WHERE i.sprint_id = s.id AND i.deleted_at IS NULL
          GROUP BY i.status
        ) sc
      ), '{}'::jsonb),
      'total_items', (SELECT COUNT(*) FROM pm_backlog_items WHERE sprint_id = s.id AND deleted_at IS NULL)
    ) AS sprint_row, s.created_at AS s_created
    FROM pm_sprints s
    WHERE s.deleted_at IS NULL
    ORDER BY s.created_at DESC
  ) sub;

  RETURN v_sprints;
END;
$$;
