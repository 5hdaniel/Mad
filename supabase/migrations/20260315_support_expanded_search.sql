-- ============================================
-- SUPPORT TICKETING: Expanded Search Vectors + ts_headline Snippets
-- Migration: 20260315_support_expanded_search
-- Purpose: Expand full-text search to requester name/email and message bodies,
--          return ts_headline highlight snippets in search results
-- Sprint: SPRINT-132 / TASK-2182
-- ============================================

-- ============================================
-- 1. Expand ticket search_vector trigger
--    Add requester_name and requester_email to the tsvector
-- ============================================

-- Drop old trigger (column list is part of the trigger definition)
DROP TRIGGER IF EXISTS support_tickets_search_update ON support_tickets;

-- Replace the function to include requester fields
CREATE OR REPLACE FUNCTION support_tickets_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.requester_name, '') || ' ' ||
    coalesce(NEW.requester_email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with expanded column list
CREATE TRIGGER support_tickets_search
  BEFORE INSERT OR UPDATE OF subject, description, requester_name, requester_email
  ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION support_tickets_search_trigger();

-- ============================================
-- 2. Add search_vector to support_ticket_messages
-- ============================================

-- Add search_vector column
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_search
  ON support_ticket_messages USING GIN (search_vector);

-- Create trigger function
CREATE OR REPLACE FUNCTION support_messages_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER support_messages_search
  BEFORE INSERT OR UPDATE OF body
  ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION support_messages_search_trigger();

-- ============================================
-- 3. Replace support_list_tickets RPC
--    - Expand search to include message tsvectors
--    - Add ts_headline snippets for matched fields
--    - Security: filter internal_note for non-agents
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
    -- Full-text search (ticket fields + message bodies)
    AND (p_search IS NULL OR (
      t.search_vector @@ v_query
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
  SELECT COALESCE(jsonb_agg(ticket_data ORDER BY created_at DESC), '[]'::jsonb) INTO v_tickets
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

              -- Requester name highlight
              SELECT jsonb_build_object(
                'field', 'requester_name',
                'snippet', ts_headline('english', t.requester_name, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
              )
              WHERE to_tsvector('english', coalesce(t.requester_name, '')) @@ v_query

              UNION ALL

              -- Requester email highlight
              SELECT jsonb_build_object(
                'field', 'requester_email',
                'snippet', ts_headline('english', t.requester_email, v_query,
                  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
              )
              WHERE to_tsvector('english', coalesce(t.requester_email, '')) @@ v_query

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
      t.created_at
    FROM support_tickets t
    LEFT JOIN support_categories c ON c.id = t.category_id
    LEFT JOIN support_categories sc ON sc.id = t.subcategory_id
    WHERE
      (p_status IS NULL OR t.status = p_status)
      AND (p_priority IS NULL OR t.priority = p_priority)
      AND (p_category_id IS NULL OR t.category_id = p_category_id)
      AND (p_assignee_id IS NULL OR t.assignee_id = p_assignee_id)
      AND (p_search IS NULL OR (
        t.search_vector @@ v_query
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
-- 4. Backfill existing data
-- ============================================

-- Backfill ticket search vectors (now includes requester_name + requester_email)
UPDATE support_tickets SET search_vector = to_tsvector('english',
  coalesce(subject, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(requester_name, '') || ' ' ||
  coalesce(requester_email, '')
);

-- Backfill message search vectors
UPDATE support_ticket_messages SET search_vector = to_tsvector('english',
  coalesce(body, '')
);
