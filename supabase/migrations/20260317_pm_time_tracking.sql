-- Time tracking entries table
CREATE TABLE IF NOT EXISTS pm_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES pm_backlog_items(id),
  user_id UUID NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pm_time_entries_item ON pm_time_entries(item_id);
CREATE INDEX idx_pm_time_entries_user ON pm_time_entries(user_id);

-- RPC: Add time entry
CREATE OR REPLACE FUNCTION pm_add_time_entry(
  p_item_id UUID,
  p_duration_minutes INTEGER,
  p_description TEXT DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO pm_time_entries (item_id, user_id, description, duration_minutes, started_at)
  VALUES (p_item_id, v_user_id, p_description, p_duration_minutes, COALESCE(p_started_at, now()))
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('id', v_entry_id, 'success', true);
END;
$$;

-- RPC: List time entries for an item
CREATE OR REPLACE FUNCTION pm_list_time_entries(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_entries JSONB;
  v_total INTEGER;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'user_id', t.user_id,
      'user_name', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
      'description', t.description,
      'duration_minutes', t.duration_minutes,
      'started_at', t.started_at,
      'created_at', t.created_at
    ) ORDER BY t.created_at DESC
  ), '[]'::jsonb),
  COALESCE(SUM(t.duration_minutes), 0)
  INTO v_entries, v_total
  FROM pm_time_entries t
  LEFT JOIN auth.users u ON u.id = t.user_id
  WHERE t.item_id = p_item_id;

  RETURN jsonb_build_object(
    'entries', v_entries,
    'total_minutes', v_total
  );
END;
$$;

-- RPC: Delete time entry (only own entries)
CREATE OR REPLACE FUNCTION pm_delete_time_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM pm_time_entries
  WHERE id = p_entry_id AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;
