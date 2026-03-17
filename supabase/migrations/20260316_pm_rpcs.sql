-- ============================================
-- PROJECT MANAGEMENT: RPCs (SECURITY DEFINER)
-- Migration: 20260316_pm_rpcs
-- Purpose: All SECURITY DEFINER RPCs for PM module — the ONLY way to mutate pm_* data
-- Sprint: SPRINT-135 / TASK-2193
-- ============================================

-- ============================================
-- 1. pm_list_items — Paginated, filterable list of backlog items
-- ============================================
CREATE OR REPLACE FUNCTION pm_list_items(
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_sprint_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_labels UUID[] DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_total_count INT;
  v_items JSONB;
  v_offset INT;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Count total matching items
  SELECT COUNT(*) INTO v_total_count
  FROM pm_backlog_items i
  WHERE i.deleted_at IS NULL
    AND (p_status IS NULL OR i.status = p_status)
    AND (p_priority IS NULL OR i.priority = p_priority)
    AND (p_type IS NULL OR i.type = p_type)
    AND (p_area IS NULL OR i.area = p_area)
    AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
    AND (p_project_id IS NULL OR i.project_id = p_project_id)
    AND (p_search IS NULL OR i.search_vector @@ plainto_tsquery('english', p_search))
    AND (p_labels IS NULL OR EXISTS (
      SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
    ))
    AND (p_parent_id IS NULL OR i.parent_id = p_parent_id);

  -- Get page of items
  SELECT COALESCE(jsonb_agg(item_row ORDER BY sort_order ASC, created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT to_jsonb(i.*) || jsonb_build_object(
      'labels', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color))
        FROM pm_item_labels il
        JOIN pm_labels l ON l.id = il.label_id
        WHERE il.item_id = i.id
      ), '[]'::jsonb),
      'child_count', (SELECT COUNT(*) FROM pm_backlog_items c WHERE c.parent_id = i.id AND c.deleted_at IS NULL)
    ) AS item_row, i.sort_order, i.created_at
    FROM pm_backlog_items i
    WHERE i.deleted_at IS NULL
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_priority IS NULL OR i.priority = p_priority)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_area IS NULL OR i.area = p_area)
      AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (p_search IS NULL OR i.search_vector @@ plainto_tsquery('english', p_search))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
    ORDER BY i.sort_order ASC, i.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total_count,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_items TO authenticated;

-- ============================================
-- 2. pm_get_item_detail — Full item with related data
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_item_detail(
  p_item_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item JSONB;
  v_comments JSONB;
  v_events JSONB;
  v_links JSONB;
  v_labels JSONB;
  v_children JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Get item
  SELECT to_jsonb(i.*) INTO v_item
  FROM pm_backlog_items i
  WHERE i.id = p_item_id AND i.deleted_at IS NULL;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  -- Get comments with author name/email from auth.users
  SELECT COALESCE(jsonb_agg(
    to_jsonb(c.*) || jsonb_build_object(
      'author_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      'author_email', u.email
    )
    ORDER BY c.created_at ASC
  ), '[]'::jsonb)
  INTO v_comments
  FROM pm_comments c
  LEFT JOIN auth.users u ON u.id = c.author_id
  WHERE c.item_id = p_item_id AND c.deleted_at IS NULL;

  -- Get events with actor name/email from auth.users
  SELECT COALESCE(jsonb_agg(
    to_jsonb(e.*) || jsonb_build_object(
      'actor_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      'actor_email', u.email
    )
    ORDER BY e.created_at ASC
  ), '[]'::jsonb)
  INTO v_events
  FROM pm_events e
  LEFT JOIN auth.users u ON u.id = e.actor_id
  WHERE e.item_id = p_item_id;

  -- Get links (bidirectional)
  SELECT COALESCE(jsonb_agg(link_row), '[]'::jsonb)
  INTO v_links
  FROM (
    SELECT jsonb_build_object(
      'link_id', tl.id,
      'link_type', tl.link_type,
      'direction', CASE WHEN tl.source_id = p_item_id THEN 'outgoing' ELSE 'incoming' END,
      'item_id', other.id,
      'item_title', other.title,
      'item_legacy_id', other.legacy_id,
      'item_status', other.status
    ) AS link_row
    FROM pm_task_links tl
    JOIN pm_backlog_items other ON other.id = CASE
      WHEN tl.source_id = p_item_id THEN tl.target_id
      ELSE tl.source_id
    END
    WHERE (tl.source_id = p_item_id OR tl.target_id = p_item_id)
      AND other.deleted_at IS NULL
  ) sub;

  -- Get labels
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color)), '[]'::jsonb)
  INTO v_labels
  FROM pm_item_labels il
  JOIN pm_labels l ON l.id = il.label_id
  WHERE il.item_id = p_item_id;

  -- Get children
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'legacy_id', c.legacy_id,
    'status', c.status, 'priority', c.priority, 'type', c.type
  ) ORDER BY c.sort_order ASC, c.created_at DESC), '[]'::jsonb)
  INTO v_children
  FROM pm_backlog_items c
  WHERE c.parent_id = p_item_id AND c.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'item', v_item,
    'comments', v_comments,
    'events', v_events,
    'links', v_links,
    'labels', v_labels,
    'children', v_children
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_item_detail TO authenticated;

