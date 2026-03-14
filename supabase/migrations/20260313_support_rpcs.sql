-- ============================================
-- SUPPORT TICKETING: RPCs
-- Migration: 20260313_support_rpcs
-- Purpose: 7 SECURITY DEFINER RPCs for all support ticket mutations and queries
-- Sprint: SPRINT-130 / TASK-2171
-- ============================================

-- ============================================
-- 1. support_create_ticket
-- Handles both authenticated and unauthenticated submissions
-- ============================================
CREATE OR REPLACE FUNCTION support_create_ticket(
  p_subject TEXT,
  p_description TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_category_id UUID DEFAULT NULL,
  p_subcategory_id UUID DEFAULT NULL,
  p_ticket_type TEXT DEFAULT NULL,
  p_requester_email TEXT DEFAULT NULL,
  p_requester_name TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_source_channel TEXT DEFAULT 'web_form'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_number INT;
  v_requester_id UUID;
  v_requester_email TEXT;
  v_requester_name TEXT;
BEGIN
  -- Determine requester identity
  IF auth.uid() IS NOT NULL THEN
    -- Authenticated user
    v_requester_id := auth.uid();
    -- Use provided email/name or look up from auth.users
    v_requester_email := COALESCE(p_requester_email, (SELECT email FROM auth.users WHERE id = auth.uid()));
    v_requester_name := COALESCE(p_requester_name, v_requester_email);
  ELSE
    -- Unauthenticated submission
    IF p_requester_email IS NULL THEN
      RAISE EXCEPTION 'requester_email is required for unauthenticated submissions';
    END IF;
    IF p_requester_name IS NULL THEN
      RAISE EXCEPTION 'requester_name is required for unauthenticated submissions';
    END IF;
    v_requester_id := NULL;
    v_requester_email := p_requester_email;
    v_requester_name := p_requester_name;
  END IF;

  -- Validate priority
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %. Must be low, normal, high, or urgent', p_priority;
  END IF;

  -- Validate source_channel
  IF p_source_channel NOT IN ('web_form', 'email', 'in_app_redirect', 'admin_created') THEN
    RAISE EXCEPTION 'Invalid source_channel: %', p_source_channel;
  END IF;

  -- Create the ticket
  INSERT INTO support_tickets (
    subject, description, priority, ticket_type,
    category_id, subcategory_id,
    requester_id, requester_email, requester_name,
    organization_id, source_channel
  ) VALUES (
    p_subject, p_description, p_priority, p_ticket_type,
    p_category_id, p_subcategory_id,
    v_requester_id, v_requester_email, v_requester_name,
    p_organization_id, p_source_channel
  )
  RETURNING id, ticket_number INTO v_ticket_id, v_ticket_number;

  -- Log the creation event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, new_value, metadata)
  VALUES (
    v_ticket_id,
    v_requester_id,
    'created',
    'new',
    jsonb_build_object(
      'subject', p_subject,
      'priority', p_priority,
      'source_channel', p_source_channel,
      'requester_email', v_requester_email
    )
  );

  RETURN jsonb_build_object(
    'id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'status', 'new',
    'requester_email', v_requester_email
  );
END;
$$;

-- Grant to both anon and authenticated
GRANT EXECUTE ON FUNCTION support_create_ticket TO anon;
GRANT EXECUTE ON FUNCTION support_create_ticket TO authenticated;

-- ============================================
-- 2. support_update_ticket_status
-- Enforces allowed state machine transitions
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

-- ============================================
-- 3. support_assign_ticket
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

-- ============================================
-- 4. support_add_message
-- Handles both authenticated and unauthenticated callers
-- ============================================
CREATE OR REPLACE FUNCTION support_add_message(
  p_ticket_id UUID,
  p_body TEXT,
  p_message_type TEXT DEFAULT 'reply',
  p_sender_email TEXT DEFAULT NULL,
  p_sender_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
  v_sender_id UUID;
  v_sender_email TEXT;
  v_sender_name TEXT;
  v_ticket_exists BOOLEAN;
  v_is_agent BOOLEAN;
  v_ticket_status TEXT;
BEGIN
  -- Verify ticket exists
  SELECT EXISTS(SELECT 1 FROM support_tickets WHERE id = p_ticket_id),
         (SELECT status FROM support_tickets WHERE id = p_ticket_id)
  INTO v_ticket_exists, v_ticket_status;

  IF NOT v_ticket_exists THEN
    RAISE EXCEPTION 'Ticket not found: %', p_ticket_id;
  END IF;

  -- Validate message_type
  IF p_message_type NOT IN ('reply', 'internal_note') THEN
    RAISE EXCEPTION 'Invalid message_type: %. Must be reply or internal_note', p_message_type;
  END IF;

  -- Determine sender identity
  IF auth.uid() IS NOT NULL THEN
    v_sender_id := auth.uid();
    v_sender_email := COALESCE(p_sender_email, (SELECT email FROM auth.users WHERE id = auth.uid()));
    v_sender_name := COALESCE(p_sender_name, v_sender_email);
    v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid());
  ELSE
    IF p_sender_email IS NULL THEN
      RAISE EXCEPTION 'sender_email is required for unauthenticated messages';
    END IF;
    v_sender_id := NULL;
    v_sender_email := p_sender_email;
    v_sender_name := COALESCE(p_sender_name, p_sender_email);
    v_is_agent := false;
  END IF;

  -- Only agents can add internal notes
  IF p_message_type = 'internal_note' AND NOT v_is_agent THEN
    RAISE EXCEPTION 'Only agents can add internal notes';
  END IF;

  -- Insert message
  INSERT INTO support_ticket_messages (ticket_id, sender_id, sender_email, sender_name, message_type, body)
  VALUES (p_ticket_id, v_sender_id, v_sender_email, v_sender_name, p_message_type, p_body)
  RETURNING id INTO v_message_id;

  -- Log event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, new_value, metadata)
  VALUES (
    p_ticket_id,
    v_sender_id,
    'message_added',
    p_message_type,
    jsonb_build_object('message_id', v_message_id, 'sender_email', v_sender_email)
  );

  -- Track first response (only for agent replies, not internal notes)
  IF v_is_agent AND p_message_type = 'reply' THEN
    UPDATE support_tickets
    SET first_response_at = COALESCE(first_response_at, now())
    WHERE id = p_ticket_id AND first_response_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_message_id,
    'ticket_id', p_ticket_id,
    'message_type', p_message_type,
    'sender_email', v_sender_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_add_message TO anon;
