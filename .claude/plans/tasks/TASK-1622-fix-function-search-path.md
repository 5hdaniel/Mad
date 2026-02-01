# TASK-1622: Fix Function Search Path Vulnerabilities

**Created**: 2026-01-28
**Backlog Item**: BACKLOG-556 (Security Advisory)
**Sprint**: SPRINT-063 (or next available)
**Priority**: P1 - Security
**Estimated Tokens**: ~8K

---

## Problem Statement

Three PostgreSQL functions in the `public` schema have mutable `search_path` configuration (`config: null`), making them vulnerable to search_path injection attacks:

| Function | Trigger | Security Risk |
|----------|---------|---------------|
| `handle_new_user` | `on_auth_user_created` on `auth.users` | **HIGH** - Runs on every new user signup |
| `handle_new_user_profile` | None (orphaned) | **MEDIUM** - Function exists but no trigger |
| `handle_new_user_invitation_link` | None (orphaned) | **MEDIUM** - Function exists but no trigger |

### Security Risk Explanation

When a function does not have its `search_path` explicitly set, it inherits the `search_path` of the current session. This can lead to:

1. **Inconsistent behavior**: Function may resolve unqualified table names differently depending on who executes it
2. **Security exploitation**: Malicious actors could create shadow tables in their own schema that get resolved before the intended `public` schema tables
3. **Privilege escalation**: Since these functions use `SECURITY DEFINER`, they run with elevated privileges - an attacker could hijack the function's behavior

**Reference**: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0011_function_search_path_mutable

---

## Current Function Definitions

### 1. `handle_new_user` (ACTIVE - Has Trigger)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Try to insert, or update existing record by email to match auth ID
  INSERT INTO public.users (
    id, email, display_name, avatar_url, oauth_provider, oauth_id,
    created_at, updated_at, is_active, status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'provider_id', NEW.raw_user_meta_data->>'sub', NEW.id::text),
    NOW(),
    NOW(),
    true,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$function$
```

**Analysis**: Already uses fully-qualified `public.users` table references. Setting `search_path = ''` will be safe.

### 2. `handle_new_user_profile` (ORPHANED - No Trigger)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW() + INTERVAL '14 days'
  );
  RETURN NEW;
END;
$function$
```

**Analysis**: Orphaned function with no active trigger. Uses fully-qualified `public.profiles` reference. Consider deprecating or removing.

### 3. `handle_new_user_invitation_link` (ORPHANED - No Trigger)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Link any pending invitations by email
  UPDATE organization_members
  SET
    user_id = NEW.id,
    joined_at = NOW(),
    license_status = 'active'
  WHERE invited_email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$function$
```

**Analysis**: Orphaned function. Uses **unqualified** `organization_members` table reference - this is the most vulnerable. Must add `public.` prefix when fixing.

---

## Implementation Plan

### Option A: Fix Search Path Only (Recommended)

Fix the search_path vulnerability on all three functions without removing the orphaned ones.

**Rationale**: Orphaned functions may be needed for future features or may have been intentionally disabled. Removing them requires product decision.

### Option B: Fix Active + Remove Orphaned

Fix `handle_new_user` and drop the two orphaned functions.

**Risk**: May break future features if these functions were kept intentionally.

---

## SQL Migration (Option A - Recommended)

**Migration Name**: `fix_user_trigger_search_paths`

```sql
-- Fix search_path vulnerability for handle_new_user (active trigger function)
-- Also adds explicit schema qualification for consistency
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  -- Try to insert, or update existing record by email to match auth ID
  INSERT INTO public.users (
    id, email, display_name, avatar_url, oauth_provider, oauth_id,
    created_at, updated_at, is_active, status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'provider_id', NEW.raw_user_meta_data->>'sub', NEW.id::text),
    NOW(),
    NOW(),
    true,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

-- Fix search_path vulnerability for handle_new_user_profile (orphaned but kept for future use)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW() + INTERVAL '14 days'
  );
  RETURN NEW;
END;
$function$;

-- Fix search_path vulnerability for handle_new_user_invitation_link (orphaned but kept for future use)
-- NOTE: Added explicit public. schema prefix to organization_members (was missing)
CREATE OR REPLACE FUNCTION public.handle_new_user_invitation_link()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  -- Link any pending invitations by email
  UPDATE public.organization_members
  SET
    user_id = NEW.id,
    joined_at = NOW(),
    license_status = 'active'
  WHERE invited_email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$function$;

-- Add comments documenting the orphaned functions
COMMENT ON FUNCTION public.handle_new_user_profile() IS
  'ORPHANED: No active trigger. Kept for potential future use. Originally created for profiles table.';

COMMENT ON FUNCTION public.handle_new_user_invitation_link() IS
  'ORPHANED: No active trigger. Kept for organization invitation linking feature (future).';
