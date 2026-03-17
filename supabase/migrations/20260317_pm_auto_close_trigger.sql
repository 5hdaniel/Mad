-- ============================================
-- PM: Auto-close backlog item when all tasks completed
-- Migration: 20260317_pm_auto_close_trigger
-- Purpose: Trigger on pm_tasks that auto-completes the parent backlog item
--          when all sibling tasks are marked completed.
-- Sprint: SPRINT-140
-- ============================================

CREATE OR REPLACE FUNCTION pm_auto_close_backlog_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backlog_item_id UUID;
  v_total_tasks INT;
  v_completed_tasks INT;
BEGIN
  -- Only fire when task status changes to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get parent backlog item
  v_backlog_item_id := NEW.backlog_item_id;
  IF v_backlog_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total vs completed sibling tasks
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_tasks, v_completed_tasks
  FROM pm_tasks
  WHERE backlog_item_id = v_backlog_item_id
    AND deleted_at IS NULL;

  -- If all tasks completed, auto-complete the backlog item
  IF v_total_tasks > 0 AND v_total_tasks = v_completed_tasks THEN
    UPDATE pm_backlog_items
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_backlog_item_id
      AND status != 'completed'
      AND deleted_at IS NULL;

    -- Log the auto-close event
    INSERT INTO pm_events (task_id, event_type, old_value, new_value, metadata)
    VALUES (
      NEW.id,
      'status_changed',
      'auto',
      'completed',
      jsonb_build_object(
        'source', 'pm_auto_close_trigger',
        'backlog_item_id', v_backlog_item_id,
        'total_tasks', v_total_tasks
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_pm_auto_close_backlog ON pm_tasks;

CREATE TRIGGER trg_pm_auto_close_backlog
  AFTER UPDATE OF status ON pm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION pm_auto_close_backlog_item();