GRANT EXECUTE ON FUNCTION support_add_message TO authenticated;

-- ============================================
-- 5. support_get_ticket_detail
-- Returns ticket with messages, events, attachments, participants
-- ============================================
CREATE OR REPLACE FUNCTION support_get_ticket_detail(
  p_ticket_id UUID
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

  IF NOT v_is_agent AND v_caller_id IS NOT NULL THEN
    -- Customer: check ownership
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

  -- Get messages (filter internal notes for customers)
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

  -- Get attachments (filter those on internal notes for customers)
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

GRANT EXECUTE ON FUNCTION support_get_ticket_detail TO authenticated;

-- ============================================
-- 6. support_list_tickets
-- Paginated list with filters; dual-audience
-- ============================================
CREATE OR REPLACE FUNCTION support_list_tickets(
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_assignee_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_requester_email TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_agent BOOLEAN;
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT;
  v_total_count INT;
  v_tickets JSONB;
  v_offset INT;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id);

  IF v_caller_id IS NOT NULL THEN
    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
  END IF;

  -- Count total
  SELECT COUNT(*) INTO v_total_count
  FROM support_tickets t
  WHERE
    -- Status filter
    (p_status IS NULL OR t.status = p_status)
    -- Priority filter
    AND (p_priority IS NULL OR t.priority = p_priority)
    -- Category filter
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    -- Assignee filter
    AND (p_assignee_id IS NULL OR t.assignee_id = p_assignee_id)
    -- Full-text search
    AND (p_search IS NULL OR t.search_vector @@ plainto_tsquery('english', p_search))
    -- Requester email filter
    AND (p_requester_email IS NULL OR t.requester_email = p_requester_email)
    -- Audience filter
    AND (
      v_is_agent
      OR (v_caller_id IS NOT NULL AND (t.requester_id = v_caller_id OR t.requester_email = v_caller_email))
      OR (v_caller_id IS NULL AND p_requester_email IS NOT NULL AND t.requester_email = p_requester_email)
    );

  -- Get page
  SELECT COALESCE(jsonb_agg(ticket_row ORDER BY created_at DESC), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT to_jsonb(t.*) || jsonb_build_object(
      'category_name', c.name,
      'subcategory_name', sc.name
    ) AS ticket_row, t.created_at
    FROM support_tickets t
    LEFT JOIN support_categories c ON c.id = t.category_id
    LEFT JOIN support_categories sc ON sc.id = t.subcategory_id
    WHERE
      (p_status IS NULL OR t.status = p_status)
      AND (p_priority IS NULL OR t.priority = p_priority)
      AND (p_category_id IS NULL OR t.category_id = p_category_id)
      AND (p_assignee_id IS NULL OR t.assignee_id = p_assignee_id)
      AND (p_search IS NULL OR t.search_vector @@ plainto_tsquery('english', p_search))
      AND (p_requester_email IS NULL OR t.requester_email = p_requester_email)
      AND (
        v_is_agent
        OR (v_caller_id IS NOT NULL AND (t.requester_id = v_caller_id OR t.requester_email = v_caller_email))
        OR (v_caller_id IS NULL AND p_requester_email IS NOT NULL AND t.requester_email = p_requester_email)
      )
    ORDER BY t.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'tickets', v_tickets,
    'total_count', v_total_count,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total_count::numeric / p_page_size)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_list_tickets TO anon;
GRANT EXECUTE ON FUNCTION support_list_tickets TO authenticated;

-- ============================================
-- 7. support_get_ticket_stats
-- Dashboard counts by status and priority
-- ============================================
CREATE OR REPLACE FUNCTION support_get_ticket_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_by_status JSONB;
  v_by_priority JSONB;
  v_total INT;
  v_unassigned INT;
BEGIN
  -- Total count
  SELECT COUNT(*) INTO v_total FROM support_tickets WHERE status NOT IN ('closed');

  -- Unassigned count
  SELECT COUNT(*) INTO v_unassigned FROM support_tickets WHERE assignee_id IS NULL AND status NOT IN ('resolved', 'closed');

  -- By status
  SELECT COALESCE(jsonb_object_agg(status, cnt), '{}'::jsonb) INTO v_by_status
  FROM (
    SELECT status, COUNT(*) as cnt FROM support_tickets GROUP BY status
  ) s;

  -- By priority
  SELECT COALESCE(jsonb_object_agg(priority, cnt), '{}'::jsonb) INTO v_by_priority
  FROM (
    SELECT priority, COUNT(*) as cnt FROM support_tickets WHERE status NOT IN ('closed') GROUP BY priority
  ) p;

  RETURN jsonb_build_object(
    'total_open', v_total,
    'unassigned', v_unassigned,
    'by_status', v_by_status,
    'by_priority', v_by_priority
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_get_ticket_stats TO authenticated;
