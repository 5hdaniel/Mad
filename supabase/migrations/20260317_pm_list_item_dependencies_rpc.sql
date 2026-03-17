-- Migration: pm_list_item_dependencies_rpc
-- Purpose: Fix pm_dependencies to reference pm_backlog_items (not pm_tasks)
--          and add RPC to list dependencies for a backlog item.
--
-- Context: The DependencyPanel UI passes backlog item IDs, but the original
--          schema had FKs to pm_tasks. Since the table is empty (0 rows),
--          this is a safe alteration.

-- ============================================
-- 1. Alter FKs: pm_dependencies → pm_backlog_items
-- ============================================

-- Drop old FK constraints
ALTER TABLE pm_dependencies DROP CONSTRAINT pm_dependencies_source_id_fkey;
ALTER TABLE pm_dependencies DROP CONSTRAINT pm_dependencies_target_id_fkey;

-- Add new FK constraints referencing pm_backlog_items
ALTER TABLE pm_dependencies
  ADD CONSTRAINT pm_dependencies_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES pm_backlog_items(id) ON DELETE CASCADE;

ALTER TABLE pm_dependencies
  ADD CONSTRAINT pm_dependencies_target_id_fkey
  FOREIGN KEY (target_id) REFERENCES pm_backlog_items(id) ON DELETE CASCADE;

-- ============================================
-- 2. Update pm_add_dependency to validate backlog item IDs
-- ============================================

CREATE OR REPLACE FUNCTION pm_add_dependency(
  p_source_id UUID,
  p_target_id UUID,
  p_type TEXT DEFAULT 'depends_on'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_dep_id UUID;
  v_is_circular BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  IF p_type NOT IN ('depends_on', 'blocks') THEN
    RAISE EXCEPTION 'Invalid dependency type: %. Must be depends_on or blocks', p_type;
  END IF;

  -- Validate both IDs exist in pm_backlog_items
  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_source_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Source item not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pm_backlog_items WHERE id = p_target_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Target item not found';
  END IF;

  -- Cannot depend on self
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'An item cannot depend on itself';
  END IF;

  -- Check for circular dependencies using recursive CTE
  WITH RECURSIVE dep_chain AS (
    SELECT target_id AS node_id
    FROM pm_dependencies
    WHERE source_id = p_target_id

    UNION

    SELECT d.target_id
    FROM pm_dependencies d
    JOIN dep_chain dc ON d.source_id = dc.node_id
  )
  SELECT EXISTS (
    SELECT 1 FROM dep_chain WHERE node_id = p_source_id
  ) INTO v_is_circular;

  IF v_is_circular THEN
    RAISE EXCEPTION 'Circular dependency detected: adding this dependency would create a cycle';
  END IF;

  -- Insert the dependency
  INSERT INTO pm_dependencies (source_id, target_id, dependency_type)
  VALUES (p_source_id, p_target_id, p_type)
  RETURNING id INTO v_dep_id;

  RETURN jsonb_build_object('id', v_dep_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pm_add_dependency TO authenticated;

-- ============================================
-- 3. New RPC: pm_list_item_dependencies
-- ============================================

CREATE OR REPLACE FUNCTION pm_list_item_dependencies(
  p_item_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(dep)::jsonb), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      d.id,
      d.source_id,
      d.target_id,
      d.dependency_type,
      d.created_at,
      -- Include target item info for display
      CASE
        WHEN d.source_id = p_item_id THEN t.title
        ELSE s.title
      END AS related_title,
      CASE
        WHEN d.source_id = p_item_id THEN t.legacy_id
        ELSE s.legacy_id
      END AS related_legacy_id,
      CASE
        WHEN d.source_id = p_item_id THEN t.item_number
        ELSE s.item_number
      END AS related_item_number,
      CASE
        WHEN d.source_id = p_item_id THEN t.status
        ELSE s.status
      END AS related_status
    FROM pm_dependencies d
    LEFT JOIN pm_backlog_items s ON d.source_id = s.id
    LEFT JOIN pm_backlog_items t ON d.target_id = t.id
    WHERE (d.source_id = p_item_id OR d.target_id = p_item_id)
      AND s.deleted_at IS NULL
      AND t.deleted_at IS NULL
    ORDER BY d.created_at DESC
  ) dep;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_item_dependencies TO authenticated;
