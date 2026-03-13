-- ============================================
-- SUPPORT TICKETING: LIST AGENTS RPC
-- Migration: 20260313_support_list_agents_rpc
-- Purpose: RPC to list internal users for assignment dropdown
-- Sprint: SPRINT-130 / TASK-2173
-- ============================================

CREATE OR REPLACE FUNCTION support_list_agents()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow internal users to call this
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: only internal users can list agents';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'user_id', ir.user_id,
        'email', u.email,
        'display_name', COALESCE(u.display_name, u.email),
        'role_name', ar.name
      ) ORDER BY COALESCE(u.display_name, u.email)
    ), '[]'::jsonb)
    FROM internal_roles ir
    JOIN users u ON u.id = ir.user_id
    JOIN admin_roles ar ON ar.id = ir.role_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_list_agents TO authenticated;
