-- ============================================
-- PM Delete Project + Sprint Date Editing
-- Migration: 20260318_pm_delete_project_and_sprint_dates
-- Purpose: Add pm_delete_project RPC and extend pm_update_sprint_field
--          to allow start_date / end_date editing
-- ============================================

-- ============================================
-- 1. pm_delete_project — Soft-delete a project
-- ============================================
CREATE OR REPLACE FUNCTION pm_delete_project(
  p_project_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_project_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  UPDATE pm_projects
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_project_id AND deleted_at IS NULL
  RETURNING name INTO v_project_name;

  IF v_project_name IS NULL THEN
    RAISE EXCEPTION 'Project not found or already deleted';
  END IF;

  RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'name', v_project_name);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_delete_project TO authenticated;

-- ============================================
-- 2. Extend pm_update_sprint_field to allow start_date and end_date
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
  v_allowed_fields TEXT[] := ARRAY['name', 'goal', 'start_date', 'end_date'];
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

  -- For date fields, validate format if provided
  IF p_field IN ('start_date', 'end_date') AND p_value IS NOT NULL AND trim(p_value) != '' THEN
    BEGIN
      PERFORM p_value::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid date format for %: %', p_field, p_value;
    END;
  END IF;

  -- Update the field
  IF p_value IS NULL OR (p_field IN ('start_date', 'end_date') AND trim(p_value) = '') THEN
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
