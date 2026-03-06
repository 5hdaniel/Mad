# TASK-2111: Cross-Org Search and User Detail RPCs

---

## WORKFLOW REQUIREMENT

**This task is a Supabase migration — can be applied via MCP.**

No application code changes. PM applies directly using `mcp__supabase__apply_migration`.

---

## Goal

Create two SECURITY DEFINER RPC functions for the admin portal: cross-org user search and aggregated user detail.

## Non-Goals

- Do NOT create UI — that's TASK-2112 and TASK-2113
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
    u.email,
    u.first_name,
    u.last_name,
    u.display_name,
    u.avatar_url,
    u.status,
    u.is_active,
    u.subscription_tier,
    u.last_login_at,
    o.name AS org_name,
    o.slug AS org_slug,
    om.role AS org_role
  FROM users u
  LEFT JOIN organization_members om ON om.user_id = u.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  WHERE
    u.email ILIKE '%' || search_query || '%'
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

```sql
CREATE OR REPLACE FUNCTION public.admin_get_user_detail(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Validate caller has internal role
  IF NOT has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: internal role required';
  END IF;

  SELECT jsonb_build_object(
    'user', (SELECT jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'first_name', u.first_name,
      'last_name', u.last_name,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'status', u.status,
      'is_active', u.is_active,
      'subscription_tier', u.subscription_tier,
      'subscription_status', u.subscription_status,
      'last_login_at', u.last_login_at,
      'login_count', u.login_count,
      'created_at', u.created_at,
      'trial_ends_at', u.trial_ends_at,
      'suspended_at', u.suspended_at,
      'suspension_reason', u.suspension_reason,
      'onboarding_completed_at', u.onboarding_completed_at,
      'oauth_provider', u.oauth_provider
    ) FROM users u WHERE u.id = target_user_id),
    'organizations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'org_slug', o.slug,
        'role', om.role,
        'license_status', om.license_status,
        'joined_at', om.created_at
      ))
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = target_user_id
    ), '[]'::jsonb),
    'license', (SELECT jsonb_build_object(
      'id', l.id,
      'status', l.status,
      'license_type', l.license_type,
      'max_devices', l.max_devices,
      'trial_status', l.trial_status,
      'trial_started_at', l.trial_started_at,
      'trial_expires_at', l.trial_expires_at,
      'transaction_count', l.transaction_count,
      'transaction_limit', l.transaction_limit,
      'activated_at', l.activated_at,
      'expires_at', l.expires_at,
      'created_at', l.created_at
    ) FROM licenses l WHERE l.user_id = target_user_id LIMIT 1),
    'devices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'device_id', d.device_id,
        'device_name', d.device_name,
        'os', d.os,
        'platform', d.platform,
        'app_version', d.app_version,
        'is_active', d.is_active,
        'last_seen_at', d.last_seen_at,
        'created_at', d.created_at
      ) ORDER BY d.last_seen_at DESC NULLS LAST)
      FROM devices d WHERE d.user_id = target_user_id
    ), '[]'::jsonb),
    'recent_audit_logs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'resource_type', al.resource_type,
        'resource_id', al.resource_id,
        'metadata', al.metadata,
        'success', al.success,
        'timestamp', al."timestamp"
      ) ORDER BY al."timestamp" DESC)
      FROM (
        SELECT * FROM audit_logs
        WHERE user_id = target_user_id
        ORDER BY "timestamp" DESC
        LIMIT 50
      ) al
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
```

## Acceptance Criteria

- [ ] `supabase.rpc('admin_search_users', { search_query: 'test' })` returns matches across all orgs
- [ ] Search works by email, name, display_name, org slug, and UUID
- [ ] `supabase.rpc('admin_get_user_detail', { target_user_id: '<uuid>' })` returns full profile
- [ ] Non-internal user gets authorization error on both RPCs
- [ ] Both functions have `SET search_path TO 'public'`

## Integration Notes

- **Blocks:** TASK-2112 (search UI), TASK-2113 (detail view)
- **Depends on:** TASK-2110 (`has_internal_role()` function)
- **Note:** The detail RPC is optional — the detail page could also make parallel Supabase client queries using the RLS policies from TASK-2110. Engineer can choose either approach.

---

## PM Estimate

**Category:** `schema`
**Estimated Tokens:** ~8K
**Token Cap:** 30K
**Confidence:** Medium — RPC logic is well-defined but column names need verification against actual schema.
