-- ============================================
-- PROJECT MANAGEMENT: Token Metrics V2 — Supabase-Primary Migration
-- Migration: 20260327_pm_token_metrics_v2
-- Purpose: Add FK columns, generated billable_tokens, idempotency constraint,
--          new pm_label_agent_metrics RPC, updated pm_log_agent_metrics and pm_record_task_tokens
-- Sprint: SPRINT-S / TASK-2316
-- ============================================


-- ============================================
-- 1. Schema Changes — Add columns to pm_token_metrics
-- ============================================

-- FK to resolved task UUID (populated when legacy task_id resolves)
ALTER TABLE pm_token_metrics
  ADD COLUMN IF NOT EXISTS task_uuid UUID REFERENCES pm_tasks(id) ON DELETE SET NULL;

-- FK to parent backlog item (for rollup queries without joining through pm_tasks)
ALTER TABLE pm_token_metrics
  ADD COLUMN IF NOT EXISTS backlog_item_id UUID REFERENCES pm_backlog_items(id) ON DELETE SET NULL;

-- FK to sprint (for sprint-level cost aggregation)
ALTER TABLE pm_token_metrics
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES pm_sprints(id) ON DELETE SET NULL;

-- Generated billable_tokens column: input + output + cache_create
-- Standardized formula — eliminates inconsistency between hook and Python scripts
ALTER TABLE pm_token_metrics
  ADD COLUMN IF NOT EXISTS billable_tokens INT GENERATED ALWAYS AS
    (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_tokens, 0))
  STORED;

-- Indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_pm_token_metrics_task_uuid ON pm_token_metrics(task_uuid);
CREATE INDEX IF NOT EXISTS idx_pm_token_metrics_backlog_item ON pm_token_metrics(backlog_item_id);
CREATE INDEX IF NOT EXISTS idx_pm_token_metrics_sprint ON pm_token_metrics(sprint_id);


-- ============================================
-- 2. Idempotency Constraint
-- ============================================

-- Deduplicate existing rows before adding constraint (keep most recent per pair)
DELETE FROM pm_token_metrics
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY agent_id, session_id
        ORDER BY recorded_at DESC
      ) as rn
    FROM pm_token_metrics
    WHERE agent_id IS NOT NULL AND session_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Prevents duplicate rows from hook replay. Same agent_id + session_id = same run.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_token_metrics_agent_session
  ON pm_token_metrics(agent_id, session_id)
  WHERE agent_id IS NOT NULL AND session_id IS NOT NULL;


-- ============================================
-- 3. New RPC: pm_label_agent_metrics
--    UPDATE-based replacement for Python log_metrics.py --label
-- ============================================

