-- ============================================
-- SUPPORT TICKETING: Security Fixes
-- Migration: 20260313_support_security_fixes
-- Purpose: Add missing auth guards and revoke anon grants on sensitive RPCs
-- Issues: SR Engineer review blockers #2-#6
-- ============================================

-- ============================================
-- Fix #2: support_add_attachment - Add auth guard, revoke anon
-- The function was SECURITY DEFINER + granted to anon with no auth check.
-- Now requires caller to be either an agent (support.respond) or the ticket requester.
-- ============================================

-- Revoke anon access
REVOKE EXECUTE ON FUNCTION support_add_attachment FROM anon;

-- Recreate with auth guard
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
  v_is_agent boolean;
  v_is_requester boolean;
BEGIN
  v_uploader_id := auth.uid();

  -- Auth guard: must be authenticated
  IF v_uploader_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to add attachments';
  END IF;

  -- Check if caller is an agent with support.respond permission
  v_is_agent := EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_uploader_id AND ap.key = 'support.respond'
  );

  -- Check if caller is the ticket requester
  v_is_requester := EXISTS (
    SELECT 1 FROM support_tickets
    WHERE id = p_ticket_id
    AND (requester_id = v_uploader_id OR requester_email = (SELECT email FROM auth.users WHERE id = v_uploader_id))
  );

  IF NOT v_is_agent AND NOT v_is_requester THEN
    RAISE EXCEPTION 'Access denied: you must be an agent or the ticket requester to add attachments';
  END IF;

  INSERT INTO support_ticket_attachments (
    ticket_id, message_id, file_name, file_size, file_type, storage_path, uploaded_by
  ) VALUES (
    p_ticket_id, p_message_id, p_file_name, p_file_size, p_file_type, p_storage_path, v_uploader_id
  )
  RETURNING id INTO v_attachment_id;

  RETURN jsonb_build_object('id', v_attachment_id, 'storage_path', p_storage_path);
END;
$$;

-- ============================================
-- Fix #3: support_list_attachments - Add auth guard, revoke anon
-- Was SECURITY DEFINER + granted to anon with no auth check.
-- Now requires authentication and checks ticket access.
-- ============================================

-- Revoke anon access
REVOKE EXECUTE ON FUNCTION support_list_attachments FROM anon;

-- Recreate with auth guard
CREATE OR REPLACE FUNCTION support_list_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_agent boolean;
  v_is_requester boolean;
BEGIN
  v_caller_id := auth.uid();

  -- Auth guard: must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to list attachments';
  END IF;

  -- Check if caller is an agent
  v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id);

  -- Check if caller is the ticket requester
  v_is_requester := EXISTS (
    SELECT 1 FROM support_tickets
    WHERE id = p_ticket_id
    AND (requester_id = v_caller_id OR requester_email = (SELECT email FROM auth.users WHERE id = v_caller_id))
  );

  IF NOT v_is_agent AND NOT v_is_requester THEN
    RAISE EXCEPTION 'Access denied: you can only view attachments for your own tickets';
  END IF;

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
    WHERE a.ticket_id = p_ticket_id
    AND (
      v_is_agent
      OR a.message_id IS NULL
      OR EXISTS (SELECT 1 FROM support_ticket_messages m WHERE m.id = a.message_id AND m.message_type != 'internal_note')
    )),
    '[]'::jsonb
  );
END;
$$;

-- ============================================
-- Fix #4: support_get_ticket_stats - Add agent guard
-- Was accessible to any authenticated user. Now requires support.view permission.
-- ============================================

CREATE OR REPLACE FUNCTION support_get_ticket_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_by_status JSONB;
  v_by_priority JSONB;
  v_total INT;
  v_unassigned INT;
BEGIN
  v_caller_id := auth.uid();

  -- Auth guard: must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Permission guard: must have support.view
  IF NOT EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_caller_id AND ap.key = 'support.view'
  ) THEN
    RAISE EXCEPTION 'Access denied: support.view permission required';
  END IF;

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

-- ============================================
-- Fix #5: support_list_tickets - Remove anonymous email-based listing
-- The anonymous path (lines 500-501 in original) allowed listing tickets by
-- p_requester_email without authentication. Remove that path entirely.
-- ============================================

-- Revoke anon access
REVOKE EXECUTE ON FUNCTION support_list_tickets FROM anon;

-- Recreate without anonymous email-based filtering
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
  -- Auth guard: must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to list tickets';
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id);

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

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
    -- Requester email filter (agents only)
    AND (p_requester_email IS NULL OR (v_is_agent AND t.requester_email = p_requester_email))
    -- Audience filter: agents see all, authenticated users see only their own
    AND (
      v_is_agent
      OR (t.requester_id = v_caller_id OR t.requester_email = v_caller_email)
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
      AND (p_requester_email IS NULL OR (v_is_agent AND t.requester_email = p_requester_email))
      AND (
        v_is_agent
        OR (t.requester_id = v_caller_id OR t.requester_email = v_caller_email)
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

-- ============================================
-- Fix #6: Response template mutation RPCs - Add permission checks
-- support_create_template, support_update_template, support_delete_template
-- were SECURITY DEFINER with no auth guards. Now require support.manage or support.admin.
-- ============================================

CREATE OR REPLACE FUNCTION support_create_template(
  p_name TEXT, p_body TEXT, p_category TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Auth guard
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Permission guard: must have support.manage or support.admin
  IF NOT EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_caller_id AND ap.key IN ('support.manage', 'support.admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: support.manage or support.admin permission required';
  END IF;

  INSERT INTO support_response_templates (name, body, category, created_by, updated_by)
  VALUES (p_name, p_body, p_category, v_caller_id, v_caller_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'name', p_name);
END;
$$;

CREATE OR REPLACE FUNCTION support_update_template(
  p_id UUID, p_name TEXT, p_body TEXT,
  p_category TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Auth guard
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Permission guard: must have support.manage or support.admin
  IF NOT EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_caller_id AND ap.key IN ('support.manage', 'support.admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: support.manage or support.admin permission required';
  END IF;

  UPDATE support_response_templates
  SET name = p_name, body = p_body, category = p_category,
      is_active = p_is_active, updated_by = v_caller_id, updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'updated', true);
END;
$$;

CREATE OR REPLACE FUNCTION support_delete_template(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Auth guard
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Permission guard: must have support.manage or support.admin
  IF NOT EXISTS (
    SELECT 1 FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = v_caller_id AND ap.key IN ('support.manage', 'support.admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: support.manage or support.admin permission required';
  END IF;

  DELETE FROM support_response_templates WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'deleted', true);
END;
$$;
