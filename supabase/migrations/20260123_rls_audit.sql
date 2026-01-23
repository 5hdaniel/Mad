-- ============================================
-- RLS AUDIT AND RESTORATION
-- Migration: 20260123_rls_audit
-- Task: BACKLOG-419
-- Purpose: Comprehensive audit of RLS policies across all tables
-- ============================================
--
-- AUDIT SUMMARY:
-- This migration audits and ensures proper RLS configuration for:
--   1. profiles - User profile data (extends auth.users)
--   2. organizations - Organization/brokerage data
--   3. organization_members - User-org membership junction
--   4. transaction_submissions - Transaction audit submissions
--   5. submission_messages - Messages within submissions
--   6. submission_attachments - Files attached to submissions
--   7. submission_comments - Broker feedback on submissions
--
-- KEY RLS RULES:
--   - Users can only see/edit their own profile
--   - Organization members can see their org's data
--   - Brokers/admins can see all submissions in their org
--   - Agents can only see their own submissions
--   - Internal comments are only visible to brokers
--   - Service role has full access (for desktop app backend)
--
-- ============================================

-- ============================================
-- SECTION 1: VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================
-- Re-enable RLS on all tables (idempotent - safe to run multiple times)
-- If RLS was disabled during troubleshooting, this restores it.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 2: PROFILES TABLE RLS POLICIES
-- ============================================
-- Table: profiles (extends auth.users with additional data)
-- Security: Users can only access their own profile
--
-- Existing policies (from 20260122_b2b_broker_portal.sql):
--   - users_can_read_own_profile: SELECT where id = auth.uid()
--   - users_can_update_own_profile: UPDATE where id = auth.uid()
--   - service_role_full_access_profiles: ALL where auth.role() = 'service_role'
--
-- Gap Analysis: No INSERT policy exists. Profile creation is handled by trigger
-- (handle_new_user_profile) which runs with SECURITY DEFINER, so no user INSERT needed.

-- Ensure policies exist (drop and recreate for clean state)
DROP POLICY IF EXISTS "users_can_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access_profiles" ON profiles;

-- Policy 1: Users can read their own profile
CREATE POLICY "users_can_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Policy 2: Users can update their own profile
CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Policy 3: Service role bypass (for desktop app using service key)
CREATE POLICY "service_role_full_access_profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 3: ORGANIZATIONS TABLE RLS POLICIES
-- ============================================
-- Table: organizations (brokerage/company data)
-- Security: Only members can see their org, only admins can modify
--
-- Existing policies:
--   - members_can_read_org: SELECT for members
--   - admins_can_modify_org: UPDATE for admin/it_admin
--   - service_role_full_access_organizations: ALL for service role
--
-- Gap Analysis: No INSERT policy. Org creation happens via service role or
-- needs to be done by system. This is intentional - orgs aren't user-created.

DROP POLICY IF EXISTS "members_can_read_org" ON organizations;
DROP POLICY IF EXISTS "admins_can_modify_org" ON organizations;
DROP POLICY IF EXISTS "service_role_full_access_organizations" ON organizations;

-- Policy 1: Members can read their organization
CREATE POLICY "members_can_read_org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Admins can modify organization settings
CREATE POLICY "admins_can_modify_org" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

-- Policy 3: Service role bypass
CREATE POLICY "service_role_full_access_organizations" ON organizations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 4: ORGANIZATION_MEMBERS TABLE RLS POLICIES
-- ============================================
-- Table: organization_members (user-org junction, invitations)
-- Security: Members can see other members, admins can manage, users can accept invites
--
-- Existing policies:
--   - members_can_read_org_members: SELECT for members
--   - admins_can_manage_members: ALL for admin/it_admin
--   - users_can_accept_invite: UPDATE for invited email match
--   - service_role_full_access_members: ALL for service role
--
-- Gap Analysis: The admins_can_manage_members allows ALL, but the subquery
-- checks if the user is admin in that org. This is correct but could be
-- clearer. No issues found.

DROP POLICY IF EXISTS "members_can_read_org_members" ON organization_members;
DROP POLICY IF EXISTS "admins_can_manage_members" ON organization_members;
DROP POLICY IF EXISTS "users_can_accept_invite" ON organization_members;
DROP POLICY IF EXISTS "service_role_full_access_members" ON organization_members;

-- Policy 1: Members can see other members in their organization
CREATE POLICY "members_can_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Admins can manage members (CRUD operations)
CREATE POLICY "admins_can_manage_members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

-- Policy 3: Users can accept invitations sent to their email
-- This allows a user to UPDATE their membership record to link user_id
CREATE POLICY "users_can_accept_invite" ON organization_members
  FOR UPDATE USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy 4: Service role bypass
