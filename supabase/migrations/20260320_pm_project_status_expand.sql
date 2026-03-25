-- ============================================
-- PM Project Status Expansion
-- Migration: 20260320_pm_project_status_expand
-- Purpose: Add 'on_hold' and 'completed' to project status values,
--          and allow status updates via pm_update_project_field RPC
-- Sprint: SPRINT-K / TASK-2298
-- ============================================

-- ============================================
-- 1. Expand the pm_projects status CHECK constraint
-- ============================================
-- Current constraint only allows 'active' and 'archived'.
-- Add 'on_hold' and 'completed' as valid values.

ALTER TABLE pm_projects DROP CONSTRAINT pm_projects_status_check;
ALTER TABLE pm_projects ADD CONSTRAINT pm_projects_status_check
  CHECK (status IN ('active', 'on_hold', 'completed', 'archived'));

-- ============================================
-- 2. Update pm_update_project_field RPC to allow 'status' field
--    and add explicit status value validation
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
  v_allowed_fields TEXT[] := ARRAY['name', 'description', 'status'];
  v_allowed_statuses TEXT[] := ARRAY['active', 'on_hold', 'completed', 'archived'];
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

  -- Validate status values explicitly
  IF p_field = 'status' AND NOT (p_value = ANY(v_allowed_statuses)) THEN
    RAISE EXCEPTION 'Invalid status: %. Allowed: active, on_hold, completed, archived', p_value;
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
