-- ============================================
-- SUPPORT TICKETING: RPC AUTH GUARDS
-- Migration: 20260313_support_rpc_auth_guards
-- Purpose: Fix 3 RPCs missing auth guards + remove overly permissive anon upload policy
-- Sprint: SPRINT-130 / QA TEST-130-009
-- ============================================

-- ============================================
-- 1. support_update_ticket_status
-- SECURITY FIX: Require caller to be an authenticated agent
-- ============================================
CREATE OR REPLACE FUNCTION support_update_ticket_status(
  p_ticket_id UUID,
  p_new_status TEXT,
  p_pending_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_transition_allowed BOOLEAN;
  v_caller_id UUID := auth.uid();
BEGIN
  -- AUTH GUARD: Must be authenticated and exist in internal_roles
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM internal_roles WHERE user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Only authenticated agents can update ticket status';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status
  FROM support_tickets
  WHERE id = p_ticket_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Same status is a no-op
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('id', p_ticket_id, 'status', v_old_status, 'changed', false);
  END IF;

  -- Check allowed transitions
  v_transition_allowed := CASE
    WHEN v_old_status = 'new' AND p_new_status IN ('assigned', 'in_progress') THEN true
    WHEN v_old_status = 'assigned' AND p_new_status IN ('in_progress', 'pending') THEN true
    WHEN v_old_status = 'in_progress' AND p_new_status IN ('pending', 'resolved') THEN true
    WHEN v_old_status = 'pending' AND p_new_status = 'in_progress' THEN true
    WHEN v_old_status = 'resolved' AND p_new_status IN ('in_progress', 'closed') THEN true
    WHEN v_old_status = 'closed' AND p_new_status = 'in_progress' THEN true
    ELSE false
  END;

  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_old_status, p_new_status;
  END IF;

  -- For closed -> in_progress, require support.admin permission
  IF v_old_status = 'closed' AND p_new_status = 'in_progress' THEN
    IF NOT EXISTS (
      SELECT 1 FROM internal_roles ir
      JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
      JOIN admin_permissions ap ON ap.id = arp.permission_id
      WHERE ir.user_id = v_caller_id AND ap.key = 'support.admin'
    ) THEN
      RAISE EXCEPTION 'Only users with support.admin permission can reopen closed tickets';
    END IF;
  END IF;

  -- Validate pending_reason when transitioning to pending
  IF p_new_status = 'pending' THEN
    IF p_pending_reason IS NULL OR p_pending_reason NOT IN ('customer', 'vendor', 'internal') THEN
      RAISE EXCEPTION 'pending_reason is required when setting status to pending. Must be customer, vendor, or internal';
    END IF;
  END IF;

  -- Update the ticket
  UPDATE support_tickets
  SET
    status = p_new_status,
    pending_reason = CASE WHEN p_new_status = 'pending' THEN p_pending_reason ELSE NULL END,
    resolved_at = CASE WHEN p_new_status = 'resolved' THEN now() ELSE resolved_at END,
    closed_at = CASE WHEN p_new_status = 'closed' THEN now() ELSE closed_at END,
    reopened_count = CASE WHEN p_new_status = 'in_progress' AND v_old_status IN ('resolved', 'closed') THEN reopened_count + 1 ELSE reopened_count END
  WHERE id = p_ticket_id;

  -- Log event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value, metadata)
  VALUES (
    p_ticket_id,
    v_caller_id,
    'status_changed',
    v_old_status,
    p_new_status,
    CASE WHEN p_new_status = 'pending'
      THEN jsonb_build_object('pending_reason', p_pending_reason)
      ELSE NULL
    END
  );

  RETURN jsonb_build_object('id', p_ticket_id, 'status', p_new_status, 'changed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION support_update_ticket_status TO authenticated;
-- Revoke explicit anon grant (defense-in-depth; auth guard inside body is primary enforcement)
REVOKE EXECUTE ON FUNCTION support_update_ticket_status(UUID, TEXT, TEXT) FROM anon;

-- ============================================
-- 2. support_assign_ticket
-- SECURITY FIX: Require caller to be an authenticated agent
-- ============================================
CREATE OR REPLACE FUNCTION support_assign_ticket(
  p_ticket_id UUID,
  p_assignee_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_assignee UUID;
  v_old_status TEXT;
  v_caller_id UUID := auth.uid();
BEGIN
  -- AUTH GUARD: Must be authenticated and exist in internal_roles
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM internal_roles WHERE user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Only authenticated agents can assign tickets';
  END IF;

  SELECT assignee_id, status INTO v_old_assignee, v_old_status
  FROM support_tickets
  WHERE id = p_ticket_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Update assignment
  UPDATE support_tickets
  SET
    assignee_id = p_assignee_id,
    status = CASE WHEN v_old_status = 'new' THEN 'assigned' ELSE status END
  WHERE id = p_ticket_id;

  -- Log assignment event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value, metadata)
  VALUES (
    p_ticket_id,
    v_caller_id,
    'assigned',
    v_old_assignee::text,
    p_assignee_id::text,
    jsonb_build_object('auto_status_change', v_old_status = 'new')
  );

  -- If status changed from new to assigned, also log a status_changed event
  IF v_old_status = 'new' THEN
    INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
    VALUES (p_ticket_id, v_caller_id, 'status_changed', 'new', 'assigned');
  END IF;

  RETURN jsonb_build_object(
    'id', p_ticket_id,
    'assignee_id', p_assignee_id,
    'status', CASE WHEN v_old_status = 'new' THEN 'assigned' ELSE v_old_status END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_assign_ticket TO authenticated;
-- Revoke explicit anon grant (defense-in-depth; auth guard inside body is primary enforcement)
REVOKE EXECUTE ON FUNCTION support_assign_ticket(UUID, UUID) FROM anon;

-- ============================================
-- 3. support_get_ticket_detail
-- SECURITY FIX: Add p_requester_email param for anonymous callers
-- Drop old 1-param version first to avoid overload ambiguity, then recreate
-- with 2 params (p_ticket_id, p_requester_email DEFAULT NULL).
-- Anonymous callers: require p_requester_email matching ticket's requester_email
-- Internal notes remain hidden from all non-agent callers
-- ============================================
DROP FUNCTION IF EXISTS support_get_ticket_detail(UUID);

CREATE OR REPLACE FUNCTION support_get_ticket_detail(
  p_ticket_id UUID,
  p_requester_email TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket JSONB;
  v_messages JSONB;
  v_events JSONB;
  v_attachments JSONB;
  v_participants JSONB;
  v_is_agent BOOLEAN;
  v_caller_id UUID := auth.uid();
  v_ticket_exists BOOLEAN;
BEGIN
  -- Check if ticket exists
  SELECT EXISTS(SELECT 1 FROM support_tickets WHERE id = p_ticket_id)
  INTO v_ticket_exists;

  IF NOT v_ticket_exists THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Check access
  v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id);

  IF v_caller_id IS NULL THEN
    -- Anonymous caller: p_requester_email is required
    IF p_requester_email IS NULL THEN
      RAISE EXCEPTION 'requester_email is required to view ticket details without authentication';
    END IF;
    -- Email must match the ticket's requester_email
    IF NOT EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = p_ticket_id
      AND requester_email = p_requester_email
    ) THEN
      RAISE EXCEPTION 'Access denied: email does not match ticket requester';
    END IF;
  ELSIF NOT v_is_agent THEN
    -- Authenticated customer: check ownership
    IF NOT EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = p_ticket_id
      AND (requester_id = v_caller_id OR requester_email = (SELECT email FROM auth.users WHERE id = v_caller_id))
    ) THEN
      RAISE EXCEPTION 'Access denied: you can only view your own tickets';
    END IF;
  END IF;

  -- Get ticket
  SELECT to_jsonb(t.*) INTO v_ticket
  FROM support_tickets t WHERE t.id = p_ticket_id;

  -- Get messages (filter internal notes for non-agents)
  SELECT COALESCE(jsonb_agg(
    to_jsonb(m.*) ORDER BY m.created_at ASC
  ), '[]'::jsonb) INTO v_messages
  FROM support_ticket_messages m
  WHERE m.ticket_id = p_ticket_id
  AND (v_is_agent OR m.message_type != 'internal_note');

  -- Get events
  SELECT COALESCE(jsonb_agg(
    to_jsonb(e.*) ORDER BY e.created_at ASC
  ), '[]'::jsonb) INTO v_events
  FROM support_ticket_events e
  WHERE e.ticket_id = p_ticket_id;

  -- Get attachments (filter those on internal notes for non-agents)
  SELECT COALESCE(jsonb_agg(
    to_jsonb(a.*) ORDER BY a.created_at ASC
  ), '[]'::jsonb) INTO v_attachments
  FROM support_ticket_attachments a
  WHERE a.ticket_id = p_ticket_id
  AND (
    v_is_agent
    OR a.message_id IS NULL
    OR EXISTS (SELECT 1 FROM support_ticket_messages m WHERE m.id = a.message_id AND m.message_type != 'internal_note')
  );

  -- Get participants
  SELECT COALESCE(jsonb_agg(
    to_jsonb(p.*) ORDER BY p.created_at ASC
  ), '[]'::jsonb) INTO v_participants
  FROM support_ticket_participants p
  WHERE p.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'ticket', v_ticket,
    'messages', v_messages,
    'events', v_events,
    'attachments', v_attachments,
    'participants', v_participants
  );
END;
$$;

-- Grant to anon so anonymous callers can use the email-based path
GRANT EXECUTE ON FUNCTION support_get_ticket_detail TO anon;
GRANT EXECUTE ON FUNCTION support_get_ticket_detail TO authenticated;

-- ============================================
-- 4. Anonymous upload storage policy
-- SECURITY FIX: Remove the open anon upload policy
-- Anonymous users can submit tickets without attachments in Phase 1.
-- Attachment support for anonymous users will be added in a later phase
-- with proper ticket ownership verification.
-- ============================================
DROP POLICY IF EXISTS "Anon users can upload support attachments" ON storage.objects;
