-- Migration: Add explicit p_sprint_id (UUID) and p_backlog_item_id params to pm_log_agent_metrics
--
-- Context: BACKLOG-1644 — Agent session tracking
-- Previously, backlog_item_id was only resolved via task_id → pm_tasks FK, and
-- p_sprint_id was TEXT (unused by the hook since column is UUID).
-- This changes p_sprint_id to UUID and adds p_backlog_item_id UUID.
-- Explicit values override FK resolution when provided.

-- Drop the old signature (14 params with p_sprint_id TEXT)
DROP FUNCTION IF EXISTS pm_log_agent_metrics(TEXT, TEXT, TEXT, TEXT, INT, INT, INT, INT, INT, INT, INT, TEXT, TEXT, TEXT);

-- Recreate with p_sprint_id UUID and new p_backlog_item_id UUID
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
  p_model TEXT DEFAULT NULL,
  p_sprint_id UUID DEFAULT NULL,
  p_backlog_item_id UUID DEFAULT NULL
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
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF p_agent_id IS NULL OR trim(p_agent_id) = '' THEN
    RAISE EXCEPTION 'agent_id is required and cannot be empty';
  END IF;

  -- Resolve task_id to UUID and get parent references via FK
  IF p_task_id IS NOT NULL AND trim(p_task_id) != '' THEN
    SELECT t.id, t.backlog_item_id, t.sprint_id
    INTO v_resolved_task_uuid, v_backlog_item_id, v_sprint_id
    FROM pm_tasks t
    WHERE t.legacy_id = p_task_id AND t.deleted_at IS NULL;
  END IF;

  -- Explicit params override FK resolution when provided
  IF p_backlog_item_id IS NOT NULL THEN
    v_backlog_item_id := p_backlog_item_id;
  END IF;
  IF p_sprint_id IS NOT NULL THEN
    v_sprint_id := p_sprint_id;
  END IF;

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
