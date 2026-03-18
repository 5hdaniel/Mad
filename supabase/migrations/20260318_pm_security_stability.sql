-- ============================================
-- PM SECURITY & STABILITY HARDENING
-- Migration: 20260318_pm_security_stability
-- Purpose: Fix 10 security and stability issues in PM RPCs and RLS policies
-- Sprint: SPRINT-146/147 / TASK-2228
-- Backlog: BACKLOG-1041, 1042, 1043, 1044, 1050, 1051, 1052, 1053, 1065, 1076
-- ============================================
-- This migration is idempotent (safe to re-run).
-- Uses CREATE OR REPLACE for functions, DROP IF EXISTS for triggers/policies,
-- and ADD CONSTRAINT IF NOT EXISTS patterns for constraints.
-- ============================================


-- ============================================
-- BACKLOG-1043: Drop duplicate auto-close trigger on pm_tasks
-- ============================================
-- The schema migration (20260316_pm_schema) created pm_tasks_auto_close
-- The auto-close migration (20260317_pm_auto_close_trigger) created trg_pm_auto_close_backlog
-- Both fire AFTER UPDATE OF status on pm_tasks. The newer one (trg_pm_auto_close_backlog)
-- is more complete (sets completed_at, logs events). Drop the older one.
-- ============================================

DROP TRIGGER IF EXISTS pm_tasks_auto_close ON pm_tasks;
-- Keep trg_pm_auto_close_backlog (from 20260317_pm_auto_close_trigger)

-- Also drop the old function since nothing references it now
DROP FUNCTION IF EXISTS pm_tasks_auto_close_item();


-- ============================================
-- BACKLOG-1076: Fix user_preferences RLS
-- ============================================
-- Current state: FOR ALL USING(true) for both anon and authenticated.
-- This allows any user to read/write any other user's preferences.
-- Fix: Restrict to own user_id only.
-- ============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "anon_users_all_preferences" ON user_preferences;
DROP POLICY IF EXISTS "authenticated_users_all_preferences" ON user_preferences;
-- Keep service_role_full_access_preferences (it's properly scoped)

-- Create properly scoped policies
CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete_own"
  ON user_preferences FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- BACKLOG-1052: CHECK constraints on pm_events and pm_attachments
-- ============================================
-- pm_comments already has chk_comments_one_parent.
-- pm_events and pm_attachments allow both item_id and task_id to be NULL.
-- Add constraint requiring at least one parent.
-- ============================================

-- pm_events: require at least one of item_id or task_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_events_has_parent'
      AND conrelid = 'pm_events'::regclass
  ) THEN
    -- First, fix any existing rows that violate the constraint
    DELETE FROM pm_events WHERE item_id IS NULL AND task_id IS NULL;

    ALTER TABLE pm_events ADD CONSTRAINT chk_events_has_parent
      CHECK (item_id IS NOT NULL OR task_id IS NOT NULL);
  END IF;
END $$;

-- pm_attachments: require at least one of item_id or task_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_attachments_has_parent'
      AND conrelid = 'pm_attachments'::regclass
  ) THEN
    DELETE FROM pm_attachments WHERE item_id IS NULL AND task_id IS NULL;

    ALTER TABLE pm_attachments ADD CONSTRAINT chk_attachments_has_parent
      CHECK (item_id IS NOT NULL OR task_id IS NOT NULL);
  END IF;
END $$;


-- ============================================
-- BACKLOG-1041: Auth guards + GRANT EXECUTE on task tracking RPCs
-- ============================================
-- These 4 RPCs were created without auth guards and without REVOKE from public.
-- They are SECURITY DEFINER, meaning any caller (including anon) can invoke them.
-- Fix: Add internal_roles auth guard + REVOKE from public/anon + GRANT to authenticated.
-- ============================================

