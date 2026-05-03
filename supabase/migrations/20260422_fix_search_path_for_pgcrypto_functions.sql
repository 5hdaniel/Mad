-- HOTFIX for BACKLOG-1663: Two functions broken by BACKLOG-1633 search_path hardening
--
-- BACKLOG-1633 (PR #1673, merged 2026-04-21) set search_path = public on 57 functions.
-- Two of those functions call gen_random_bytes() from the pgcrypto extension, which
-- lives in the 'extensions' schema in Supabase — NOT 'public'. After the hardening,
-- those functions failed with: function gen_random_bytes(integer) does not exist.
--
-- Incident: admin portal "Invite User" returned "Failed to create invitation" on
-- 2026-04-22. Postgres log showed the gen_random_bytes error.
--
-- Fix: include 'extensions' in the search_path for these two functions only.
-- The other 55 functions from BACKLOG-1633 do NOT use pgcrypto/extensions and
-- remain safely pinned to search_path = public (audited).

ALTER FUNCTION public.admin_invite_user(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_invited_by uuid,
  p_license_status text,
  p_plan_id uuid
) SET search_path = public, extensions;

ALTER FUNCTION public.admin_start_impersonation(
  p_target_user_id uuid
) SET search_path = public, extensions;
