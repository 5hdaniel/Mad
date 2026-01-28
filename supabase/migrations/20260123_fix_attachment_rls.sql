-- ============================================
-- FIX: Attachment RLS Policy for Broker Access
-- Migration: 20260123_fix_attachment_rls
-- Issue: BACKLOG-420 - Attachments not displaying for brokers
-- ============================================

-- The existing policy uses IN with subqueries which may have issues
-- with RLS recursion. This migration adds a clearer EXISTS-based policy.

-- Drop the existing policy
DROP POLICY IF EXISTS "attachment_access_via_submission" ON submission_attachments;

-- Create a clearer policy using EXISTS
-- This explicitly checks:
-- 1. Agent who submitted can see their own attachments
-- 2. Brokers/admins in the same org can see attachments

CREATE POLICY "attachment_access_via_submission" ON submission_attachments
  FOR SELECT USING (
    -- Check if user has access to the parent submission
    EXISTS (
      SELECT 1 FROM transaction_submissions ts
      WHERE ts.id = submission_attachments.submission_id
      AND (
        -- Agent who submitted
        ts.submitted_by = auth.uid()
        OR
        -- Broker/admin in the same organization
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = ts.organization_id
          AND om.user_id = auth.uid()
          AND om.role IN ('broker', 'admin')
        )
      )
    )
  );

-- Also update the messages policy for consistency
DROP POLICY IF EXISTS "message_access_via_submission" ON submission_messages;

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
