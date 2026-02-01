-- ============================================
-- RLS COMPLETE RESTORATION
-- Migration: 20260124_rls_restore_complete
-- Task: BACKLOG-419
-- Purpose: Ensure all RLS policies are properly configured (idempotent)
-- ============================================
--
-- BACKGROUND:
-- Portal actions and attachment display were failing, potentially due to
-- misconfigured RLS policies. This migration performs a complete audit
-- and restoration of all RLS policies to ensure:
--
--   1. RLS is enabled on all tables
--   2. All policies are properly defined
--   3. Storage bucket policies are configured
--   4. Brokers can perform all required operations
--
-- BROKER REQUIRED PERMISSIONS:
--   - Read submissions for their organization
--   - Update submission status (approve/reject/needs_changes)
--   - Read/write submission attachments
--   - Read submission messages
--   - Create/read comments
--
-- ============================================

-- ============================================
-- SECTION 1: VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 2: PROFILES TABLE
-- ============================================

DROP POLICY IF EXISTS "users_can_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access_profiles" ON profiles;

CREATE POLICY "users_can_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "service_role_full_access_profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 3: ORGANIZATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "members_can_read_org" ON organizations;
DROP POLICY IF EXISTS "admins_can_modify_org" ON organizations;
DROP POLICY IF EXISTS "service_role_full_access_organizations" ON organizations;

CREATE POLICY "members_can_read_org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_can_modify_org" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

CREATE POLICY "service_role_full_access_organizations" ON organizations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 4: ORGANIZATION_MEMBERS TABLE
-- ============================================

DROP POLICY IF EXISTS "members_can_read_org_members" ON organization_members;
DROP POLICY IF EXISTS "admins_can_manage_members" ON organization_members;
DROP POLICY IF EXISTS "users_can_accept_invite" ON organization_members;
DROP POLICY IF EXISTS "service_role_full_access_members" ON organization_members;

CREATE POLICY "members_can_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_can_manage_members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

CREATE POLICY "users_can_accept_invite" ON organization_members
  FOR UPDATE USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "service_role_full_access_members" ON organization_members
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 5: TRANSACTION_SUBMISSIONS TABLE
-- ============================================
-- BROKER CRITICAL: Brokers must be able to:
--   - Read all submissions in their org
--   - Update submission status (approve/reject)

DROP POLICY IF EXISTS "agents_can_read_own_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_read_org_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "agents_can_create_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "agents_can_update_own_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_review_submissions" ON transaction_submissions;
DROP POLICY IF EXISTS "service_role_full_access_submissions" ON transaction_submissions;

-- Agents can read their own submissions
CREATE POLICY "agents_can_read_own_submissions" ON transaction_submissions
  FOR SELECT USING (
    submitted_by = auth.uid()
  );

-- Brokers/admins can read ALL submissions in their organization
CREATE POLICY "brokers_can_read_org_submissions" ON transaction_submissions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Agents can create submissions in their organization
CREATE POLICY "agents_can_create_submissions" ON transaction_submissions
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Agents can update their submissions when broker requests changes
CREATE POLICY "agents_can_update_own_submissions" ON transaction_submissions
  FOR UPDATE USING (
    submitted_by = auth.uid()
    AND status = 'needs_changes'
  );

-- Brokers/admins can update any submission in their org (for status changes)
CREATE POLICY "brokers_can_review_submissions" ON transaction_submissions
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Service role bypass
CREATE POLICY "service_role_full_access_submissions" ON transaction_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 6: SUBMISSION_MESSAGES TABLE
-- ============================================

DROP POLICY IF EXISTS "message_access_via_submission" ON submission_messages;
DROP POLICY IF EXISTS "agents_can_insert_messages" ON submission_messages;
DROP POLICY IF EXISTS "service_role_full_access_messages" ON submission_messages;

-- Users can read messages on submissions they have access to
CREATE POLICY "message_access_via_submission" ON submission_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_messages.submission_id
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

