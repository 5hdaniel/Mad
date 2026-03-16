-- Migration: support_close_ticket_by_requester RPC
-- Task: TASK-2188 - Customer-Side Ticket Closing
-- Allows customers to close their own support tickets from the broker portal.

CREATE OR REPLACE FUNCTION support_close_ticket_by_requester(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_email TEXT;
  v_ticket RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  SELECT id, status, requester_id, requester_email
  INTO v_ticket
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF v_ticket.requester_id != v_caller_id
     AND v_ticket.requester_email != v_caller_email THEN
    RAISE EXCEPTION 'You can only close your own tickets';
  END IF;

  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'Ticket is already closed';
  END IF;

  UPDATE support_tickets
  SET status = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (p_ticket_id, v_caller_id, 'status_changed', v_ticket.status, 'closed');

  RETURN jsonb_build_object('closed', true);
END;
$$;
