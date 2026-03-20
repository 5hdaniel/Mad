-- ============================================
-- SUPPORT TICKETING: Ticket Number Search Fix
-- Migration: 20260320_support_ticket_number_search
-- Purpose: Add exact ticket_number matching to support_list_tickets RPC
--          so searching "24", "#24", or "TKT-0024" returns ticket #24 first
-- Sprint: SPRINT-K / TASK-2289
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
  v_query tsquery;
  v_ilike TEXT;
  v_ticket_num INT;
BEGIN
  -- Auth guard: must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to list tickets';
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  v_is_agent := EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id);

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  -- Pre-compute the tsquery once (NULL if no search)
  IF p_search IS NOT NULL THEN
    v_query := plainto_tsquery('english', p_search);
    v_ilike := '%' || p_search || '%';

    -- Parse ticket number from search input
    -- Matches: "24", "#24", "# 24", "TKT-0024", "TKT0024", "tkt-24"
    IF p_search ~ '^\s*#?\s*\d+\s*$' THEN
      v_ticket_num := (regexp_replace(p_search, '[^0-9]', '', 'g'))::INT;
    ELSIF p_search ~* '^\s*TKT-?0*(\d+)\s*$' THEN
      v_ticket_num := (regexp_replace(p_search, '[^0-9]', '', 'g'))::INT;
    END IF;
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
    -- Full-text search (ticket fields + message bodies + ticket_number)
    AND (p_search IS NULL OR (
      (v_ticket_num IS NOT NULL AND t.ticket_number = v_ticket_num)
      OR t.search_vector @@ v_query
      OR t.requester_name ILIKE v_ilike
      OR t.requester_email ILIKE v_ilike
      OR EXISTS (
        SELECT 1 FROM support_ticket_messages m
        WHERE m.ticket_id = t.id
        AND m.search_vector @@ v_query
        AND (v_is_agent OR m.message_type != 'internal_note')
      )
    ))
    -- Requester email filter (agents only)
    AND (p_requester_email IS NULL OR (v_is_agent AND t.requester_email = p_requester_email))
    -- Audience filter: agents see all, authenticated users see only their own
    AND (
      v_is_agent
      OR (t.requester_id = v_caller_id OR t.requester_email = v_caller_email)
    );

  -- Get page with optional search highlights
  -- Priority ordering: exact ticket_number match first, then created_at DESC
  SELECT COALESCE(jsonb_agg(ticket_data ORDER BY ticket_num_priority, created_at DESC), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      to_jsonb(t.*) || jsonb_build_object(
        'category_name', c.name,
        'subcategory_name', sc.name,
        'search_highlights', CASE
          WHEN p_search IS NULL THEN NULL
          ELSE (
            SELECT jsonb_agg(h) FILTER (WHERE h IS NOT NULL)
            FROM (
              -- Subject highlight
              SELECT jsonb_build_object(
                'field', 'subject',
                'snippet', ts_headline('english', t.subject, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
              ) AS h
              WHERE to_tsvector('english', coalesce(t.subject, '')) @@ v_query

              UNION ALL

              -- Description highlight
              SELECT jsonb_build_object(
                'field', 'description',
                'snippet', ts_headline('english', t.description, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
              )
              WHERE to_tsvector('english', coalesce(t.description, '')) @@ v_query

              UNION ALL

              -- Requester name highlight (tsvector match)
              SELECT jsonb_build_object(
                'field', 'requester_name',
                'snippet', ts_headline('english', t.requester_name, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
              )
              WHERE to_tsvector('english', coalesce(t.requester_name, '')) @@ v_query

              UNION ALL

              -- Requester name highlight (ILIKE fallback for partial matches)
              SELECT jsonb_build_object(
                'field', 'requester_name',
                'snippet', replace(t.requester_name, p_search,
                  '<mark>' || p_search || '</mark>')
              )
              WHERE t.requester_name ILIKE v_ilike
              AND NOT (to_tsvector('english', coalesce(t.requester_name, '')) @@ v_query)

              UNION ALL

              -- Requester email highlight (ILIKE — tsvector treats email as single token)
              SELECT jsonb_build_object(
                'field', 'requester_email',
                'snippet', replace(t.requester_email, p_search,
                  '<mark>' || p_search || '</mark>')
              )
              WHERE t.requester_email ILIKE v_ilike

              UNION ALL

              -- Message highlights (with security filter)
              SELECT jsonb_build_object(
                'field', 'message',
                'snippet', ts_headline('english', m.body, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1'),
                'sender_name', m.sender_name,
                'sent_at', m.created_at
              )
              FROM support_ticket_messages m
              WHERE m.ticket_id = t.id
              AND m.search_vector @@ v_query
              AND (v_is_agent OR m.message_type != 'internal_note')
            ) highlights
          )
        END
      ) AS ticket_data,
      t.created_at,
      CASE WHEN v_ticket_num IS NOT NULL AND t.ticket_number = v_ticket_num THEN 0 ELSE 1 END AS ticket_num_priority
    FROM support_tickets t
    LEFT JOIN support_categories c ON c.id = t.category_id
    LEFT JOIN support_categories sc ON sc.id = t.subcategory_id
    WHERE
      (p_status IS NULL OR t.status = p_status)
      AND (p_priority IS NULL OR t.priority = p_priority)
      AND (p_category_id IS NULL OR t.category_id = p_category_id)
      AND (p_assignee_id IS NULL OR t.assignee_id = p_assignee_id)
      AND (p_search IS NULL OR (
        (v_ticket_num IS NOT NULL AND t.ticket_number = v_ticket_num)
        OR t.search_vector @@ v_query
        OR EXISTS (
          SELECT 1 FROM support_ticket_messages m
          WHERE m.ticket_id = t.id
          AND m.search_vector @@ v_query
          AND (v_is_agent OR m.message_type != 'internal_note')
        )
      ))
      AND (p_requester_email IS NULL OR (v_is_agent AND t.requester_email = p_requester_email))
      AND (
        v_is_agent
        OR (t.requester_id = v_caller_id OR t.requester_email = v_caller_email)
      )
    ORDER BY
      CASE WHEN v_ticket_num IS NOT NULL AND t.ticket_number = v_ticket_num THEN 0 ELSE 1 END,
      t.created_at DESC
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
