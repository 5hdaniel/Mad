-- ============================================
-- Add p_assignee_id filter to pm_list_items
-- Migration: 20260318_pm_list_items_assignee
-- Purpose: Enable server-side assignee filtering so MyTasksPage
--          doesn't need to fetch 500 items and filter client-side
-- Sprint: SPRINT-147 / TASK-2244 / BACKLOG-1049
-- ============================================

-- Drop old 11-param version to avoid ambiguous function name
DROP FUNCTION IF EXISTS pm_list_items(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, UUID[], UUID, INT, INT);

CREATE OR REPLACE FUNCTION pm_list_items(
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_sprint_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_labels UUID[] DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_assignee_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_total_count INT;
  v_items JSONB;
  v_offset INT;
BEGIN
  -- Auth guard: internal role required
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Count total matching items
  SELECT COUNT(*) INTO v_total_count
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
      OR i.legacy_id ILIKE '%' || p_search || '%'
      OR i.title ILIKE '%' || p_search || '%'
      OR EXISTS (
        SELECT 1 FROM pm_comments c
        WHERE c.item_id = i.id AND c.deleted_at IS NULL
          AND c.body ILIKE '%' || p_search || '%'
      )
    ))
    AND (p_labels IS NULL OR EXISTS (
      SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
    ))
    AND (p_parent_id IS NULL OR i.parent_id = p_parent_id);

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
        OR i.legacy_id ILIKE '%' || p_search || '%'
        OR i.title ILIKE '%' || p_search || '%'
        OR EXISTS (
          SELECT 1 FROM pm_comments c
          WHERE c.item_id = i.id AND c.deleted_at IS NULL
            AND c.body ILIKE '%' || p_search || '%'
        )
      ))
      AND (p_labels IS NULL OR EXISTS (
        SELECT 1 FROM pm_item_labels il WHERE il.item_id = i.id AND il.label_id = ANY(p_labels)
      ))
      AND (p_parent_id IS NULL OR i.parent_id = p_parent_id)
    ORDER BY i.sort_order ASC, i.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total_count', v_total_count,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_items TO authenticated;