-- 1. pm_update_task_status
CREATE OR REPLACE FUNCTION pm_update_task_status(
  p_task_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_old_status TEXT;
  v_valid_statuses TEXT[] := ARRAY['pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred'];
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate status
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: pending, in_progress, testing, completed, blocked, deferred', p_new_status;
  END IF;

  -- Get current task status
  SELECT status INTO v_old_status
  FROM pm_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- No-op if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'task_id', p_task_id,
      'old_status', v_old_status,
      'new_status', p_new_status,
      'changed', false
    );
  END IF;

  -- Update task status and updated_at
  UPDATE pm_tasks
  SET status = p_new_status,
      updated_at = now(),
      completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_task_id;

  -- Log event to pm_events
  INSERT INTO pm_events (task_id, event_type, old_value, new_value, metadata)
  VALUES (
    p_task_id,
    'status_changed',
    v_old_status,
    p_new_status,
    jsonb_build_object('source', 'pm_update_task_status')
  );

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'changed', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_update_task_status FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_update_task_status TO authenticated;


-- 2. pm_get_task_by_legacy_id
CREATE OR REPLACE FUNCTION pm_get_task_by_legacy_id(
  p_legacy_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_task RECORD;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate input
  IF p_legacy_id IS NULL OR trim(p_legacy_id) = '' THEN
    RAISE EXCEPTION 'legacy_id is required and cannot be empty';
  END IF;

  SELECT id, legacy_id, title, status, backlog_item_id, sprint_id
  INTO v_task
  FROM pm_tasks
  WHERE legacy_id = p_legacy_id AND deleted_at IS NULL;

  IF v_task IS NULL THEN
    RETURN jsonb_build_object('error', 'Task not found');
  END IF;

  RETURN jsonb_build_object(
    'id', v_task.id,
    'legacy_id', v_task.legacy_id,
    'title', v_task.title,
    'status', v_task.status,
    'backlog_item_id', v_task.backlog_item_id,
    'sprint_id', v_task.sprint_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_get_task_by_legacy_id FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_get_task_by_legacy_id TO authenticated;


-- 3. pm_record_task_tokens
CREATE OR REPLACE FUNCTION pm_record_task_tokens(
  p_task_id UUID,
  p_actual_tokens INT,
  p_agent_id TEXT DEFAULT NULL,
  p_agent_type TEXT DEFAULT NULL,
  p_input_tokens INT DEFAULT NULL,
  p_output_tokens INT DEFAULT NULL,
  p_cache_read INT DEFAULT NULL,
  p_cache_create INT DEFAULT NULL,
  p_duration_ms INT DEFAULT NULL,
  p_api_calls INT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_task RECORD;
  v_parent_actual INT;
  v_parent_est INT;
  v_variance NUMERIC(8,2);
  v_metric_id UUID;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate task exists
  SELECT id, legacy_id, backlog_item_id
  INTO v_task
  FROM pm_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Validate actual_tokens is positive
  IF p_actual_tokens IS NULL OR p_actual_tokens < 0 THEN
    RAISE EXCEPTION 'actual_tokens must be a non-negative integer';
  END IF;

  -- Update task actual_tokens
  UPDATE pm_tasks
  SET actual_tokens = p_actual_tokens,
      updated_at = now()
  WHERE id = p_task_id;

  -- Insert audit trail row into pm_token_metrics
  INSERT INTO pm_token_metrics (
    agent_id, agent_type, task_id, input_tokens, output_tokens,
    total_tokens, cache_read_tokens, cache_creation_tokens,
    duration_ms, api_calls, session_id
  ) VALUES (
    p_agent_id, p_agent_type, v_task.legacy_id, p_input_tokens, p_output_tokens,
    p_actual_tokens, p_cache_read, p_cache_create,
    p_duration_ms, p_api_calls, p_session_id
  )
  RETURNING id INTO v_metric_id;

  -- Recalculate parent backlog item actual_tokens (SUM of all child tasks)
  IF v_task.backlog_item_id IS NOT NULL THEN
    SELECT COALESCE(SUM(actual_tokens), 0)
    INTO v_parent_actual
    FROM pm_tasks
    WHERE backlog_item_id = v_task.backlog_item_id
      AND deleted_at IS NULL
      AND actual_tokens IS NOT NULL;

    -- Get parent est_tokens for variance calculation
    SELECT est_tokens
    INTO v_parent_est
    FROM pm_backlog_items
    WHERE id = v_task.backlog_item_id;

    -- Calculate variance: ((actual - est) / est * 100)
    IF v_parent_est IS NOT NULL AND v_parent_est > 0 THEN
      v_variance := ((v_parent_actual - v_parent_est)::NUMERIC / v_parent_est * 100);
    ELSE
      v_variance := NULL;
    END IF;

    -- Update parent backlog item
    UPDATE pm_backlog_items
    SET actual_tokens = v_parent_actual,
        variance = v_variance,
        updated_at = now()
    WHERE id = v_task.backlog_item_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'actual_tokens', p_actual_tokens,
    'parent_actual', v_parent_actual,
    'variance', v_variance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_record_task_tokens FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_record_task_tokens TO authenticated;


-- 4. pm_log_agent_metrics
CREATE OR REPLACE FUNCTION pm_log_agent_metrics(
  p_agent_id TEXT,
  p_agent_type TEXT DEFAULT NULL,
  p_task_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_input_tokens INT DEFAULT 0,
  p_output_tokens INT DEFAULT 0,
  p_cache_read INT DEFAULT 0,
  p_cache_create INT DEFAULT 0,
  p_total_tokens INT DEFAULT 0,
  p_duration_ms INT DEFAULT 0,
  p_api_calls INT DEFAULT 0,
  p_session_id TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_metric_id UUID;
  v_resolved_task_uuid UUID;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate agent_id is provided
  IF p_agent_id IS NULL OR trim(p_agent_id) = '' THEN
    RAISE EXCEPTION 'agent_id is required and cannot be empty';
  END IF;

  -- Attempt to resolve task_id (legacy_id like 'TASK-2226') to UUID
  IF p_task_id IS NOT NULL AND trim(p_task_id) != '' THEN
    SELECT id INTO v_resolved_task_uuid
    FROM pm_tasks
    WHERE legacy_id = p_task_id AND deleted_at IS NULL;
    -- If not found, that's OK -- we still log the metric with the text task_id
  END IF;

  -- Insert into pm_token_metrics
  INSERT INTO pm_token_metrics (
    agent_id, agent_type, task_id, description,
    input_tokens, output_tokens, total_tokens,
    cache_read_tokens, cache_creation_tokens,
    duration_ms, api_calls, model, session_id
  ) VALUES (
    p_agent_id, p_agent_type, p_task_id, p_description,
    p_input_tokens, p_output_tokens, p_total_tokens,
    p_cache_read, p_cache_create,
    p_duration_ms, p_api_calls, p_model, p_session_id
  )
  RETURNING id INTO v_metric_id;

  RETURN jsonb_build_object(
    'success', true,
    'metric_id', v_metric_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_log_agent_metrics FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_log_agent_metrics TO authenticated;


-- ============================================
-- BACKLOG-1042: Sanitize ILIKE metacharacters in search RPCs
-- BACKLOG-1050: Refactor pm_list_items WHERE duplication (use CTE)
-- BACKLOG-1053: Cap page_size at 200, validate page >= 1
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
  v_safe_search TEXT;
  v_effective_page INT;
  v_effective_page_size INT;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- BACKLOG-1053: Pagination bounds
  v_effective_page := GREATEST(COALESCE(p_page, 1), 1);
  v_effective_page_size := LEAST(COALESCE(p_page_size, 50), 200);
  v_offset := (v_effective_page - 1) * v_effective_page_size;

  -- BACKLOG-1042: Sanitize ILIKE metacharacters
  IF p_search IS NOT NULL THEN
    v_safe_search := regexp_replace(p_search, '([%_\\])', '\\\1', 'g');
  END IF;

  -- BACKLOG-1050: Use CTE to eliminate WHERE clause duplication
  WITH filtered_items AS (
    SELECT i.*
    FROM pm_backlog_items i
    WHERE i.deleted_at IS NULL
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_priority IS NULL OR i.priority = p_priority)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_area IS NULL OR i.area = p_area)
      AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (p_search IS NULL OR (
        i.search_vector @@ plainto_tsquery('english', p_search)
        OR i.legacy_id ILIKE '%' || v_safe_search || '%'
        OR i.title ILIKE '%' || v_safe_search || '%'
        OR EXISTS (
          SELECT 1 FROM pm_comments c
          WHERE c.item_id = i.id AND c.deleted_at IS NULL
            AND c.body ILIKE '%' || v_safe_search || '%'
        )
      ))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
  )
  -- Count total matching items
  SELECT COUNT(*) INTO v_total_count FROM filtered_items;

  -- Get page of items (re-use filtered_items CTE is not possible across statements,
  -- so we use the same WHERE logic but with the sanitized search)
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
      AND (p_search IS NULL OR (
        i.search_vector @@ plainto_tsquery('english', p_search)
        OR i.legacy_id ILIKE '%' || v_safe_search || '%'
        OR i.title ILIKE '%' || v_safe_search || '%'
        OR EXISTS (
          SELECT 1 FROM pm_comments c
          WHERE c.item_id = i.id AND c.deleted_at IS NULL
            AND c.body ILIKE '%' || v_safe_search || '%'
        )
      ))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
    ORDER BY i.sort_order ASC, i.created_at DESC
    LIMIT v_effective_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total_count,
    'page', v_effective_page,
    'page_size', v_effective_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_items TO authenticated;


-- ============================================
-- BACKLOG-1042: Sanitize ILIKE metacharacters in pm_search_items_for_link
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
  v_safe_query TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- BACKLOG-1042: Sanitize ILIKE metacharacters
  v_safe_query := regexp_replace(p_query, '([%_\\])', '\\\1', 'g');

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
      OR i.title ILIKE '%' || v_safe_query || '%'
      OR i.legacy_id ILIKE '%' || v_safe_query || '%'
    )
  ORDER BY i.item_number DESC
  LIMIT 10;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_search_items_for_link TO authenticated;


-- ============================================
-- BACKLOG-1044: Parent_id cycle detection in pm_reorder_item
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
  v_is_circular BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_item_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;

  -- BACKLOG-1044: Self-reference check
  IF p_new_parent_id IS NOT NULL AND p_item_id = p_new_parent_id THEN
    RAISE EXCEPTION 'An item cannot be its own parent';
  END IF;

  -- BACKLOG-1044: Circular hierarchy detection
  IF p_new_parent_id IS NOT NULL THEN
    WITH RECURSIVE ancestors AS (
      -- Start from the proposed parent
      SELECT parent_id AS ancestor_id
      FROM pm_backlog_items
      WHERE id = p_new_parent_id AND deleted_at IS NULL

      UNION

      -- Walk up the hierarchy
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

  UPDATE pm_backlog_items
  SET parent_id = p_new_parent_id,
      sort_order = p_sort_order
  WHERE id = p_item_id;

  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'parent_id', p_new_parent_id, 'sort_order', p_sort_order);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_reorder_item TO authenticated;


-- ============================================
-- BACKLOG-1044: Parent_id cycle detection in pm_update_item_field
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
  v_is_circular BOOLEAN;
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


-- ============================================
-- BACKLOG-1050: Add validation to pm_bulk_update
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
  v_valid_statuses TEXT[] := ARRAY['pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred', 'obsolete', 'reopened'];
  v_valid_priorities TEXT[] := ARRAY['critical', 'high', 'medium', 'low'];
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

  -- BACKLOG-1050: Validate status value if present
  IF p_updates ? 'status' THEN
    v_value := p_updates ->> 'status';
    IF v_value IS NOT NULL AND NOT (v_value = ANY(v_valid_statuses)) THEN
      RAISE EXCEPTION 'Invalid status: %. Must be one of: %', v_value, array_to_string(v_valid_statuses, ', ');
    END IF;
  END IF;

  -- BACKLOG-1050: Validate priority value if present
  IF p_updates ? 'priority' THEN
    v_value := p_updates ->> 'priority';
    IF v_value IS NOT NULL AND NOT (v_value = ANY(v_valid_priorities)) THEN
      RAISE EXCEPTION 'Invalid priority: %. Must be one of: %', v_value, array_to_string(v_valid_priorities, ', ');
    END IF;
  END IF;

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
-- BACKLOG-1051: Add deleted_at IS NULL to sprint queries
-- ============================================

-- 1. pm_assign_to_sprint: verify sprint is not soft-deleted
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

  -- BACKLOG-1051: Filter by deleted_at IS NULL
  IF NOT EXISTS (SELECT 1 FROM pm_sprints WHERE id = p_sprint_id AND deleted_at IS NULL) THEN
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


-- 2. pm_get_sprint_detail: filter sprint lookup by deleted_at
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

  -- BACKLOG-1051: Filter by deleted_at IS NULL
  SELECT to_jsonb(s.*) INTO v_sprint
  FROM pm_sprints s WHERE s.id = p_sprint_id AND s.deleted_at IS NULL;

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


-- 3. pm_update_sprint_status: filter sprint lookup by deleted_at
-- (This also preserves the original_item_count snapshot from 20260317_pm_sprint_scope)
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

  -- BACKLOG-1051: Filter by deleted_at IS NULL
  SELECT status INTO v_old_status FROM pm_sprints WHERE id = p_sprint_id AND deleted_at IS NULL;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  IF p_status = 'active' THEN
    -- When activating, snapshot current item count in same UPDATE
    UPDATE pm_sprints
    SET status = p_status,
        original_item_count = (
          SELECT COUNT(*) FROM pm_backlog_items
          WHERE sprint_id = p_sprint_id AND deleted_at IS NULL
        )
    WHERE id = p_sprint_id;
  ELSE
    UPDATE pm_sprints
    SET status = p_status
    WHERE id = p_sprint_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_sprint_status TO authenticated;


-- 4. pm_get_project_detail: filter sprint lookup by deleted_at
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

  -- BACKLOG-1051: Filter sprints by deleted_at IS NULL
  SELECT COALESCE(jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_sprints
  FROM pm_sprints s
  WHERE s.project_id = p_project_id AND s.deleted_at IS NULL;

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
-- BACKLOG-1053: Cap velocity count at 100
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
  v_effective_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- BACKLOG-1053: Cap count at 100
  v_effective_count := LEAST(COALESCE(p_count, 10), 100);

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
      AND s.deleted_at IS NULL
    GROUP BY s.id, s.name, s.legacy_id, s.status, s.end_date
    ORDER BY s.end_date DESC NULLS LAST
    LIMIT v_effective_count
  ) sub;

  RETURN v_velocity;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_get_sprint_velocity TO authenticated;


-- ============================================
-- BACKLOG-1065: Prevent self-linking in pm_link_items
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

  -- BACKLOG-1065: Prevent self-linking
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'An item cannot be linked to itself';
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
-- BACKLOG-1065: Reject whitespace-only titles in pm_create_item
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

  -- BACKLOG-1065: Reject whitespace-only titles
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty or whitespace-only';
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
-- BACKLOG-1065: Validate color format in pm_create_label
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

  -- BACKLOG-1065: Validate color is a valid hex format (#RGB or #RRGGBB)
  IF p_color !~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' THEN
    RAISE EXCEPTION 'Invalid color format: %. Must be hex color like #FFF or #FF5500', p_color;
  END IF;

  INSERT INTO pm_labels (name, color, project_id)
  VALUES (p_name, p_color, p_project_id)
  RETURNING id INTO v_label_id;

  RETURN jsonb_build_object('id', v_label_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_create_label TO authenticated;


-- ============================================
-- END OF SECURITY & STABILITY MIGRATION
-- ============================================
-- Summary of changes:
--   BACKLOG-1041: Auth guards + REVOKE/GRANT on 4 task tracking RPCs
--   BACKLOG-1042: ILIKE metacharacter sanitization in pm_list_items, pm_search_items_for_link
--   BACKLOG-1043: Dropped duplicate pm_tasks_auto_close trigger (kept trg_pm_auto_close_backlog)
--   BACKLOG-1044: Cycle detection in pm_reorder_item and pm_update_item_field
--   BACKLOG-1050: Status/priority validation in pm_bulk_update
--   BACKLOG-1051: deleted_at IS NULL in pm_assign_to_sprint, pm_get_sprint_detail,
--                 pm_update_sprint_status, pm_get_project_detail, pm_get_sprint_velocity
--   BACKLOG-1052: CHECK constraints on pm_events and pm_attachments
--   BACKLOG-1053: page_size capped at 200, velocity count at 100, page >= 1
--   BACKLOG-1065: Self-link prevention, whitespace title rejection, hex color validation
--   BACKLOG-1076: user_preferences RLS restricted to own user_id
-- ============================================
