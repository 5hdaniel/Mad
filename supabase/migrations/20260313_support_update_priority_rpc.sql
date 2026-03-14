-- ============================================
-- SUPPORT TICKETING: UPDATE PRIORITY RPC
-- Migration: 20260313_support_update_priority_rpc
-- Purpose: Allow agents to change ticket priority
-- Sprint: SPRINT-130 / BACKLOG-938
-- ============================================

CREATE OR REPLACE FUNCTION support_update_ticket_priority(
  p_ticket_id UUID,
  p_new_priority TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_priority TEXT;
  v_caller_id UUID := auth.uid();
BEGIN
  -- AUTH GUARD: Must be authenticated agent
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM internal_roles WHERE user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Only authenticated agents can update ticket priority';
  END IF;

  -- Validate priority value
  IF p_new_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %. Must be low, normal, high, or urgent', p_new_priority;
  END IF;

  -- Get current priority
  SELECT priority INTO v_old_priority
  FROM support_tickets
  WHERE id = p_ticket_id;

  IF v_old_priority IS NULL THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- No-op if same
  IF v_old_priority = p_new_priority THEN
    RETURN jsonb_build_object('id', p_ticket_id, 'priority', v_old_priority, 'changed', false);
  END IF;

  -- Update
  UPDATE support_tickets SET priority = p_new_priority WHERE id = p_ticket_id;

  -- Log event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (p_ticket_id, v_caller_id, 'priority_changed', v_old_priority, p_new_priority);

  RETURN jsonb_build_object('id', p_ticket_id, 'priority', p_new_priority, 'changed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION support_update_ticket_priority TO authenticated;
REVOKE EXECUTE ON FUNCTION support_update_ticket_priority(UUID, TEXT) FROM anon;
