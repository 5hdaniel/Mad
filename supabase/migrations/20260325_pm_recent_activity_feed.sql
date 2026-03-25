-- ============================================
-- PM Recent Activity Feed RPCs (consolidated)
-- ============================================
-- 1. pm_get_recent_activity — all project events with actor name, comment body, pagination
-- 2. pm_get_my_notifications — events on assigned items with actor name, comment body

-- Drop old signature (3 params) before creating new one (4 params)
DROP FUNCTION IF EXISTS pm_get_recent_activity(TIMESTAMPTZ, TEXT[], INT);

-- 1. pm_get_recent_activity — comment body + offset pagination
CREATE OR REPLACE FUNCTION pm_get_recent_activity(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_event_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_activity JSONB;
  v_effective_limit INT := LEAST(COALESCE(p_limit, 50), 100);
  v_effective_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(activity_row ORDER BY e_created DESC), '[]'::jsonb)
  INTO v_activity
  FROM (
    SELECT jsonb_build_object(
      'event_id', e.id,
      'event_type', e.event_type,
      'old_value', e.old_value,
      'new_value', e.new_value,
      'metadata', e.metadata,
      'actor_id', e.actor_id,
      'actor_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      'comment_body', CASE
        WHEN e.event_type = 'commented' AND e.metadata->>'comment_id' IS NOT NULL
        THEN (SELECT LEFT(c.body, 200) FROM pm_comments c WHERE c.id = (e.metadata->>'comment_id')::uuid AND c.deleted_at IS NULL)
        ELSE NULL
      END,
      'created_at', e.created_at,
      'item_id', e.item_id,
      'item_title', i.title,
      'item_legacy_id', i.legacy_id,
      'task_id', e.task_id
    ) AS activity_row, e.created_at AS e_created
    FROM pm_events e
    LEFT JOIN pm_backlog_items i ON i.id = e.item_id
    LEFT JOIN auth.users u ON u.id = e.actor_id
    WHERE i.deleted_at IS NULL
      AND (p_since IS NULL OR e.created_at > p_since)
      AND (p_event_types IS NULL OR e.event_type = ANY(p_event_types))
    ORDER BY e.created_at DESC
    LIMIT v_effective_limit
    OFFSET v_effective_offset
  ) sub;

  RETURN v_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_recent_activity TO authenticated;


-- 2. pm_get_my_notifications — same comment body addition
CREATE OR REPLACE FUNCTION pm_get_my_notifications(
  p_since TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_notifications JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(notif_row ORDER BY e_created DESC), '[]'::jsonb)
  INTO v_notifications
  FROM (
    SELECT jsonb_build_object(
      'event_id', e.id,
      'event_type', e.event_type,
      'old_value', e.old_value,
      'new_value', e.new_value,
      'metadata', e.metadata,
      'actor_id', e.actor_id,
      'actor_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      'comment_body', CASE
        WHEN e.event_type = 'commented' AND e.metadata->>'comment_id' IS NOT NULL
        THEN (SELECT LEFT(c.body, 200) FROM pm_comments c WHERE c.id = (e.metadata->>'comment_id')::uuid AND c.deleted_at IS NULL)
        ELSE NULL
      END,
      'created_at', e.created_at,
      'item_id', e.item_id,
      'item_title', i.title,
      'item_legacy_id', i.legacy_id,
      'task_id', e.task_id
    ) AS notif_row, e.created_at AS e_created
    FROM pm_events e
    LEFT JOIN pm_backlog_items i ON i.id = e.item_id
    LEFT JOIN auth.users u ON u.id = e.actor_id
    WHERE (
      EXISTS (
        SELECT 1 FROM pm_backlog_items bi
        WHERE bi.id = e.item_id AND bi.assignee_id = v_caller_id
      )
      OR
      EXISTS (
        SELECT 1 FROM pm_tasks t
        WHERE t.id = e.task_id AND t.assignee_id = v_caller_id
      )
    )
    AND e.actor_id != v_caller_id
    AND (p_since IS NULL OR e.created_at > p_since)
    ORDER BY e.created_at DESC
    LIMIT 50
  ) sub;

  RETURN v_notifications;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_my_notifications TO authenticated;