CREATE POLICY "service_role_full_access_members" ON organization_members
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 5: TRANSACTION_SUBMISSIONS TABLE RLS POLICIES
-- ============================================
-- Table: transaction_submissions (cloud copy of desktop transactions)
-- Security:
--   - Agents see only their own submissions
--   - Brokers/admins see all org submissions
--   - Agents can create in their org
--   - Agents can update when status='needs_changes'
--   - Brokers can update status (approve/reject)
--
-- Existing policies:
--   - agents_can_read_own_submissions: SELECT for submitted_by = uid
--   - brokers_can_read_org_submissions: SELECT for broker/admin in org
--   - agents_can_create_submissions: INSERT with org membership check
--   - agents_can_update_own_submissions: UPDATE when needs_changes
--   - brokers_can_review_submissions: UPDATE for broker/admin
--   - service_role_full_access_submissions: ALL for service role
--
-- Gap Analysis: No DELETE policy. This is intentional - submissions should
-- not be deleted by users (audit trail). Service role can delete if needed.

DROP POLICY IF EXISTS "agents_can_read_own_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_read_org_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "agents_can_create_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "agents_can_update_own_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_review_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "service_role_full_access_submissions" ON transaction_submissions;

-- Policy 1: Agents can read their own submissions
CREATE POLICY "agents_can_read_own_submissions" ON transaction_submissions
  FOR SELECT USING (
    submitted_by = auth.uid()
  );

-- Policy 2: Brokers/admins can read all submissions in their organization
CREATE POLICY "brokers_can_read_org_submissions" ON transaction_submissions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Policy 3: Agents can create submissions in their organization
CREATE POLICY "agents_can_create_submissions" ON transaction_submissions
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy 4: Agents can update their submissions when broker requests changes
CREATE POLICY "agents_can_update_own_submissions" ON transaction_submissions
  FOR UPDATE USING (
    submitted_by = auth.uid()
    AND status = 'needs_changes'
  );

-- Policy 5: Brokers/admins can update submission status (approve/reject/review)
CREATE POLICY "brokers_can_review_submissions" ON transaction_submissions
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Policy 6: Service role bypass
CREATE POLICY "service_role_full_access_submissions" ON transaction_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 6: SUBMISSION_MESSAGES TABLE RLS POLICIES
-- ============================================
-- Table: submission_messages (email/SMS communications in a submission)
-- Security: Same as parent submission
--
-- Existing policies (updated in 20260123_fix_attachment_rls.sql):
--   - message_access_via_submission: SELECT using EXISTS
--   - agents_can_insert_messages: INSERT for own submissions
--   - service_role_full_access_messages: ALL for service role
--
-- Gap Analysis: No UPDATE or DELETE policies. This is intentional -
-- messages are immutable once submitted (audit trail).

DROP POLICY IF EXISTS "message_access_via_submission" ON submission_messages;
DROP POLICY IF EXISTS "agents_can_insert_messages" ON submission_messages;
DROP POLICY IF EXISTS "service_role_full_access_messages" ON submission_messages;

-- Policy 1: Users can read messages on submissions they have access to
-- Uses EXISTS pattern for better performance (from fix_attachment_rls)
CREATE POLICY "message_access_via_submission" ON submission_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_messages.submission_id
      AND (
        -- Agent who submitted can see messages
        ts.submitted_by = auth.uid()
        OR
        -- Broker/admin in the same organization can see messages
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ts.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('broker', 'admin')
        )
      )
    )
  );

-- Policy 2: Agents can insert messages with their submissions
CREATE POLICY "agents_can_insert_messages" ON submission_messages
  FOR INSERT WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );

-- Policy 3: Service role bypass
CREATE POLICY "service_role_full_access_messages" ON submission_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 7: SUBMISSION_ATTACHMENTS TABLE RLS POLICIES
-- ============================================
-- Table: submission_attachments (files attached to submissions)
-- Security: Same as parent submission
--
-- Existing policies (updated in 20260123_fix_attachment_rls.sql):
--   - attachment_access_via_submission: SELECT using EXISTS
--   - agents_can_insert_attachments: INSERT for own submissions
--   - service_role_full_access_attachments: ALL for service role
--
-- Gap Analysis: No UPDATE or DELETE policies. This is intentional -
-- attachments are immutable once submitted (audit trail).

DROP POLICY IF EXISTS "attachment_access_via_submission" ON submission_attachments;
DROP POLICY IF EXISTS "agents_can_insert_attachments" ON submission_attachments;
DROP POLICY IF EXISTS "service_role_full_access_attachments" ON submission_attachments;

-- Policy 1: Users can read attachments on submissions they have access to
-- Uses EXISTS pattern for better performance
CREATE POLICY "attachment_access_via_submission" ON submission_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_attachments.submission_id
      AND (
        -- Agent who submitted can see attachments
        ts.submitted_by = auth.uid()
        OR
        -- Broker/admin in the same organization can see attachments
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ts.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('broker', 'admin')
        )
      )
    )
  );

