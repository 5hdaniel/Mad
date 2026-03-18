-- pm_bulk_delete: Atomic bulk soft-delete for backlog items.
-- Sets deleted_at = NOW() on all supplied item IDs in a single call.
-- Returns success flag and count of deleted items.

CREATE OR REPLACE FUNCTION pm_bulk_delete(
  p_item_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Validate input
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'deleted_count', 0);
  END IF;

  -- Soft-delete all items (only those not already deleted)
  UPDATE pm_backlog_items
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = ANY(p_item_ids)
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_count
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION pm_bulk_delete(UUID[]) TO authenticated;
