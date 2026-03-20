-- ============================================
-- PM: List Assignable Users RPC
-- Migration: 20260317_pm_list_assignable_users
-- Purpose: SECURITY DEFINER RPC to list profiles for assignment picker
--          (bypasses profiles RLS which restricts to own row)
-- Sprint: SPRINT-140 / TASK-2232
-- ============================================

CREATE OR REPLACE FUNCTION pm_list_assignable_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  -- Only internal users can list all profiles
  IF NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Access denied: internal role required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'email', p.email
      ) ORDER BY p.display_name NULLS LAST
    ), '[]'::jsonb)
    FROM profiles p
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pm_list_assignable_users TO authenticated;
