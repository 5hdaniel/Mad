-- ============================================
-- FIX: Storage Bucket Policies for Broker Attachments
-- Migration: 20260123_fix_storage_bucket_policies
-- Task: BACKLOG-420
-- Purpose: Ensure storage bucket RLS policies are properly configured
-- ============================================
--
-- Issue: Attachments not displaying in broker portal.
-- Root cause: Storage bucket policies may not have been applied correctly.
--
-- This migration:
-- 1. Drops existing storage policies (if any)
-- 2. Re-creates them with proper configuration
-- 3. Uses IF NOT EXISTS for idempotency
--
-- Note: The bucket 'submission-attachments' must be created via Supabase
-- Dashboard with "RLS enabled" (private bucket). This migration only
-- handles the policies.
--
-- Path convention: {org_id}/{submission_id}/{filename}
-- Example: a0000000-0000-0000-0000-000000000001/sub123/document.pdf
--
-- ============================================

-- ============================================
-- SECTION 1: DROP EXISTING POLICIES
-- ============================================
-- Remove any existing policies to ensure clean state

DROP POLICY IF EXISTS "Members can view submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Members can update submission attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete submission attachments" ON storage.objects;

-- Also drop any legacy/incorrectly named policies
DROP POLICY IF EXISTS "submission_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "submission_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "submission_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "submission_attachments_delete" ON storage.objects;

-- ============================================
-- SECTION 2: CREATE SELECT POLICY
-- ============================================
-- Allow organization members to view attachments in their org's folders
-- Uses split_part to extract org_id from the path (first segment before '/')
-- Compares as text to avoid UUID casting issues with the path string

CREATE POLICY "Members can view submission attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submission-attachments'
  AND (
    -- Check if user is a member of the organization that owns this file
    -- The org_id is the first segment of the storage path (before first '/')
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);

-- ============================================
-- SECTION 3: CREATE INSERT POLICY
-- ============================================
-- Allow organization members to upload to their org's folder
-- Desktop app uses service role, but this enables portal uploads if needed

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

-- ============================================
-- SECTION 4: CREATE UPDATE POLICY
-- ============================================
-- Allow members to update attachments in their org

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

-- ============================================
-- SECTION 5: CREATE DELETE POLICY
-- ============================================
-- Only admins/IT admins can delete attachments

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
-- VERIFICATION QUERIES (for manual testing)
-- ============================================
-- Run these after applying migration to verify policies exist:
--
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE tablename = 'objects'
-- AND schemaname = 'storage'
-- AND policyname LIKE '%submission attachments%';
--
-- Expected output:
-- - Members can view submission attachments | objects | SELECT
-- - Members can upload submission attachments | objects | INSERT
-- - Members can update submission attachments | objects | UPDATE
-- - Admins can delete submission attachments | objects | DELETE
--
-- ============================================
-- END OF STORAGE POLICY FIX
-- ============================================
