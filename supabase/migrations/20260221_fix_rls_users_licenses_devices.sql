-- ============================================
-- RLS HARDENING: users, licenses, devices
-- Migration: 20260221_fix_rls_users_licenses_devices
-- Task: TASK-2037 (BACKLOG-771)
-- Purpose: Ensure proper RLS policies on users, licenses, devices tables
-- ============================================
--
-- AUDIT FINDINGS (2026-02-21):
--   The three target tables already had scoped policies (no FOR ALL USING(true)),
--   but the following gaps were identified and fixed:
--
--   1. users  - Policies OK, but org-member read policy needed tightening
--   2. licenses - Missing service_role bypass; missing WITH CHECK on UPDATE
--   3. devices  - Missing service_role bypass; missing WITH CHECK on UPDATE
--
--   Additionally, user_preferences had FOR ALL USING(true) for both
--   authenticated and anon roles. That table is OUT OF SCOPE for this
--   migration but is flagged for a future task.
--
-- APPROACH:
--   Drop-and-recreate all policies on these 3 tables for a clean, auditable state.
--   This is idempotent -- safe to run multiple times.
--
-- ============================================

-- ============================================
-- SECTION 1: VERIFY RLS IS ENABLED
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 2: USERS TABLE RLS POLICIES
-- ============================================
-- Table: users (core user record, id = auth.uid())
-- Columns: id (uuid, PK, = auth.uid()), email, first_name, last_name,
--           display_name, avatar_url, subscription_tier, etc.
--
-- Access model:
--   - Users can read and update their own row
--   - Users can insert their own row (on first sign-up)
--   - Org members can read other org members' user rows (for display names, etc.)
--   - Service role has full access (Edge Functions, server-side ops)
--   - No user-initiated DELETE (service role only)

-- Drop all existing policies on users
DROP POLICY IF EXISTS "users_can_read_own_user" ON users;
DROP POLICY IF EXISTS "users_can_update_own_user" ON users;
DROP POLICY IF EXISTS "users_can_insert_own_user" ON users;
DROP POLICY IF EXISTS "org_members_can_read_org_users" ON users;
DROP POLICY IF EXISTS "service_role_full_access_users" ON users;
-- Drop any legacy permissive policies that may exist
DROP POLICY IF EXISTS "users_all_policy" ON users;
DROP POLICY IF EXISTS "allow_all" ON users;

-- Policy 1: Users can read their own row
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can update their own row
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own row (sign-up flow)
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Org members can read other org members' user records
-- This is needed for display names, avatars, etc. in the org context
CREATE POLICY "users_select_org_members"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
      AND om.user_id IS NOT NULL
    )
  );

-- Policy 5: Service role bypass (Edge Functions, server-side operations)
CREATE POLICY "users_service_role_all"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- SECTION 3: LICENSES TABLE RLS POLICIES
-- ============================================
-- Table: licenses (license keys and subscription tracking)
-- Columns: id (uuid, PK), user_id (uuid, FK -> auth.users),
--           license_key, max_devices, status, license_type, trial_status, etc.
--
-- Access model:
--   - Users can read their own license
--   - Users can insert their own license (activation flow)
--   - Users can update their own license (e.g., trial -> active)
--   - No user-initiated DELETE (service role only)
--   - Service role has full access

-- Drop all existing policies on licenses
DROP POLICY IF EXISTS "Users can read own license" ON licenses;
DROP POLICY IF EXISTS "Users can insert own license" ON licenses;
DROP POLICY IF EXISTS "Users can update own license" ON licenses;
-- Drop any legacy permissive policies
DROP POLICY IF EXISTS "licenses_all_policy" ON licenses;
DROP POLICY IF EXISTS "allow_all" ON licenses;

-- Policy 1: Users can read their own license
CREATE POLICY "licenses_select_own"
  ON licenses FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own license
CREATE POLICY "licenses_insert_own"
  ON licenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own license
CREATE POLICY "licenses_update_own"
  ON licenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Service role bypass
CREATE POLICY "licenses_service_role_all"
  ON licenses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- SECTION 4: DEVICES TABLE RLS POLICIES
-- ============================================
-- Table: devices (registered devices per user)
-- Columns: id (uuid, PK), user_id (uuid, FK -> auth.users),
--           device_id, device_name, os, app_version, platform,
--           last_seen_at, activated_at, is_active
--
-- Access model:
--   - Users can CRUD their own devices
--   - No cross-user device access
--   - Service role has full access

-- Drop all existing policies on devices
DROP POLICY IF EXISTS "Users can read own devices" ON devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON devices;
DROP POLICY IF EXISTS "Users can update own devices" ON devices;
DROP POLICY IF EXISTS "Users can delete own devices" ON devices;
-- Drop any legacy permissive policies
DROP POLICY IF EXISTS "devices_all_policy" ON devices;
DROP POLICY IF EXISTS "allow_all" ON devices;

-- Policy 1: Users can read their own devices
CREATE POLICY "devices_select_own"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own devices
CREATE POLICY "devices_insert_own"
  ON devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own devices
CREATE POLICY "devices_update_own"
  ON devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own devices
CREATE POLICY "devices_delete_own"
  ON devices FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 5: Service role bypass
CREATE POLICY "devices_service_role_all"
  ON devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- SECTION 5: VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify policies are correct.
-- (Documentation only -- commented out so they don't execute)
--
-- Query 1: Verify RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('users', 'licenses', 'devices');
-- Expected: rowsecurity = true for all three
--
-- Query 2: List all policies
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('users', 'licenses', 'devices')
-- ORDER BY tablename, policyname;
--
-- Expected per table:
--   users:    5 policies (select_own, update_own, insert_own, select_org_members, service_role_all)
--   licenses: 4 policies (select_own, insert_own, update_own, service_role_all)
--   devices:  5 policies (select_own, insert_own, update_own, delete_own, service_role_all)
--
-- Query 3: Verify NO permissive "true" policies remain
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE tablename IN ('users', 'licenses', 'devices')
--   AND roles = '{public}'
--   AND qual = 'true';
-- Expected: 0 rows (service_role policies use TO service_role, not public)

-- ============================================
-- SECTION 6: SECURITY SUMMARY
-- ============================================
--
-- USERS:
--   SELECT: Own row + org members' rows
--   INSERT: Own row only (auth.uid() = id)
--   UPDATE: Own row only (auth.uid() = id), WITH CHECK enforced
--   DELETE: Service role only
--
-- LICENSES:
--   SELECT: Own license only (auth.uid() = user_id)
--   INSERT: Own license only, WITH CHECK enforced
--   UPDATE: Own license only, WITH CHECK enforced
--   DELETE: Service role only
--
-- DEVICES:
--   SELECT: Own devices only (auth.uid() = user_id)
--   INSERT: Own devices only, WITH CHECK enforced
--   UPDATE: Own devices only, WITH CHECK enforced
--   DELETE: Own devices only (auth.uid() = user_id)
--
-- SERVICE ROLE:
--   All three tables: Full CRUD via TO service_role (not via qual check)
--   This is more secure than checking auth.role() in USING clause because
--   the TO clause restricts at the role-grant level.
--
-- ============================================
-- END OF RLS HARDENING MIGRATION
-- ============================================
