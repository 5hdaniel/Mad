-- ============================================
-- SUPPORT TICKETING: Delete Ticket RPC
-- Migration: 20260313_support_delete_ticket_rpc
-- Purpose: Soft-delete or hard-delete a support ticket (admin only)
-- Backlog: BACKLOG-940
-- ============================================

CREATE OR REPLACE FUNCTION support_delete_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ticket_number INT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Require support.admin permission
  IF NOT EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_caller_id AND ap.key = 'support.admin'
  ) THEN
    RAISE EXCEPTION 'Only users with support.admin permission can delete tickets';
  END IF;

  -- Get ticket number for response
  SELECT ticket_number INTO v_ticket_number
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_ticket_number IS NULL THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Hard delete (cascades to messages, events, attachments, participants via FK)
  DELETE FROM support_tickets WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'ticket_id', p_ticket_id,
    'ticket_number', v_ticket_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_delete_ticket TO authenticated;