-- ============================================
-- 3. pm_create_item — Create a new backlog item
-- ============================================
CREATE OR REPLACE FUNCTION pm_create_item(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'feature',
  p_area TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_parent_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_sprint_id UUID DEFAULT NULL,
  p_est_tokens INT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item_id UUID;
  v_item_number INT;
  v_legacy_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate type
  IF p_type NOT IN ('feature', 'bug', 'chore', 'spike', 'epic') THEN
    RAISE EXCEPTION 'Invalid type: %. Must be feature, bug, chore, spike, or epic', p_type;
  END IF;

  -- Validate priority
  IF p_priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid priority: %. Must be critical, high, medium, or low', p_priority;
  END IF;

  -- Insert the item
  INSERT INTO pm_backlog_items (
    title, description, type, area, priority,
    parent_id, project_id, sprint_id,
    est_tokens, start_date, due_date
  ) VALUES (
    p_title, p_description, p_type, p_area, p_priority,
    p_parent_id, p_project_id, p_sprint_id,
    p_est_tokens, p_start_date, p_due_date
  )
  RETURNING id, item_number INTO v_item_id, v_item_number;

  -- Generate legacy_id
  v_legacy_id := 'BACKLOG-' || v_item_number;
  UPDATE pm_backlog_items SET legacy_id = v_legacy_id WHERE id = v_item_id;

  -- Log creation event
  INSERT INTO pm_events (item_id, actor_id, event_type, new_value, metadata)
  VALUES (
    v_item_id,
    v_caller_id,
    'created',
    'pending',
    jsonb_build_object(
      'title', p_title,
      'type', p_type,
      'priority', p_priority
    )
  );

  RETURN jsonb_build_object(
    'id', v_item_id,
    'item_number', v_item_number,
    'legacy_id', v_legacy_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_create_item TO authenticated;

-- ============================================
-- 4. pm_update_item_status — Status transition with validation
-- ============================================
CREATE OR REPLACE FUNCTION pm_update_item_status(
  p_item_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_old_status TEXT;
  v_has_blockers BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate new status
  IF p_new_status NOT IN ('pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred', 'obsolete', 'reopened') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: pending, in_progress, testing, completed, blocked, deferred, obsolete, reopened', p_new_status;
  END IF;

  -- Get current status
  SELECT status INTO v_old_status
  FROM pm_backlog_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  -- No-op if same status
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status, 'changed', false);
  END IF;

  -- Check dependency constraints: if moving to in_progress, verify no uncompleted blockers
  IF p_new_status = 'in_progress' THEN
    SELECT EXISTS (
      SELECT 1
      FROM pm_task_links tl
      JOIN pm_backlog_items blocker ON blocker.id = tl.source_id
      WHERE tl.target_id = p_item_id
        AND tl.link_type = 'blocked_by'
        AND blocker.status != 'completed'
        AND blocker.deleted_at IS NULL
    ) INTO v_has_blockers;

    IF v_has_blockers THEN
      RAISE EXCEPTION 'Cannot move to in_progress: item has uncompleted blockers';
    END IF;
  END IF;

  -- Update the item
  UPDATE pm_backlog_items
  SET
    status = p_new_status,
    completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_item_id;

  -- Log event
  INSERT INTO pm_events (item_id, actor_id, event_type, old_value, new_value)
  VALUES (p_item_id, v_caller_id, 'status_changed', v_old_status, p_new_status);

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_item_status TO authenticated;

-- ============================================
-- 5. pm_update_item_field — Generic field update with whitelist
-- ============================================
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
  v_allowed_fields TEXT[] := ARRAY[
    'title', 'description', 'type', 'area', 'priority',
    'est_tokens', 'actual_tokens', 'sort_order',
    'start_date', 'due_date', 'project_id', 'sprint_id', 'parent_id'
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

-- ============================================
-- 6. pm_assign_item — Assign to user
-- ============================================
CREATE OR REPLACE FUNCTION pm_assign_item(
  p_item_id UUID,
  p_assignee_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_old_assignee UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT assignee_id INTO v_old_assignee
  FROM pm_backlog_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  UPDATE pm_backlog_items
  SET assignee_id = p_assignee_id
  WHERE id = p_item_id;

  -- Log assigned event
  INSERT INTO pm_events (item_id, actor_id, event_type, old_value, new_value)
  VALUES (p_item_id, v_caller_id, 'assigned', v_old_assignee::text, p_assignee_id::text);

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'assignee_id', p_assignee_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_assign_item TO authenticated;

-- ============================================
-- 7. pm_delete_item — Soft-delete
-- ============================================
CREATE OR REPLACE FUNCTION pm_delete_item(
  p_item_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_item_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  UPDATE pm_backlog_items
  SET deleted_at = now()
  WHERE id = p_item_id;

  -- Log deleted event
  INSERT INTO pm_events (item_id, actor_id, event_type)
  VALUES (p_item_id, v_caller_id, 'deleted');

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_delete_item TO authenticated;

-- ============================================
-- 8. pm_reorder_item — Move in hierarchy / reorder
-- ============================================
CREATE OR REPLACE FUNCTION pm_reorder_item(
  p_item_id UUID,
  p_new_parent_id UUID DEFAULT NULL,
  p_sort_order INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_item_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  UPDATE pm_backlog_items
  SET parent_id = p_new_parent_id,
      sort_order = p_sort_order
  WHERE id = p_item_id;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'parent_id', p_new_parent_id, 'sort_order', p_sort_order);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_reorder_item TO authenticated;

-- ============================================
-- 9. pm_add_comment — Add discussion comment
-- ============================================
CREATE OR REPLACE FUNCTION pm_add_comment(
  p_item_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_body TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_comment_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate exactly one parent is provided
  IF (p_item_id IS NULL AND p_task_id IS NULL) OR (p_item_id IS NOT NULL AND p_task_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of p_item_id or p_task_id must be provided';
  END IF;

  IF p_body IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'Comment body cannot be empty';
  END IF;

  -- Insert comment
  INSERT INTO pm_comments (item_id, task_id, author_id, body)
  VALUES (p_item_id, p_task_id, v_caller_id, p_body)
  RETURNING id INTO v_comment_id;

  -- Log event
  INSERT INTO pm_events (item_id, task_id, actor_id, event_type, metadata)
  VALUES (
    p_item_id,
    p_task_id,
    v_caller_id,
    'commented',
    jsonb_build_object('comment_id', v_comment_id)
  );

  RETURN jsonb_build_object('id', v_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_add_comment TO authenticated;

-- ============================================
-- 10. pm_add_dependency — Add task dependency with circular dep check
-- ============================================
CREATE OR REPLACE FUNCTION pm_add_dependency(
  p_source_id UUID,
  p_target_id UUID,
  p_type TEXT DEFAULT 'depends_on'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_dep_id UUID;
  v_is_circular BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF p_type NOT IN ('depends_on', 'blocks') THEN
    RAISE EXCEPTION 'Invalid dependency type: %. Must be depends_on or blocks', p_type;
  END IF;

  -- Check for circular dependencies using recursive CTE
  -- If source depends_on target, we need to check that target doesn't already
  -- (transitively) depend on source
  WITH RECURSIVE dep_chain AS (
    -- Base: all direct dependencies from the target
    SELECT target_id AS node_id
    FROM pm_dependencies
    WHERE source_id = p_target_id

    UNION

    -- Recursive: follow the dependency chain
    SELECT d.target_id
    FROM pm_dependencies d
    JOIN dep_chain dc ON d.source_id = dc.node_id
  )
  SELECT EXISTS (
    SELECT 1 FROM dep_chain WHERE node_id = p_source_id
  ) INTO v_is_circular;

  IF v_is_circular THEN
    RAISE EXCEPTION 'Circular dependency detected: adding this dependency would create a cycle';
  END IF;

  -- Insert the dependency
  INSERT INTO pm_dependencies (source_id, target_id, dependency_type)
  VALUES (p_source_id, p_target_id, p_type)
  RETURNING id INTO v_dep_id;

  RETURN jsonb_build_object('id', v_dep_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_add_dependency TO authenticated;

-- ============================================
-- 11. pm_remove_dependency
-- ============================================
CREATE OR REPLACE FUNCTION pm_remove_dependency(
  p_dependency_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  DELETE FROM pm_dependencies WHERE id = p_dependency_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_remove_dependency TO authenticated;

-- ============================================
-- 12. pm_create_label
-- ============================================
CREATE OR REPLACE FUNCTION pm_create_label(
  p_name TEXT,
  p_color TEXT DEFAULT '#6B7280',
  p_project_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_label_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  INSERT INTO pm_labels (name, color, project_id)
  VALUES (p_name, p_color, p_project_id)
  RETURNING id INTO v_label_id;

  RETURN jsonb_build_object('id', v_label_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_create_label TO authenticated;

-- ============================================
-- 13. pm_add_item_label
-- ============================================
CREATE OR REPLACE FUNCTION pm_add_item_label(
  p_item_id UUID,
  p_label_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  INSERT INTO pm_item_labels (item_id, label_id)
  VALUES (p_item_id, p_label_id)
  ON CONFLICT (item_id, label_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_add_item_label TO authenticated;

-- ============================================
-- 14. pm_remove_item_label
-- ============================================
CREATE OR REPLACE FUNCTION pm_remove_item_label(
  p_item_id UUID,
  p_label_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  DELETE FROM pm_item_labels
  WHERE item_id = p_item_id AND label_id = p_label_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_remove_item_label TO authenticated;

-- ============================================
-- 15. pm_list_labels
-- ============================================
CREATE OR REPLACE FUNCTION pm_list_labels(
  p_project_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_labels JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Return global labels + project-scoped labels if project_id given
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'color', l.color,
    'project_id', l.project_id,
    'created_at', l.created_at
  ) ORDER BY l.name ASC), '[]'::jsonb)
  INTO v_labels
  FROM pm_labels l
  WHERE l.project_id IS NULL
     OR l.project_id = p_project_id;

  RETURN v_labels;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_labels TO authenticated;

-- ============================================
-- 16. pm_link_items — Create item relationship
-- ============================================
CREATE OR REPLACE FUNCTION pm_link_items(
  p_source_id UUID,
  p_target_id UUID,
  p_link_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_link_id UUID;
  v_reverse_type TEXT;
  v_source_legacy TEXT;
  v_target_legacy TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF p_link_type NOT IN ('blocked_by', 'blocks', 'related_to', 'parent_child', 'duplicates') THEN
    RAISE EXCEPTION 'Invalid link type: %', p_link_type;
  END IF;

  -- Get legacy IDs for event logging
  SELECT legacy_id INTO v_source_legacy FROM pm_backlog_items WHERE id = p_source_id;
  SELECT legacy_id INTO v_target_legacy FROM pm_backlog_items WHERE id = p_target_id;

  -- Insert the link
  INSERT INTO pm_task_links (source_id, target_id, link_type)
  VALUES (p_source_id, p_target_id, p_link_type)
  RETURNING id INTO v_link_id;

  -- For blocks/blocked_by, create bidirectional reverse link
  v_reverse_type := CASE
    WHEN p_link_type = 'blocks' THEN 'blocked_by'
    WHEN p_link_type = 'blocked_by' THEN 'blocks'
    ELSE NULL
  END;

  IF v_reverse_type IS NOT NULL THEN
    INSERT INTO pm_task_links (source_id, target_id, link_type)
    VALUES (p_target_id, p_source_id, v_reverse_type)
    ON CONFLICT (source_id, target_id, link_type) DO NOTHING;
  END IF;

  -- Log event on both items
  INSERT INTO pm_events (item_id, actor_id, event_type, new_value, metadata)
  VALUES (
    p_source_id, v_caller_id, 'linked',
    COALESCE(v_target_legacy, p_target_id::text),
    jsonb_build_object('link_type', p_link_type, 'target_id', p_target_id)
  );

  INSERT INTO pm_events (item_id, actor_id, event_type, new_value, metadata)
  VALUES (
    p_target_id, v_caller_id, 'linked',
    COALESCE(v_source_legacy, p_source_id::text),
    jsonb_build_object('link_type', p_link_type, 'source_id', p_source_id)
  );

  RETURN jsonb_build_object('link_id', v_link_id, 'linked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_link_items TO authenticated;

-- ============================================
-- 17. pm_unlink_items — Remove a link
-- ============================================
CREATE OR REPLACE FUNCTION pm_unlink_items(
  p_link_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_source_id UUID;
  v_target_id UUID;
  v_link_type TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Get link info before deleting
  SELECT source_id, target_id, link_type
  INTO v_source_id, v_target_id, v_link_type
  FROM pm_task_links WHERE id = p_link_id;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Link not found: %', p_link_id;
  END IF;

  -- Delete the link
  DELETE FROM pm_task_links WHERE id = p_link_id;

  -- Also delete reverse link if blocks/blocked_by
  IF v_link_type IN ('blocks', 'blocked_by') THEN
    DELETE FROM pm_task_links
    WHERE source_id = v_target_id
      AND target_id = v_source_id
      AND link_type = CASE WHEN v_link_type = 'blocks' THEN 'blocked_by' ELSE 'blocks' END;
  END IF;

  -- Log events
  INSERT INTO pm_events (item_id, actor_id, event_type, old_value)
  VALUES (v_source_id, v_caller_id, 'unlinked', v_target_id::text);

  INSERT INTO pm_events (item_id, actor_id, event_type, old_value)
  VALUES (v_target_id, v_caller_id, 'unlinked', v_source_id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_unlink_items TO authenticated;

-- ============================================
-- 18. pm_search_items_for_link — Autocomplete for linking
-- ============================================
CREATE OR REPLACE FUNCTION pm_search_items_for_link(
  p_query TEXT,
  p_exclude_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_results JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'legacy_id', i.legacy_id,
    'status', i.status,
    'type', i.type,
    'priority', i.priority
  )), '[]'::jsonb)
  INTO v_results
  FROM pm_backlog_items i
  WHERE i.deleted_at IS NULL
    AND (p_exclude_id IS NULL OR i.id != p_exclude_id)
    AND (
      i.search_vector @@ plainto_tsquery('english', p_query)
      OR i.title ILIKE '%' || p_query || '%'
      OR i.legacy_id ILIKE '%' || p_query || '%'
    )
  ORDER BY i.item_number DESC
  LIMIT 10;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_search_items_for_link TO authenticated;

-- ============================================
-- 19. pm_assign_to_sprint — Bulk assign items to sprint
-- ============================================
CREATE OR REPLACE FUNCTION pm_assign_to_sprint(
  p_item_ids UUID[],
  p_sprint_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item_id UUID;
  v_count INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Verify sprint exists
  IF NOT EXISTS (SELECT 1 FROM pm_sprints WHERE id = p_sprint_id) THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  -- Update all items
  UPDATE pm_backlog_items
  SET sprint_id = p_sprint_id
  WHERE id = ANY(p_item_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log events for each item
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    INSERT INTO pm_events (item_id, actor_id, event_type, new_value, metadata)
    VALUES (
      v_item_id,
      v_caller_id,
      'sprint_changed',
      p_sprint_id::text,
      jsonb_build_object('sprint_id', p_sprint_id)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_assign_to_sprint TO authenticated;

-- ============================================
-- 20. pm_remove_from_sprint — Remove items from sprint
-- ============================================
CREATE OR REPLACE FUNCTION pm_remove_from_sprint(
  p_item_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item_id UUID;
  v_count INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  UPDATE pm_backlog_items
  SET sprint_id = NULL
  WHERE id = ANY(p_item_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    INSERT INTO pm_events (item_id, actor_id, event_type, old_value)
    VALUES (v_item_id, v_caller_id, 'sprint_changed', 'removed');
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_remove_from_sprint TO authenticated;

-- ============================================
-- 21. pm_list_sprints — List all sprints with item counts
-- ============================================
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
    ORDER BY s.created_at DESC
  ) sub;

  RETURN v_sprints;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_sprints TO authenticated;

-- ============================================
-- 22. pm_get_sprint_detail — Sprint with all items and metrics
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_sprint_detail(
  p_sprint_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_sprint JSONB;
  v_items JSONB;
  v_tasks JSONB;
  v_metrics JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Get sprint
  SELECT to_jsonb(s.*) INTO v_sprint
  FROM pm_sprints s WHERE s.id = p_sprint_id;

  IF v_sprint IS NULL THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  -- Get items in this sprint
  SELECT COALESCE(jsonb_agg(to_jsonb(i.*) ORDER BY i.sort_order ASC, i.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM pm_backlog_items i
  WHERE i.sprint_id = p_sprint_id AND i.deleted_at IS NULL;

  -- Get tasks linked to items in this sprint
  SELECT COALESCE(jsonb_agg(to_jsonb(t.*) ORDER BY t.sort_order ASC), '[]'::jsonb)
  INTO v_tasks
  FROM pm_tasks t
  WHERE t.sprint_id = p_sprint_id AND t.deleted_at IS NULL;

  -- Compute metrics summary
  SELECT jsonb_build_object(
    'total_items', COUNT(*),
    'completed_items', COUNT(*) FILTER (WHERE status = 'completed'),
    'in_progress_items', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'total_est_tokens', COALESCE(SUM(est_tokens), 0),
    'total_actual_tokens', COALESCE(SUM(actual_tokens), 0)
  ) INTO v_metrics
  FROM pm_backlog_items
  WHERE sprint_id = p_sprint_id AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'sprint', v_sprint,
    'items', v_items,
    'tasks', v_tasks,
    'metrics', v_metrics
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_sprint_detail TO authenticated;

-- ============================================
-- 23. pm_create_sprint
-- ============================================
CREATE OR REPLACE FUNCTION pm_create_sprint(
  p_name TEXT,
  p_goal TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_sprint_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  INSERT INTO pm_sprints (name, goal, project_id, start_date, end_date)
  VALUES (p_name, p_goal, p_project_id, p_start_date, p_end_date)
  RETURNING id INTO v_sprint_id;

  RETURN jsonb_build_object('id', v_sprint_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_create_sprint TO authenticated;

-- ============================================
-- 24. pm_update_sprint_status
-- ============================================
CREATE OR REPLACE FUNCTION pm_update_sprint_status(
  p_sprint_id UUID,
  p_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_old_status TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF p_status NOT IN ('planned', 'active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid sprint status: %. Must be planned, active, completed, or cancelled', p_status;
  END IF;

  SELECT status INTO v_old_status FROM pm_sprints WHERE id = p_sprint_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  UPDATE pm_sprints
  SET status = p_status
  WHERE id = p_sprint_id;

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_sprint_status TO authenticated;

-- ============================================
-- 25. pm_get_sprint_velocity — Velocity data for charts
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_sprint_velocity(
  p_count INT DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_velocity JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(vel_row ORDER BY s_end DESC), '[]'::jsonb)
  INTO v_velocity
  FROM (
    SELECT jsonb_build_object(
      'sprint_id', s.id,
      'sprint_name', s.name,
      'legacy_id', s.legacy_id,
      'status', s.status,
      'end_date', s.end_date,
      'total_est_tokens', COALESCE(SUM(i.est_tokens), 0),
      'total_actual_tokens', COALESCE(SUM(i.actual_tokens), 0),
      'completed_items', COUNT(*) FILTER (WHERE i.status = 'completed'),
      'total_items', COUNT(i.id)
    ) AS vel_row, s.end_date AS s_end
    FROM pm_sprints s
    LEFT JOIN pm_backlog_items i ON i.sprint_id = s.id AND i.deleted_at IS NULL
    WHERE s.status IN ('completed', 'active')
    GROUP BY s.id, s.name, s.legacy_id, s.status, s.end_date
    ORDER BY s.end_date DESC NULLS LAST
    LIMIT p_count
  ) sub;

  RETURN v_velocity;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_sprint_velocity TO authenticated;

-- ============================================
-- 26. pm_list_projects
-- ============================================
CREATE OR REPLACE FUNCTION pm_list_projects()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_projects JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'status', p.status,
    'owner_id', p.owner_id,
    'sort_order', p.sort_order,
    'created_at', p.created_at,
    'item_count', (SELECT COUNT(*) FROM pm_backlog_items i WHERE i.project_id = p.id AND i.deleted_at IS NULL),
    'active_sprint_count', (SELECT COUNT(*) FROM pm_sprints s WHERE s.project_id = p.id AND s.status = 'active')
  ) ORDER BY p.sort_order ASC, p.name ASC), '[]'::jsonb)
  INTO v_projects
  FROM pm_projects p
  WHERE p.deleted_at IS NULL;

  RETURN v_projects;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_projects TO authenticated;

-- ============================================
-- 27. pm_create_project
-- ============================================
CREATE OR REPLACE FUNCTION pm_create_project(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_project_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  INSERT INTO pm_projects (name, description, owner_id)
  VALUES (p_name, p_description, v_caller_id)
  RETURNING id INTO v_project_id;

  RETURN jsonb_build_object('id', v_project_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_create_project TO authenticated;

-- ============================================
-- 28. pm_get_project_detail
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

  -- Get sprints for this project
  SELECT COALESCE(jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_sprints
  FROM pm_sprints s
  WHERE s.project_id = p_project_id;

  -- Get item counts by status
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

-- ============================================
-- 29. pm_get_board_tasks — Board view grouped by status
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

  -- Build columns grouped by status
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
    ), '[]'::jsonb)
  ) INTO v_columns;

  RETURN v_columns;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_board_tasks TO authenticated;

-- ============================================
-- 30. pm_get_stats — Aggregate counts for dashboard
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_by_status JSONB;
  v_by_priority JSONB;
  v_by_type JSONB;
  v_total INT;
  v_active_sprints INT;
  v_unassigned INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Total active items
  SELECT COUNT(*) INTO v_total
  FROM pm_backlog_items WHERE deleted_at IS NULL AND status NOT IN ('completed', 'obsolete');

  -- Unassigned
  SELECT COUNT(*) INTO v_unassigned
  FROM pm_backlog_items
  WHERE deleted_at IS NULL AND assignee_id IS NULL AND status NOT IN ('completed', 'obsolete', 'deferred');

  -- By status
  SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb) INTO v_by_status
  FROM (
    SELECT status, COUNT(*) AS cnt
    FROM pm_backlog_items WHERE deleted_at IS NULL
    GROUP BY status
  ) s;

  -- By priority
  SELECT COALESCE(jsonb_object_agg(priority, cnt), '{}'::jsonb) INTO v_by_priority
  FROM (
    SELECT priority, COUNT(*) AS cnt
    FROM pm_backlog_items WHERE deleted_at IS NULL AND status NOT IN ('completed', 'obsolete')
    GROUP BY priority
  ) p;

  -- By type
  SELECT COALESCE(jsonb_object_agg(type, cnt), '{}'::jsonb) INTO v_by_type
  FROM (
    SELECT type, COUNT(*) AS cnt
    FROM pm_backlog_items WHERE deleted_at IS NULL AND status NOT IN ('completed', 'obsolete')
    GROUP BY type
  ) t;

  -- Active sprints
  SELECT COUNT(*) INTO v_active_sprints
  FROM pm_sprints WHERE status = 'active';

  RETURN jsonb_build_object(
    'total_open', v_total,
    'unassigned', v_unassigned,
    'by_status', v_by_status,
    'by_priority', v_by_priority,
    'by_type', v_by_type,
    'active_sprints', v_active_sprints
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_stats TO authenticated;

-- ============================================
-- 31. pm_bulk_update — Bulk status/priority/sprint changes
-- ============================================
CREATE OR REPLACE FUNCTION pm_bulk_update(
  p_item_ids UUID[],
  p_updates JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item_id UUID;
  v_allowed_keys TEXT[] := ARRAY['status', 'priority', 'sprint_id', 'project_id', 'assignee_id'];
  v_key TEXT;
  v_value TEXT;
  v_old_value TEXT;
  v_count INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate all keys in p_updates
  FOR v_key IN SELECT jsonb_object_keys(p_updates)
  LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'Bulk update key not allowed: %. Allowed: %', v_key, array_to_string(v_allowed_keys, ', ');
    END IF;
  END LOOP;

  -- Apply updates to each item
  FOREACH v_item_id IN ARRAY p_item_ids
  LOOP
    -- Skip soft-deleted items
    IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = v_item_id AND deleted_at IS NULL) THEN
      CONTINUE;
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(p_updates)
    LOOP
      v_value := p_updates ->> v_key;

      -- Get old value
      EXECUTE format('SELECT %I::text FROM pm_backlog_items WHERE id = $1', v_key)
        INTO v_old_value
        USING v_item_id;

      -- Apply update
      IF v_key IN ('sprint_id', 'project_id', 'assignee_id') THEN
        IF v_value IS NULL OR v_value = 'null' THEN
          EXECUTE format('UPDATE pm_backlog_items SET %I = NULL WHERE id = $1', v_key)
            USING v_item_id;
        ELSE
          EXECUTE format('UPDATE pm_backlog_items SET %I = $1::uuid WHERE id = $2', v_key)
            USING v_value, v_item_id;
        END IF;
      ELSE
        EXECUTE format('UPDATE pm_backlog_items SET %I = $1 WHERE id = $2', v_key)
          USING v_value, v_item_id;
      END IF;

      -- Handle completed_at for status changes
      IF v_key = 'status' AND v_value = 'completed' THEN
        UPDATE pm_backlog_items SET completed_at = now() WHERE id = v_item_id;
      END IF;

      -- Log event
      INSERT INTO pm_events (item_id, actor_id, event_type, old_value, new_value, metadata)
      VALUES (
        v_item_id,
        v_caller_id,
        CASE
          WHEN v_key = 'status' THEN 'status_changed'
          WHEN v_key = 'assignee_id' THEN 'assigned'
          WHEN v_key = 'sprint_id' THEN 'sprint_changed'
          ELSE 'field_changed'
        END,
        v_old_value,
        v_value,
        jsonb_build_object('field', v_key, 'bulk', true)
      );
    END LOOP;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_bulk_update TO authenticated;

-- ============================================
-- 32. pm_save_view — Save filter configuration
-- ============================================
CREATE OR REPLACE FUNCTION pm_save_view(
  p_name TEXT,
  p_filters_json JSONB,
  p_is_shared BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_view_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  INSERT INTO pm_saved_views (name, user_id, filters, is_shared)
  VALUES (p_name, v_caller_id, p_filters_json, p_is_shared)
  RETURNING id INTO v_view_id;

  RETURN jsonb_build_object('id', v_view_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_save_view TO authenticated;

-- ============================================
-- 33. pm_list_saved_views — User's own + shared views
-- ============================================
CREATE OR REPLACE FUNCTION pm_list_saved_views()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_views JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'filters', v.filters,
    'is_shared', v.is_shared,
    'is_own', (v.user_id = v_caller_id),
    'created_at', v.created_at
  ) ORDER BY v.name ASC), '[]'::jsonb)
  INTO v_views
  FROM pm_saved_views v
  WHERE v.user_id = v_caller_id OR v.is_shared = true;

  RETURN v_views;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_saved_views TO authenticated;

-- ============================================
-- 34. pm_delete_saved_view — Only owner can delete
-- ============================================
CREATE OR REPLACE FUNCTION pm_delete_saved_view(
  p_view_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_owner_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT user_id INTO v_owner_id FROM pm_saved_views WHERE id = p_view_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Saved view not found: %', p_view_id;
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the view owner can delete it';
  END IF;

  DELETE FROM pm_saved_views WHERE id = p_view_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_delete_saved_view TO authenticated;

-- ============================================
-- 35. pm_get_my_notifications — Events where current user is assignee
-- ============================================
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
      'created_at', e.created_at,
      'item_id', e.item_id,
      'item_title', i.title,
      'item_legacy_id', i.legacy_id,
      'task_id', e.task_id
    ) AS notif_row, e.created_at AS e_created
    FROM pm_events e
    LEFT JOIN pm_backlog_items i ON i.id = e.item_id
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

-- ============================================
-- 36. pm_get_item_by_legacy_id — Agent helper
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_item_by_legacy_id(
  p_legacy_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_item_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT id INTO v_item_id
  FROM pm_backlog_items
  WHERE legacy_id = p_legacy_id AND deleted_at IS NULL;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Item not found with legacy_id: %', p_legacy_id;
  END IF;

  -- Delegate to pm_get_item_detail for consistency
  RETURN pm_get_item_detail(v_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_item_by_legacy_id TO authenticated;