```

---

## Verification Steps

After applying the migration, verify all three functions have `search_path` set:

```sql
SELECT
    p.proname AS function_name,
    p.proconfig AS config,
    CASE
        WHEN p.proconfig IS NULL THEN 'VULNERABLE'
        WHEN 'search_path=' = ANY(p.proconfig) OR 'search_path=public' = ANY(p.proconfig) THEN 'FIXED'
        ELSE 'CHECK'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('handle_new_user', 'handle_new_user_profile', 'handle_new_user_invitation_link')
ORDER BY p.proname;
```

**Expected Result:**
```
function_name                    | config              | status
---------------------------------|---------------------|--------
handle_new_user                  | {search_path=}      | FIXED
handle_new_user_invitation_link  | {search_path=}      | FIXED
handle_new_user_profile          | {search_path=}      | FIXED
```

Also run the Supabase security advisor to confirm no more warnings:

```sql
-- Via Supabase MCP tool: mcp__supabase__get_advisors with type: "security"
```

---

## Rollback Plan

If issues occur, restore original function definitions (without search_path):

```sql
-- Rollback: Remove search_path setting from functions
-- WARNING: This restores the vulnerability - only use if breaking issues occur

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  -- search_path intentionally removed for rollback
AS $function$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url, oauth_provider, oauth_id, created_at, updated_at, is_active, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'), COALESCE(NEW.raw_user_meta_data->>'provider_id', NEW.raw_user_meta_data->>'sub', NEW.id::text), NOW(), NOW(), true, 'active')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = COALESCE(EXCLUDED.display_name, public.users.display_name), avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url), updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Similar for other two functions...
```

---

## Testing Plan

### Pre-Migration Verification

1. Run security advisor - confirm 3 vulnerable functions
2. Query function configs - confirm `config: null`

### Post-Migration Verification

1. Run security advisor - confirm 0 function_search_path_mutable warnings
2. Query function configs - confirm `search_path=` in config array
3. Test new user signup - verify `handle_new_user` trigger still works
4. Verify `public.users` record created correctly

### Functional Test (Manual)

1. Sign out of app
2. Sign up as new user (or delete existing test user from Supabase)
3. Verify user record created in `public.users` table
4. Verify app works normally post-login

---

## Files Modified

| File | Action | Notes |
|------|--------|-------|
| Supabase migration | Create | Via `mcp__supabase__apply_migration` |

**No local code changes required** - this is a database-only fix.

---

## Dependencies

- None (standalone security fix)

---

## Related Issues

- Previous migration `20260127011752_fix_function_search_paths` fixed 6 other functions but missed these 3
- SPRINT-062 security review identified this gap

---

## Notes for Engineer

1. **Use Supabase MCP tools** - Apply migration via `mcp__supabase__apply_migration`, not local files
2. **Empty string is intentional** - `search_path = ''` forces all references to be fully qualified
3. **Already qualified** - `handle_new_user` and `handle_new_user_profile` already use `public.` prefix
4. **Fix needed** - `handle_new_user_invitation_link` needs `public.` prefix added to `organization_members`
5. **Orphaned functions** - Consider creating backlog item to evaluate if orphaned functions should be removed

---

## Acceptance Criteria

- [x] All 3 functions have `SET search_path = ''` in their definition
- [x] `handle_new_user_invitation_link` uses `public.organization_members` (qualified)
- [x] Supabase security advisor shows 0 `function_search_path_mutable` warnings
- [x] New user signup still works correctly (verified by SR Engineer)
- [x] No regression in existing functionality (verified by SR Engineer)

---

## Status

**COMPLETE** - Verified and approved by SR Engineer on 2026-01-28

---

## Implementation Summary

**Completed**: 2026-01-28
**Migration Applied**: `20260128193124_fix_user_trigger_search_paths`

### Changes Made

1. **Applied migration via Supabase MCP** - Fixed all 3 functions:
   - `handle_new_user` - Added `SET search_path = ''`
   - `handle_new_user_profile` - Added `SET search_path = ''`
   - `handle_new_user_invitation_link` - Added `SET search_path = ''` AND fixed unqualified table reference to `public.organization_members`

2. **Added documentation comments** to orphaned functions explaining their status

### Verification Results

**Pre-Migration Security Advisor Output:**
- 3 `function_search_path_mutable` warnings (handle_new_user, handle_new_user_profile, handle_new_user_invitation_link)

**Post-Migration Security Advisor Output:**
- 0 `function_search_path_mutable` warnings
- Only unrelated `auth_leaked_password_protection` warning remains (out of scope)

**Function Config Verification:**
```
function_name                    | config
---------------------------------|---------------------
handle_new_user                  | {search_path=""}
handle_new_user_invitation_link  | {search_path=""}
handle_new_user_profile          | {search_path=""}
```

### Notes

- This is a database-only fix - no local code changes
- Orphaned functions were preserved (product decision to remove deferred)
- The `handle_new_user` function (active trigger) continues to work - user signup not affected
