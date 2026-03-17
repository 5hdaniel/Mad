-- PM Custom Fields Migration
-- Adds JSONB columns for custom field definitions on projects
-- and custom field values on backlog items.

-- Add custom_fields column to projects (field definitions)
-- Schema: [{"key": "budget", "label": "Budget", "type": "number"}, {"key": "client", "label": "Client", "type": "text"}]
ALTER TABLE pm_projects ADD COLUMN IF NOT EXISTS custom_field_definitions JSONB DEFAULT '[]'::jsonb;

-- Add custom_fields column to backlog items (field values)
-- Schema: {"budget": 50000, "client": "Acme Corp"}
ALTER TABLE pm_backlog_items ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- RPC: Update project custom field definitions
CREATE OR REPLACE FUNCTION pm_update_field_definitions(
  p_project_id UUID,
  p_definitions JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE pm_projects
  SET custom_field_definitions = p_definitions, updated_at = now()
  WHERE id = p_project_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Update item custom field value
CREATE OR REPLACE FUNCTION pm_update_custom_field(
  p_item_id UUID,
  p_field_key TEXT,
  p_value JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE pm_backlog_items
  SET custom_fields = custom_fields || jsonb_build_object(p_field_key, p_value),
      updated_at = now()
  WHERE id = p_item_id AND deleted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;
