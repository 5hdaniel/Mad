-- Delete Ticket RPC
-- Hard-deletes a ticket and all related data (messages, attachments, events, participants).
-- Restricted to admin users only (checked via admin_role_permissions).

CREATE OR REPLACE FUNCTION support_delete_ticket(
  p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_has_admin BOOLEAN;
  v_ticket_number INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check caller has support.admin permission
  SELECT EXISTS (
    SELECT 1
    FROM admin_internal_users aiu
    JOIN admin_role_permissions arp ON arp.role_id = aiu.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE aiu.user_id = v_caller_id
      AND aiu.is_active = true
      AND ap.key = 'support.admin'
  ) INTO v_has_admin;

  IF NOT v_has_admin THEN
    RAISE EXCEPTION 'Insufficient permissions: support.admin required';
  END IF;

  -- Get ticket number for response
  SELECT ticket_number INTO v_ticket_number
  FROM support_tickets
  WHERE id = p_ticket_id;

  IF v_ticket_number IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Delete related data (order matters for FK constraints)
  DELETE FROM support_ticket_participants WHERE ticket_id = p_ticket_id;
  DELETE FROM support_ticket_events WHERE ticket_id = p_ticket_id;
  DELETE FROM support_ticket_attachments WHERE ticket_id = p_ticket_id;
  DELETE FROM support_ticket_messages WHERE ticket_id = p_ticket_id;
  DELETE FROM support_tickets WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'ticket_number', v_ticket_number
  );
END;
$$;
