-- ============================================
-- Update pm_get_my_notifications to include actor_name
-- ============================================
-- Adds LEFT JOIN auth.users to resolve actor names, matching the pattern
-- used in pm_get_recent_activity.

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
      -- Events on items assigned to me
      EXISTS (
        SELECT 1 FROM pm_backlog_items bi
        WHERE bi.id = e.item_id AND bi.assignee_id = v_caller_id
      )
      OR
      -- Events on tasks assigned to me
      EXISTS (
        SELECT 1 FROM pm_tasks t
        WHERE t.id = e.task_id AND t.assignee_id = v_caller_id
      )
    )
    AND e.actor_id != v_caller_id  -- Exclude own actions
    AND (p_since IS NULL OR e.created_at > p_since)
    ORDER BY e.created_at DESC
    LIMIT 50
  ) sub;

  RETURN v_notifications;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_my_notifications TO authenticated;
