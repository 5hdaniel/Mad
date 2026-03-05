# TASK-2111: Cross-Org Search and User Detail RPCs

**Status:** Completed
**Completed:** 2026-03-05
**Sprint:** SPRINT-111

---

## Goal

Create two SECURITY DEFINER RPC functions for the admin portal: cross-org user search and aggregated user detail.

## Non-Goals

- Do NOT create UI -- that's TASK-2112 and TASK-2113
- Do NOT add write operations

## Depends On

- TASK-2110 (`has_internal_role()` function must exist)

## RPC 1: admin_search_users

```sql
CREATE OR REPLACE FUNCTION public.admin_search_users(
  search_query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT,
  is_active BOOLEAN,
  subscription_tier TEXT,
  last_login_at TIMESTAMPTZ,
  org_name TEXT,
  org_slug TEXT,
  org_role TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: internal role required';
  END IF;

  IF result_limit > 100 THEN
    result_limit := 100;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.first_name, u.last_name, u.display_name,
         u.avatar_url, u.status, u.is_active, u.subscription_tier,
         u.last_login_at, o.name AS org_name, o.slug AS org_slug,
         om.role AS org_role
  FROM users u
  LEFT JOIN organization_members om ON om.user_id = u.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  WHERE u.email ILIKE '%' || search_query || '%'
     OR u.first_name ILIKE '%' || search_query || '%'
     OR u.last_name ILIKE '%' || search_query || '%'
     OR u.display_name ILIKE '%' || search_query || '%'
     OR o.slug ILIKE '%' || search_query || '%'
     OR o.name ILIKE '%' || search_query || '%'
     OR (length(search_query) = 36 AND u.id::TEXT = search_query)
  ORDER BY u.last_login_at DESC NULLS LAST
  LIMIT result_limit;
END;
$$;
```

## RPC 2: admin_get_user_detail

Returns a JSONB object with user profile, organizations, license, devices, and recent audit logs.

## Acceptance Criteria

- [x] `supabase.rpc('admin_search_users', { search_query: 'test' })` returns matches across all orgs
- [x] Search works by email, name, display_name, org slug, and UUID
- [x] `supabase.rpc('admin_get_user_detail', { target_user_id: '<uuid>' })` returns full profile
- [x] Non-internal user gets authorization error on both RPCs
- [x] Both functions have `SET search_path TO 'public'`

## Integration Notes

- **Blocks:** TASK-2112 (search UI), TASK-2113 (detail view)
- **Depends on:** TASK-2110 (`has_internal_role()` function)

---

## PM Estimate

**Category:** `schema`
**Estimated Tokens:** ~8K
**Token Cap:** 30K
**Confidence:** Medium
