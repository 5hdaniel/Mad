-- ============================================
-- PROJECT MANAGEMENT: Task Tracking RPCs
-- Migration: 20260317_pm_task_tracking_rpcs
-- Purpose: RPCs for task status updates, legacy ID lookup, token metrics recording
-- Sprint: SPRINT-139 / TASK-2226
-- ============================================

-- ============================================
-- 1. pm_update_task_status — Update task status with event logging
-- ============================================
CREATE OR REPLACE FUNCTION pm_update_task_status(
  p_task_id UUID,
  p_new_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_valid_statuses TEXT[] := ARRAY['pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred'];
BEGIN
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


-- ============================================
-- 2. pm_get_task_by_legacy_id — Look up task by legacy ID (e.g. 'TASK-2226')
-- ============================================
CREATE OR REPLACE FUNCTION pm_get_task_by_legacy_id(
  p_legacy_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
BEGIN
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


-- ============================================
-- 3. pm_record_task_tokens — Record token metrics for a task and update parent rollups
-- ============================================
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
  v_task RECORD;
  v_parent_actual INT;
  v_parent_est INT;
  v_variance NUMERIC(8,2);
  v_metric_id UUID;
BEGIN
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


-- ============================================
-- 4. pm_log_agent_metrics — Log agent token metrics (standalone, not tied to task update)
-- ============================================
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
  v_metric_id UUID;
  v_resolved_task_uuid UUID;
BEGIN
  -- Validate agent_id is provided
  IF p_agent_id IS NULL OR trim(p_agent_id) = '' THEN
    RAISE EXCEPTION 'agent_id is required and cannot be empty';
  END IF;

  -- Attempt to resolve task_id (legacy_id like 'TASK-2226') to UUID
  IF p_task_id IS NOT NULL AND trim(p_task_id) != '' THEN
    SELECT id INTO v_resolved_task_uuid
    FROM pm_tasks
    WHERE legacy_id = p_task_id AND deleted_at IS NULL;
    -- If not found, that's OK — we still log the metric with the text task_id
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
