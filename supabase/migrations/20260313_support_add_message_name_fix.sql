-- ============================================
-- FIX: support_add_message sender_name lookup
-- Problem: For authenticated agents, sender_name fell back to email
--          instead of looking up display_name from profiles table
-- Fix: Add profiles.display_name to the COALESCE chain
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
    v_sender_name := COALESCE(
      p_sender_name,
      (SELECT display_name FROM profiles WHERE id = auth.uid()),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()),
      v_sender_email
    );
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
