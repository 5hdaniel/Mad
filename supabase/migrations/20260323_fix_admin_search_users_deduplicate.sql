-- Fix: deduplicate admin_search_users results for multi-org members (BACKLOG-1346)
-- Previously, a user in N orgs would produce N rows. Now aggregates org data
-- into comma-separated strings so each user appears exactly once.

CREATE OR REPLACE FUNCTION public.admin_search_users(search_query text, result_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, display_name text, avatar_url text, status text, is_active boolean, subscription_tier text, last_login_at timestamp with time zone, org_name text, org_slug text, org_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate caller has internal role
  IF NOT has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: internal role required';
  END IF;

  -- Cap result limit at 100
  IF result_limit > 100 THEN
    result_limit := 100;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    u.first_name::TEXT,
    u.last_name::TEXT,
    u.display_name::TEXT,
    u.avatar_url::TEXT,
    u.status::TEXT,
    u.is_active,
    u.subscription_tier::TEXT,
    u.last_login_at,
    string_agg(DISTINCT o.name::TEXT, ', ' ORDER BY o.name::TEXT)  AS org_name,
    string_agg(DISTINCT o.slug::TEXT, ', ' ORDER BY o.slug::TEXT)  AS org_slug,
    string_agg(DISTINCT om.role::TEXT, ', ' ORDER BY om.role::TEXT) AS org_role
  FROM users u
  LEFT JOIN organization_members om ON om.user_id = u.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  WHERE
    search_query = ''
    OR u.email ILIKE '%' || search_query || '%'
    OR u.first_name ILIKE '%' || search_query || '%'
    OR u.last_name ILIKE '%' || search_query || '%'
    OR u.display_name ILIKE '%' || search_query || '%'
    OR o.slug ILIKE '%' || search_query || '%'
    OR o.name ILIKE '%' || search_query || '%'
    OR (length(search_query) = 36 AND u.id::TEXT = search_query)
  GROUP BY u.id, u.email, u.first_name, u.last_name, u.display_name,
           u.avatar_url, u.status, u.is_active, u.subscription_tier, u.last_login_at
  ORDER BY u.last_login_at DESC NULLS LAST
  LIMIT result_limit;
END;
$function$;