CREATE OR REPLACE FUNCTION pm_label_agent_metrics(
  p_agent_id TEXT,
  p_task_id TEXT DEFAULT NULL,
  p_agent_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric_id UUID;
  v_resolved_task_uuid UUID;
  v_backlog_item_id UUID;
  v_sprint_id UUID;
  v_rows_updated INT;
BEGIN
  -- Validate agent_id
  IF p_agent_id IS NULL OR trim(p_agent_id) = '' THEN
    RAISE EXCEPTION 'agent_id is required and cannot be empty';
  END IF;

  -- Resolve task_id to UUID and get parent references
  IF p_task_id IS NOT NULL AND trim(p_task_id) != '' THEN
    SELECT t.id, t.backlog_item_id, t.sprint_id
    INTO v_resolved_task_uuid, v_backlog_item_id, v_sprint_id
    FROM pm_tasks t
    WHERE t.legacy_id = p_task_id AND t.deleted_at IS NULL;
    -- Not found is OK — we still label with the text task_id
  END IF;

  -- Find the most recent unlabeled row for this agent_id and update it
  UPDATE pm_token_metrics
  SET
    task_id = COALESCE(p_task_id, task_id),
    task_uuid = COALESCE(v_resolved_task_uuid, task_uuid),
    backlog_item_id = COALESCE(v_backlog_item_id, backlog_item_id),
    sprint_id = COALESCE(v_sprint_id, sprint_id),
    agent_type = COALESCE(p_agent_type, agent_type),
    description = COALESCE(p_description, description)
  WHERE id = (
    SELECT id FROM pm_token_metrics
    WHERE agent_id = p_agent_id
      AND (task_id IS NULL OR trim(task_id) = '')
    ORDER BY recorded_at DESC
    LIMIT 1
  )
  RETURNING id INTO v_metric_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('No unlabeled metric row found for agent_id: %s', p_agent_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'metric_id', v_metric_id,
    'task_id', p_task_id,
    'agent_type', p_agent_type,
    'task_uuid', v_resolved_task_uuid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_label_agent_metrics FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_label_agent_metrics TO authenticated;


-- ============================================
-- 4. Updated RPC: pm_log_agent_metrics
--    Now populates task_uuid, backlog_item_id, sprint_id when task resolves
--    Also uses ON CONFLICT for idempotent inserts
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
  v_caller_id UUID := auth.uid();
  v_metric_id UUID;
  v_resolved_task_uuid UUID;
  v_backlog_item_id UUID;
  v_sprint_id UUID;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate agent_id is provided
  IF p_agent_id IS NULL OR trim(p_agent_id) = '' THEN
    RAISE EXCEPTION 'agent_id is required and cannot be empty';
  END IF;

  -- Resolve task_id (legacy_id like 'TASK-2226') to UUID and get parent references
  IF p_task_id IS NOT NULL AND trim(p_task_id) != '' THEN
    SELECT t.id, t.backlog_item_id, t.sprint_id
    INTO v_resolved_task_uuid, v_backlog_item_id, v_sprint_id
    FROM pm_tasks t
    WHERE t.legacy_id = p_task_id AND t.deleted_at IS NULL;
    -- If not found, that's OK — we still log the metric with the text task_id
  END IF;

  -- Insert into pm_token_metrics with idempotency (ON CONFLICT does nothing)
  INSERT INTO pm_token_metrics (
    agent_id, agent_type, task_id, task_uuid, backlog_item_id, sprint_id,
    description, input_tokens, output_tokens, total_tokens,
    cache_read_tokens, cache_creation_tokens,
    duration_ms, api_calls, model, session_id
  ) VALUES (
    p_agent_id, p_agent_type, p_task_id, v_resolved_task_uuid, v_backlog_item_id, v_sprint_id,
    p_description, p_input_tokens, p_output_tokens, p_total_tokens,
    p_cache_read, p_cache_create,
    p_duration_ms, p_api_calls, p_model, p_session_id
  )
  ON CONFLICT (agent_id, session_id) WHERE agent_id IS NOT NULL AND session_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_metric_id;

  -- If ON CONFLICT triggered, look up the existing row
  IF v_metric_id IS NULL THEN
    SELECT id INTO v_metric_id
    FROM pm_token_metrics
    WHERE agent_id = p_agent_id AND session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'metric_id', v_metric_id,
    'deduplicated', v_metric_id IS NOT NULL AND NOT FOUND
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_log_agent_metrics FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_log_agent_metrics TO authenticated;


-- ============================================
-- 5. Updated RPC: pm_record_task_tokens
--    Now auto-sums total_tokens from pm_token_metrics instead of requiring caller to pass it.
--    p_actual_tokens is now optional — if NULL, auto-computed from metric rows.
--    No longer inserts a duplicate audit row (hook-inserted rows are the audit trail).
-- ============================================

CREATE OR REPLACE FUNCTION pm_record_task_tokens(
  p_task_id UUID,
  p_actual_tokens INT DEFAULT NULL,
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
  v_computed_tokens INT;
  v_final_tokens INT;
  v_parent_actual INT;
  v_parent_est INT;
  v_variance NUMERIC(8,2);
  v_metric_id UUID;
  v_metric_count INT;
BEGIN
  -- Validate task exists
  SELECT id, legacy_id, backlog_item_id
  INTO v_task
  FROM pm_tasks
  WHERE id = p_task_id AND deleted_at IS NULL;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Auto-sum from pm_token_metrics if p_actual_tokens not provided
  IF p_actual_tokens IS NULL THEN
    SELECT COALESCE(SUM(total_tokens), 0), COUNT(*)
    INTO v_computed_tokens, v_metric_count
    FROM pm_token_metrics
    WHERE task_id = v_task.legacy_id;

    IF v_metric_count = 0 THEN
      RAISE EXCEPTION 'No metric rows found for task % — cannot auto-compute tokens. Ensure agents logged metrics before calling pm_record_task_tokens.', v_task.legacy_id;
    END IF;

    v_final_tokens := v_computed_tokens;
  ELSE
    v_final_tokens := p_actual_tokens;
  END IF;

  -- Validate tokens is non-negative
  IF v_final_tokens < 0 THEN
    RAISE EXCEPTION 'actual_tokens must be a non-negative integer';
  END IF;

  -- Update task actual_tokens
  UPDATE pm_tasks
  SET actual_tokens = v_final_tokens,
      updated_at = now()
  WHERE id = p_task_id;

  -- If explicit agent metrics were passed, insert an audit trail row
  IF p_agent_id IS NOT NULL THEN
    INSERT INTO pm_token_metrics (
      agent_id, agent_type, task_id, task_uuid, backlog_item_id, sprint_id,
      input_tokens, output_tokens, total_tokens,
      cache_read_tokens, cache_creation_tokens,
      duration_ms, api_calls, session_id
    ) VALUES (
      p_agent_id, p_agent_type, v_task.legacy_id, p_task_id, v_task.backlog_item_id,
      (SELECT sprint_id FROM pm_tasks WHERE id = p_task_id),
      p_input_tokens, p_output_tokens, v_final_tokens,
      p_cache_read, p_cache_create,
      p_duration_ms, p_api_calls, p_session_id
    )
    ON CONFLICT (agent_id, session_id) WHERE agent_id IS NOT NULL AND session_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_metric_id;
  END IF;

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
    'actual_tokens', v_final_tokens,
    'auto_computed', p_actual_tokens IS NULL,
    'metric_count', v_metric_count,
    'parent_actual', v_parent_actual,
    'variance', v_variance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION pm_record_task_tokens FROM public, anon;
GRANT EXECUTE ON FUNCTION pm_record_task_tokens TO authenticated;
