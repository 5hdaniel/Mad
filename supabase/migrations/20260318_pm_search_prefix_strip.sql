-- BACKLOG-1180: Strip BACKLOG-/TASK-/BL-/# prefix from search for item_number matching
-- When user searches "BACKLOG-1050", extract 1050 and match against item_number

CREATE OR REPLACE FUNCTION public.pm_list_items(
  p_status text DEFAULT NULL::text,
  p_priority text DEFAULT NULL::text,
  p_type text DEFAULT NULL::text,
  p_area text DEFAULT NULL::text,
  p_sprint_id uuid DEFAULT NULL::uuid,
  p_project_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_labels uuid[] DEFAULT NULL::uuid[],
  p_parent_id uuid DEFAULT NULL::uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_assignee_id uuid DEFAULT NULL::uuid,
  p_root_only boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_total_count INT;
  v_items JSONB;
  v_offset INT;
  v_safe_search TEXT;
  v_effective_page INT;
  v_effective_page_size INT;
  v_extracted_number INT;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- BACKLOG-1053: Pagination bounds
  v_effective_page := GREATEST(COALESCE(p_page, 1), 1);
  v_effective_page_size := LEAST(COALESCE(p_page_size, 50), 200);
  v_offset := (v_effective_page - 1) * v_effective_page_size;

  -- BACKLOG-1042: Sanitize ILIKE metacharacters
  IF p_search IS NOT NULL THEN
    v_safe_search := regexp_replace(p_search, '([%_\\])', '\\\\1', 'g');
  END IF;

  -- BACKLOG-1180: Extract numeric portion from common prefixes (BACKLOG-1050, TASK-123, #1050, BL-99)
  v_extracted_number := NULL;
  IF p_search IS NOT NULL AND p_search ~* '^(BACKLOG|TASK|BL|#)-?\d+$' THEN
    v_extracted_number := (regexp_replace(p_search, '^(BACKLOG|TASK|BL|#)-?', '', 'i'))::int;
  END IF;

  -- BACKLOG-1050: Use CTE to eliminate WHERE clause duplication
  WITH filtered_items AS (
    SELECT i.*
    FROM pm_backlog_items i
    WHERE i.deleted_at IS NULL
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_priority IS NULL OR i.priority = p_priority)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_area IS NULL OR i.area = p_area)
      AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (p_assignee_id IS NULL OR i.assignee_id = p_assignee_id)
      AND (p_search IS NULL OR (
        i.search_vector @@ plainto_tsquery('english', p_search)
        OR i.legacy_id ILIKE '%' || v_safe_search || '%'
        OR i.title ILIKE '%' || v_safe_search || '%'
        OR i.item_number::text ILIKE '%' || v_safe_search || '%'
        OR (p_search ~ '^\d+$' AND i.item_number = p_search::int)
        OR (v_extracted_number IS NOT NULL AND i.item_number = v_extracted_number)
        OR EXISTS (
          SELECT 1 FROM pm_comments c
          WHERE c.item_id = i.id AND c.deleted_at IS NULL
            AND c.body ILIKE '%' || v_safe_search || '%'
        )
      ))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
      AND (NOT p_root_only OR i.parent_id IS NULL)
  )
  -- Count total matching items
  SELECT COUNT(*) INTO v_total_count FROM filtered_items;

  -- Get page of items
  SELECT COALESCE(jsonb_agg(item_row ORDER BY sort_order ASC, created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT to_jsonb(i.*) || jsonb_build_object(
      'labels', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color))
        FROM pm_item_labels il
        JOIN pm_labels l ON l.id = il.label_id
        WHERE il.item_id = i.id
      ), '[]'::jsonb),
      'child_count', (SELECT COUNT(*) FROM pm_backlog_items c WHERE c.parent_id = i.id AND c.deleted_at IS NULL)
    ) AS item_row, i.sort_order, i.created_at
    FROM pm_backlog_items i
    WHERE i.deleted_at IS NULL
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_priority IS NULL OR i.priority = p_priority)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_area IS NULL OR i.area = p_area)
      AND (p_sprint_id IS NULL OR i.sprint_id = p_sprint_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (p_assignee_id IS NULL OR i.assignee_id = p_assignee_id)
      AND (p_search IS NULL OR (
        i.search_vector @@ plainto_tsquery('english', p_search)
        OR i.legacy_id ILIKE '%' || v_safe_search || '%'
        OR i.title ILIKE '%' || v_safe_search || '%'
        OR i.item_number::text ILIKE '%' || v_safe_search || '%'
        OR (p_search ~ '^\d+$' AND i.item_number = p_search::int)
        OR (v_extracted_number IS NOT NULL AND i.item_number = v_extracted_number)
        OR EXISTS (
          SELECT 1 FROM pm_comments c
          WHERE c.item_id = i.id AND c.deleted_at IS NULL
            AND c.body ILIKE '%' || v_safe_search || '%'
        )
      ))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
      AND (NOT p_root_only OR i.parent_id IS NULL)
    ORDER BY i.sort_order ASC, i.created_at DESC
    LIMIT v_effective_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total_count,
    'page', v_effective_page,
    'page_size', v_effective_page_size
  );
END;
$function$;


-- Also update pm_search_items_for_link with the same prefix-stripping logic
CREATE OR REPLACE FUNCTION public.pm_search_items_for_link(
  p_query text,
  p_exclude_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_results JSONB;
  v_safe_query TEXT;
  v_extracted_number INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  -- BACKLOG-1042: Sanitize ILIKE metacharacters
  v_safe_query := regexp_replace(p_query, '([%_\\])', '\\\\1', 'g');

  -- BACKLOG-1180: Extract numeric portion from common prefixes (BACKLOG-1050, TASK-123, #1050, BL-99)
  v_extracted_number := NULL;
  IF p_query ~* '^(BACKLOG|TASK|BL|#)-?\d+$' THEN
    v_extracted_number := (regexp_replace(p_query, '^(BACKLOG|TASK|BL|#)-?', '', 'i'))::int;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'legacy_id', i.legacy_id,
    'item_number', i.item_number,
    'status', i.status,
    'type', i.type,
    'priority', i.priority
  )), '[]'::jsonb)
  INTO v_results
  FROM pm_backlog_items i
  WHERE i.deleted_at IS NULL
    AND (p_exclude_id IS NULL OR i.id != p_exclude_id)
    AND (
      i.search_vector @@ plainto_tsquery('english', p_query)
      OR i.title ILIKE '%' || v_safe_query || '%'
      OR i.legacy_id ILIKE '%' || v_safe_query || '%'
      OR i.item_number::text ILIKE '%' || v_safe_query || '%'
      OR (p_query ~ '^\d+$' AND i.item_number = p_query::int)
      OR (v_extracted_number IS NOT NULL AND i.item_number = v_extracted_number)
    )
  ORDER BY i.item_number DESC
  LIMIT 10;

  RETURN v_results;
END;
$function$;
