-- BACKLOG-1530: Add branch_name and pr_url fields to pm_backlog_items
-- These fields allow tracking the git branch and PR URL for each task.

ALTER TABLE pm_backlog_items ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE pm_backlog_items ADD COLUMN IF NOT EXISTS pr_url text;

-- Update pm_update_item_field to whitelist branch_name and pr_url
CREATE OR REPLACE FUNCTION pm_update_item_field(
  p_item_id UUID,
  p_field TEXT,
  p_value TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_old_value TEXT;
  v_is_circular BOOLEAN;
  v_allowed_fields TEXT[] := ARRAY[
    'title', 'description', 'type', 'area', 'priority',
    'est_tokens', 'actual_tokens', 'sort_order',
    'start_date', 'due_date', 'project_id', 'sprint_id', 'parent_id',
    'branch_name', 'pr_url'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate field is in whitelist
  IF NOT (p_field = ANY(v_allowed_fields)) THEN
    RAISE EXCEPTION 'Field not allowed: %. Allowed: %', p_field, array_to_string(v_allowed_fields, ', ');
  END IF;

  -- Verify item exists
  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_item_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  -- BACKLOG-1044: parent_id cycle detection
  IF p_field = 'parent_id' AND p_value IS NOT NULL THEN
    -- Self-reference check
    IF p_item_id = p_value::uuid THEN
      RAISE EXCEPTION 'An item cannot be its own parent';
    END IF;

    -- Circular hierarchy detection
    WITH RECURSIVE ancestors AS (
      SELECT parent_id AS ancestor_id
      FROM pm_backlog_items
      WHERE id = p_value::uuid AND deleted_at IS NULL

      UNION

      SELECT bi.parent_id
      FROM pm_backlog_items bi
      JOIN ancestors a ON bi.id = a.ancestor_id
      WHERE bi.parent_id IS NOT NULL AND bi.deleted_at IS NULL
    )
    SELECT EXISTS (
      SELECT 1 FROM ancestors WHERE ancestor_id = p_item_id
    ) INTO v_is_circular;

    IF v_is_circular THEN
      RAISE EXCEPTION 'Circular hierarchy detected: setting this parent would create a cycle';
    END IF;
  END IF;

  -- Get old value dynamically
  EXECUTE format('SELECT %I::text FROM pm_backlog_items WHERE id = $1', p_field)
    INTO v_old_value
    USING p_item_id;

  -- Update the field dynamically
  IF p_value IS NULL THEN
    EXECUTE format('UPDATE pm_backlog_items SET %I = NULL WHERE id = $1', p_field)
      USING p_item_id;
  ELSIF p_field IN ('est_tokens', 'actual_tokens', 'sort_order') THEN
    EXECUTE format('UPDATE pm_backlog_items SET %I = $1::int WHERE id = $2', p_field)
      USING p_value, p_item_id;
  ELSIF p_field IN ('start_date', 'due_date') THEN
    EXECUTE format('UPDATE pm_backlog_items SET %I = $1::date WHERE id = $2', p_field)
      USING p_value, p_item_id;
  ELSIF p_field IN ('project_id', 'sprint_id', 'parent_id') THEN
    EXECUTE format('UPDATE pm_backlog_items SET %I = $1::uuid WHERE id = $2', p_field)
      USING p_value, p_item_id;
  ELSE
    EXECUTE format('UPDATE pm_backlog_items SET %I = $1 WHERE id = $2', p_field)
      USING p_value, p_item_id;
  END IF;

  -- Log event
  INSERT INTO pm_events (item_id, actor_id, event_type, old_value, new_value, metadata)
  VALUES (
    p_item_id,
    v_caller_id,
    'field_changed',
    v_old_value,
    p_value,
    jsonb_build_object('field', p_field)
  );

  RETURN jsonb_build_object('success', true, 'field', p_field, 'old_value', v_old_value, 'new_value', p_value);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_item_field TO authenticated;
