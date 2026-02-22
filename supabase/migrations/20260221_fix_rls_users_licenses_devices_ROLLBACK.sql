-- ============================================
-- ROLLBACK: RLS HARDENING on users, licenses, devices
-- Migration: 20260221_fix_rls_users_licenses_devices
-- Task: TASK-2037 (BACKLOG-771)
-- ============================================
--
-- PURPOSE: Restore the previous RLS policies on users, licenses, devices
-- if the hardening migration causes issues.
--
-- WHEN TO USE:
--   - App cannot read/write user data after migration
--   - Device registration fails
--   - License validation fails
--   - Org members cannot see each other's names
--
-- HOW TO USE:
--   Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)
--   or via supabase db execute.
--
-- ============================================

-- ============================================
-- STEP 1: DROP NEW POLICIES
-- ============================================

-- Users
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_select_org_members" ON users;
DROP POLICY IF EXISTS "users_service_role_all" ON users;

-- Licenses
DROP POLICY IF EXISTS "licenses_select_own" ON licenses;
DROP POLICY IF EXISTS "licenses_insert_own" ON licenses;
DROP POLICY IF EXISTS "licenses_update_own" ON licenses;
DROP POLICY IF EXISTS "licenses_service_role_all" ON licenses;

-- Devices
DROP POLICY IF EXISTS "devices_select_own" ON devices;
DROP POLICY IF EXISTS "devices_insert_own" ON devices;
DROP POLICY IF EXISTS "devices_update_own" ON devices;
DROP POLICY IF EXISTS "devices_delete_own" ON devices;
DROP POLICY IF EXISTS "devices_service_role_all" ON devices;

-- ============================================
-- STEP 2: RESTORE PREVIOUS POLICIES
-- ============================================

-- Users: Restore original policies
CREATE POLICY "users_can_read_own_user" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_user" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_can_insert_own_user" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "org_members_can_read_org_users" ON users
  FOR SELECT USING (
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

CREATE POLICY "service_role_full_access_users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Licenses: Restore original policies (no service_role policy existed before)
CREATE POLICY "Users can read own license" ON licenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own license" ON licenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own license" ON licenses
  FOR UPDATE USING (auth.uid() = user_id);

-- Devices: Restore original policies (no service_role policy existed before)
CREATE POLICY "Users can read own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices" ON devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices" ON devices
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: VERIFY ROLLBACK
-- ============================================
-- Run this to confirm rollback was successful:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('users', 'licenses', 'devices')
-- ORDER BY tablename, policyname;

-- ============================================
-- END OF ROLLBACK
-- ============================================