-- Policy 2: Agents can insert attachments with their submissions
CREATE POLICY "agents_can_insert_attachments" ON submission_attachments
  FOR INSERT WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );

-- Policy 3: Service role bypass
CREATE POLICY "service_role_full_access_attachments" ON submission_attachments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 8: SUBMISSION_COMMENTS TABLE RLS POLICIES
-- ============================================
-- Table: submission_comments (broker feedback, review notes)
-- Security:
--   - Users can see comments on accessible submissions
--   - Internal comments (is_internal=true) only visible to brokers
--   - Users can create comments on their accessible submissions
--
-- Existing policies:
--   - comment_access_via_submission: SELECT with internal comment check
--   - users_can_create_comments: INSERT with access check
--   - service_role_full_access_comments: ALL for service role
--
-- Gap Analysis: No UPDATE or DELETE policies. This is intentional -
-- comments are immutable (audit trail). Consider adding UPDATE for
-- typo fixes if needed in future.

DROP POLICY IF EXISTS "comment_access_via_submission" ON submission_comments;
DROP POLICY IF EXISTS "users_can_create_comments" ON submission_comments;
DROP POLICY IF EXISTS "service_role_full_access_comments" ON submission_comments;

-- Policy 1: Users can see comments on submissions they have access to
-- Internal comments are only visible to brokers/admins
CREATE POLICY "comment_access_via_submission" ON submission_comments
  FOR SELECT USING (
    -- First check: user has access to the submission
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_comments.submission_id
      AND (
        ts.submitted_by = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ts.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('broker', 'admin')
        )
      )
    )
    -- Second check: internal comments only visible to brokers
    AND (
      is_internal = false
      OR
      EXISTS (
        SELECT 1 FROM transaction_submissions ts
        JOIN organization_members om ON ts.organization_id = om.organization_id
        WHERE ts.id = submission_comments.submission_id
        AND om.user_id = auth.uid()
        AND om.role IN ('broker', 'admin')
      )
    )
  );

-- Policy 2: Users can create comments on submissions they have access to
CREATE POLICY "users_can_create_comments" ON submission_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_comments.submission_id
      AND (
        ts.submitted_by = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ts.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('broker', 'admin')
        )
      )
    )
  );

-- Policy 3: Service role bypass
CREATE POLICY "service_role_full_access_comments" ON submission_comments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 9: AUDIT VERIFICATION QUERIES
-- ============================================
-- Run these queries after migration to verify RLS is properly configured.
-- These are for documentation/manual verification only.

-- Query 1: Check RLS is enabled on all tables
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN (
--   'profiles', 'organizations', 'organization_members',
--   'transaction_submissions', 'submission_messages',
--   'submission_attachments', 'submission_comments'
-- );
-- Expected: rowsecurity = true for all

-- Query 2: List all policies by table
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'profiles', 'organizations', 'organization_members',
--   'transaction_submissions', 'submission_messages',
--   'submission_attachments', 'submission_comments'
-- )
-- ORDER BY tablename, policyname;

-- ============================================
-- SECTION 10: SECURITY SUMMARY
-- ============================================
--
-- PROFILES:
--   - SELECT: Own profile only
--   - UPDATE: Own profile only
--   - INSERT: Via trigger (SECURITY DEFINER)
--   - DELETE: Service role only
--
-- ORGANIZATIONS:
--   - SELECT: Members only
--   - UPDATE: Admin/IT Admin only
--   - INSERT: Service role only
--   - DELETE: Service role only
--
-- ORGANIZATION_MEMBERS:
--   - SELECT: Members can see other members
--   - INSERT: Admin/IT Admin only
--   - UPDATE: Admin or invited user accepting
--   - DELETE: Admin/IT Admin only
--
-- TRANSACTION_SUBMISSIONS:
--   - SELECT: Own submissions OR broker/admin in org
--   - INSERT: Members in org
--   - UPDATE: Owner (when needs_changes) OR broker/admin
--   - DELETE: Service role only (audit trail)
--
-- SUBMISSION_MESSAGES:
--   - SELECT: Via parent submission access
--   - INSERT: Owner of parent submission
--   - UPDATE/DELETE: Service role only (immutable)
--
-- SUBMISSION_ATTACHMENTS:
--   - SELECT: Via parent submission access
--   - INSERT: Owner of parent submission
--   - UPDATE/DELETE: Service role only (immutable)
--
-- SUBMISSION_COMMENTS:
--   - SELECT: Via parent submission (internal comments broker-only)
--   - INSERT: Users with submission access
--   - UPDATE/DELETE: Service role only (immutable)
--
-- ============================================
-- END OF RLS AUDIT MIGRATION
-- ============================================
