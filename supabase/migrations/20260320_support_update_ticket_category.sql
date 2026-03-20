-- ============================================
-- SUPPORT TICKETING: UPDATE CATEGORY RPC
-- Migration: 20260320_support_update_ticket_category
-- Purpose: Allow agents to change ticket category
-- Sprint: SPRINT-K / TASK-2290
-- ============================================

CREATE OR REPLACE FUNCTION support_update_ticket_category(
  p_ticket_id UUID,
  p_category_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_category_id UUID;
  v_old_category_name TEXT;
  v_new_category_name TEXT;
  v_caller_id UUID := auth.uid();
BEGIN
  -- AUTH GUARD: Must be authenticated agent
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM internal_roles WHERE user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Only authenticated agents can update ticket category';
  END IF;

  -- Validate category exists (if not NULL / uncategorized)
  IF p_category_id IS NOT NULL THEN
    SELECT name INTO v_new_category_name
    FROM support_categories
    WHERE id = p_category_id AND is_active = true;

    IF v_new_category_name IS NULL THEN
      RAISE EXCEPTION 'Category not found or inactive: %', p_category_id;
    END IF;
  END IF;

  -- Get current category
  SELECT category_id INTO v_old_category_id
  FROM support_tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Resolve old category name for event log
  IF v_old_category_id IS NOT NULL THEN
    SELECT name INTO v_old_category_name
    FROM support_categories
    WHERE id = v_old_category_id;
  ELSE
    v_old_category_name := 'Uncategorized';
  END IF;

  -- Resolve new category name for event log
  IF p_category_id IS NULL THEN
    v_new_category_name := 'Uncategorized';
  END IF;

  -- No-op if same
  IF v_old_category_id IS NOT DISTINCT FROM p_category_id THEN
    RETURN jsonb_build_object(
      'id', p_ticket_id,
      'category_id', v_old_category_id,
      'changed', false
    );
  END IF;

  -- Update
  UPDATE support_tickets
  SET category_id = p_category_id
  WHERE id = p_ticket_id;

  -- Log event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (p_ticket_id, v_caller_id, 'category_changed', v_old_category_name, v_new_category_name);

  RETURN jsonb_build_object(
    'id', p_ticket_id,
    'category_id', p_category_id,
    'changed', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_update_ticket_category TO authenticated;
REVOKE EXECUTE ON FUNCTION support_update_ticket_category(UUID, UUID) FROM anon;
