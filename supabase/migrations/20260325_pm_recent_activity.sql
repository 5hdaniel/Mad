-- ============================================
-- pm_get_recent_activity — All recent events across the project
-- ============================================
-- Returns a feed of recent events with optional filtering by event type.
-- Unlike pm_get_my_notifications which only returns events on assigned items,
-- this returns ALL events visible to the caller (any internal_roles member).

CREATE OR REPLACE FUNCTION pm_get_recent_activity(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_event_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 50
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_activity JSONB;
  v_effective_limit INT := LEAST(COALESCE(p_limit, 50), 100);
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
  ) sub;

  RETURN v_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_recent_activity TO authenticated;
