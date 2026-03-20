-- ============================================
-- PM Inline Edit RPCs
-- Migration: 20260317_pm_inline_edit_rpcs
-- Purpose: Add update-field RPCs for projects and sprints
-- Sprint: SPRINT-142 / TASK-2228
-- ============================================

-- ============================================
-- 1. pm_update_project_field — Generic field update for projects
-- ============================================
CREATE OR REPLACE FUNCTION pm_update_project_field(
  p_project_id UUID,
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
  v_allowed_fields TEXT[] := ARRAY['name', 'description'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate field is in whitelist
  IF NOT (p_field = ANY(v_allowed_fields)) THEN
    RAISE EXCEPTION 'Field not allowed: %. Allowed: %', p_field, array_to_string(v_allowed_fields, ', ');
  END IF;

  -- Verify project exists
  IF NOT EXISTS (SELECT 1 FROM pm_projects WHERE id = p_project_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  -- Get old value
  EXECUTE format('SELECT %I::text FROM pm_projects WHERE id = $1', p_field)
    INTO v_old_value
    USING p_project_id;

  -- name cannot be null or empty
  IF p_field = 'name' AND (p_value IS NULL OR trim(p_value) = '') THEN
    RAISE EXCEPTION 'Project name cannot be empty';
  END IF;

  -- Update the field
  IF p_value IS NULL THEN
    EXECUTE format('UPDATE pm_projects SET %I = NULL, updated_at = now() WHERE id = $1', p_field)
      USING p_project_id;
  ELSE
    EXECUTE format('UPDATE pm_projects SET %I = $2, updated_at = now() WHERE id = $1', p_field)
      USING p_project_id, p_value;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'field', p_field,
    'old_value', v_old_value,
    'new_value', p_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_project_field TO authenticated;

-- ============================================
-- 2. pm_update_sprint_field — Generic field update for sprints
-- ============================================
CREATE OR REPLACE FUNCTION pm_update_sprint_field(
  p_sprint_id UUID,
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
  v_allowed_fields TEXT[] := ARRAY['name', 'goal'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- Validate field is in whitelist
  IF NOT (p_field = ANY(v_allowed_fields)) THEN
    RAISE EXCEPTION 'Field not allowed: %. Allowed: %', p_field, array_to_string(v_allowed_fields, ', ');
  END IF;

  -- Verify sprint exists
  IF NOT EXISTS (SELECT 1 FROM pm_sprints WHERE id = p_sprint_id) THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  -- Get old value
  EXECUTE format('SELECT %I::text FROM pm_sprints WHERE id = $1', p_field)
    INTO v_old_value
    USING p_sprint_id;

  -- name cannot be null or empty
  IF p_field = 'name' AND (p_value IS NULL OR trim(p_value) = '') THEN
    RAISE EXCEPTION 'Sprint name cannot be empty';
  END IF;

  -- Update the field
  IF p_value IS NULL THEN
    EXECUTE format('UPDATE pm_sprints SET %I = NULL, updated_at = now() WHERE id = $1', p_field)
      USING p_sprint_id;
  ELSE
    EXECUTE format('UPDATE pm_sprints SET %I = $2, updated_at = now() WHERE id = $1', p_field)
      USING p_sprint_id, p_value;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'field', p_field,
    'old_value', v_old_value,
    'new_value', p_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_update_sprint_field TO authenticated;
