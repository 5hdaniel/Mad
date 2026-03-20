-- ============================================
-- SUPPORT TICKETING: Update support_create_ticket with new optional params
-- Migration: 20260315_support_create_ticket_v2
-- Purpose: Add p_requester_phone and p_preferred_contact optional params
-- Sprint: SPRINT-133 / TASK-2184
-- Note: Must DROP old signature first since adding params changes the signature.
--       New params have defaults so existing callers are backwards compatible.
-- ============================================

-- Drop old 10-param signature so we can replace with 12-param version
DROP FUNCTION IF EXISTS support_create_ticket(TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT);

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
  p_source_channel TEXT DEFAULT 'web_form',
  -- New optional params (TASK-2184)
  p_requester_phone TEXT DEFAULT NULL,
  p_preferred_contact TEXT DEFAULT 'email'
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

  -- Validate preferred_contact
  IF p_preferred_contact NOT IN ('email', 'phone', 'either') THEN
    RAISE EXCEPTION 'Invalid preferred_contact: %. Must be email, phone, or either', p_preferred_contact;
  END IF;

  -- Create the ticket (now including requester_phone and preferred_contact)
  INSERT INTO support_tickets (
    subject, description, priority, ticket_type,
    category_id, subcategory_id,
    requester_id, requester_email, requester_name,
    organization_id, source_channel,
    requester_phone, preferred_contact
  ) VALUES (
    p_subject, p_description, p_priority, p_ticket_type,
    p_category_id, p_subcategory_id,
    v_requester_id, v_requester_email, v_requester_name,
    p_organization_id, p_source_channel,
    p_requester_phone, p_preferred_contact
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

-- Grant to both anon and authenticated (same as original)
GRANT EXECUTE ON FUNCTION support_create_ticket TO anon;
GRANT EXECUTE ON FUNCTION support_create_ticket TO authenticated;