-- Agents can insert messages with their submissions
CREATE POLICY "agents_can_insert_messages" ON submission_messages
  FOR INSERT WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );

-- Service role bypass
CREATE POLICY "service_role_full_access_messages" ON submission_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 7: SUBMISSION_ATTACHMENTS TABLE
-- ============================================
-- BROKER CRITICAL: Brokers must be able to read attachments

DROP POLICY IF EXISTS "attachment_access_via_submission" ON submission_attachments;
DROP POLICY IF EXISTS "agents_can_insert_attachments" ON submission_attachments;
DROP POLICY IF EXISTS "service_role_full_access_attachments" ON submission_attachments;

-- Users can read attachments on submissions they have access to
CREATE POLICY "attachment_access_via_submission" ON submission_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_attachments.submission_id
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

-- Agents can insert attachments with their submissions
CREATE POLICY "agents_can_insert_attachments" ON submission_attachments
  FOR INSERT WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );

-- Service role bypass
CREATE POLICY "service_role_full_access_attachments" ON submission_attachments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 8: SUBMISSION_COMMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "comment_access_via_submission" ON submission_comments;
DROP POLICY IF EXISTS "users_can_create_comments" ON submission_comments;
DROP POLICY IF EXISTS "service_role_full_access_comments" ON submission_comments;

-- Users can see comments on submissions they have access to
-- Internal comments only visible to brokers/admins
CREATE POLICY "comment_access_via_submission" ON submission_comments
  FOR SELECT USING (
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

-- Users can create comments on submissions they have access to
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

-- Service role bypass
CREATE POLICY "service_role_full_access_comments" ON submission_comments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SECTION 9: STORAGE BUCKET POLICIES
-- ============================================
-- These are critical for attachment display!
-- Bucket: submission-attachments
-- Path convention: {org_id}/{submission_id}/{filename}

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Members can view submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members can update submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete submission attachments" ON storage.objects;

-- SELECT: Org members can view attachments in their org
CREATE POLICY "Members can view submission attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submission-attachments'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);

-- INSERT: Org members can upload to their org's folder
CREATE POLICY "Members can upload submission attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'submission-attachments'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);

-- UPDATE: Org members can update attachments in their org
CREATE POLICY "Members can update submission attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'submission-attachments'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);

-- DELETE: Only admins can delete attachments (audit trail)
CREATE POLICY "Admins can delete submission attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'submission-attachments'
  AND (
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  )
);

-- ============================================
-- SECTION 10: RLS POLICY SUMMARY
-- ============================================
--
-- PROFILES:
--   SELECT: Own profile only
--   UPDATE: Own profile only
--   INSERT: Via trigger (SECURITY DEFINER)
--   DELETE: Service role only
--
-- ORGANIZATIONS:
--   SELECT: Members only
--   UPDATE: Admin/IT Admin only
--   INSERT/DELETE: Service role only
--
-- ORGANIZATION_MEMBERS:
--   SELECT: Members can see other members
--   INSERT/UPDATE/DELETE: Admin/IT Admin or invite accept
--
-- TRANSACTION_SUBMISSIONS:
--   SELECT: Own OR broker/admin in org
--   INSERT: Members in org
--   UPDATE: Owner (needs_changes) OR broker/admin
--   DELETE: Service role only
--
-- SUBMISSION_MESSAGES:
--   SELECT: Via parent submission
--   INSERT: Owner of parent
--   UPDATE/DELETE: Service role only
--
-- SUBMISSION_ATTACHMENTS:
--   SELECT: Via parent submission
--   INSERT: Owner of parent
--   UPDATE/DELETE: Service role only
--
-- SUBMISSION_COMMENTS:
--   SELECT: Via parent (internal=broker only)
--   INSERT: Users with submission access
--   UPDATE/DELETE: Service role only
--
-- STORAGE (submission-attachments bucket):
--   SELECT/INSERT/UPDATE: Org members
--   DELETE: Admin only
--
-- ============================================
-- END OF RLS RESTORATION
-- ============================================
