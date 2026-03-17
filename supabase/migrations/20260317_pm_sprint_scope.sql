-- ============================================
-- PM Sprint Scope Change tracking
-- Migration: 20260317_pm_sprint_scope
-- Purpose: Add original_item_count column and update pm_update_sprint_status
--          to snapshot item count when a sprint is activated.
-- Sprint: SPRINT-140 / TASK-2233
-- ============================================

-- Step 1: Add column to track original item count at sprint activation
ALTER TABLE pm_sprints ADD COLUMN IF NOT EXISTS original_item_count INT;

-- Step 2: Redefine pm_update_sprint_status to snapshot item count on activation
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
