-- ============================================
-- STORAGE BUCKET POLICIES FOR SUBMISSION ATTACHMENTS
-- Migration: 20260122_storage_bucket_policies
-- Purpose: Enable RLS on submission-attachments bucket for broker access
-- Fixes: BACKLOG-420 - Attachments not displaying for brokers
-- ============================================

-- Note: The bucket 'submission-attachments' must be created first via
-- Supabase Dashboard or the storage API. This migration only creates the policies.

-- Path convention: {org_id}/{submission_id}/{filename}
-- Example: a0000000-0000-0000-0000-000000000001/sub123/document.pdf

-- ============================================
-- SELECT POLICY: Allow org members to view attachments in their org
-- ============================================
-- Uses split_part to extract org_id from the path (first segment before '/')

CREATE POLICY "Members can view submission attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'submission-attachments'
  AND (
    -- Extract org_id from storage path (first segment)
    split_part(name, '/', 1) IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);

-- ============================================
-- INSERT POLICY: Allow org members to upload to their org's folder
-- ============================================
-- Desktop app uses service role, but this allows portal uploads if needed

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
-- UPDATE POLICY: Allow members to update attachments in their org
-- ============================================
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
-- DELETE POLICY: Only admins can delete attachments
-- ============================================
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
