-- RPCs for attachment and participant CRUD operations
-- Tables are read-only at RLS level, so all mutations go through SECURITY DEFINER RPCs

-- 1. Add attachment record (after file is uploaded to storage)
CREATE OR REPLACE FUNCTION support_add_attachment(
  p_ticket_id uuid,
  p_message_id uuid DEFAULT NULL,
  p_file_name text DEFAULT '',
  p_file_size bigint DEFAULT 0,
  p_file_type text DEFAULT '',
  p_storage_path text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachment_id uuid;
  v_uploader_id uuid;
BEGIN
  v_uploader_id := auth.uid();

  INSERT INTO support_ticket_attachments (
    ticket_id, message_id, file_name, file_size, file_type, storage_path, uploaded_by
  ) VALUES (
    p_ticket_id, p_message_id, p_file_name, p_file_size, p_file_type, p_storage_path, v_uploader_id
  )
  RETURNING id INTO v_attachment_id;

  RETURN jsonb_build_object('id', v_attachment_id, 'storage_path', p_storage_path);
END;
$$;

-- 2. List attachments for a ticket
CREATE OR REPLACE FUNCTION support_list_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'ticket_id', a.ticket_id,
        'message_id', a.message_id,
        'file_name', a.file_name,
        'file_size', a.file_size,
        'file_type', a.file_type,
        'storage_path', a.storage_path,
        'uploaded_by', a.uploaded_by,
        'created_at', a.created_at
      ) ORDER BY a.created_at
    )
    FROM support_ticket_attachments a
    WHERE a.ticket_id = p_ticket_id),
    '[]'::jsonb
  );
END;
$$;

-- 3. Add participant to a ticket
CREATE OR REPLACE FUNCTION support_add_participant(
  p_ticket_id uuid,
  p_email text,
  p_name text DEFAULT NULL,
  p_role text DEFAULT 'cc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_adder_id uuid;
  v_user_id uuid;
BEGIN
  v_adder_id := auth.uid();

  -- Check if caller is an agent
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_adder_id) THEN
    RAISE EXCEPTION 'Only agents can add participants';
  END IF;

  -- Check if participant already exists on this ticket
  IF EXISTS (
    SELECT 1 FROM support_ticket_participants
    WHERE ticket_id = p_ticket_id AND email = p_email
  ) THEN
    RAISE EXCEPTION 'Participant already exists on this ticket';
  END IF;

  -- Try to find user_id by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;

  INSERT INTO support_ticket_participants (
    ticket_id, user_id, email, name, role, added_by
  ) VALUES (
    p_ticket_id, v_user_id, p_email, p_name, p_role::text, v_adder_id
  )
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object('id', v_participant_id, 'email', p_email, 'role', p_role);
END;
$$;

-- 4. Remove participant from a ticket
CREATE OR REPLACE FUNCTION support_remove_participant(p_participant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();

  -- Check if caller is an agent
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Only agents can remove participants';
  END IF;

  DELETE FROM support_ticket_participants WHERE id = p_participant_id;

  RETURN jsonb_build_object('removed', true, 'id', p_participant_id);
END;
$$;

-- 5. List events for a ticket
CREATE OR REPLACE FUNCTION support_list_events(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'ticket_id', e.ticket_id,
        'actor_id', e.actor_id,
        'event_type', e.event_type,
        'old_value', e.old_value,
        'new_value', e.new_value,
        'metadata', e.metadata,
        'created_at', e.created_at
      ) ORDER BY e.created_at DESC
    )
    FROM support_ticket_events e
    WHERE e.ticket_id = p_ticket_id),
    '[]'::jsonb
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION support_add_attachment TO authenticated, anon;
GRANT EXECUTE ON FUNCTION support_list_attachments TO authenticated, anon;
GRANT EXECUTE ON FUNCTION support_add_participant TO authenticated;
GRANT EXECUTE ON FUNCTION support_remove_participant TO authenticated;
GRANT EXECUTE ON FUNCTION support_list_events TO authenticated;
