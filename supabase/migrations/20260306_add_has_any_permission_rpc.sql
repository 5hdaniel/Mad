-- Migration: Add has_any_permission RPC
-- Purpose: Batch permission check to eliminate N+1 RPC calls in middleware.
--          Instead of calling has_permission() once per permission key,
--          the middleware can pass all required keys in a single call.
-- Reference: BACKLOG-880

CREATE OR REPLACE FUNCTION public.has_any_permission(
  check_user_id UUID,
  permission_keys TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM internal_roles ir
    JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
    JOIN admin_permissions ap ON ap.id = arp.permission_id
    WHERE ir.user_id = check_user_id
      AND ap.key = ANY(permission_keys)
  );
$$;

-- Grant execute to authenticated users (matches has_permission grant)
GRANT EXECUTE ON FUNCTION public.has_any_permission(UUID, TEXT[]) TO authenticated;
