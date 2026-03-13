-- ============================================
-- SUPPORT TICKETING: STORAGE RLS FIX
-- Migration: 20260313_support_storage_rls_fix
-- Purpose: Fix RLS nesting issue — customer storage policies subquery
--          support_tickets (which has RLS), causing the check to fail.
--          Solution: SECURITY DEFINER helper function bypasses RLS
--          for the ownership check.
-- Sprint: SPRINT-130 / BACKLOG-938
-- ============================================

-- Helper function to check if the current user is the ticket requester.
-- SECURITY DEFINER bypasses RLS on support_tickets for the ownership check,
-- avoiding the nested-RLS failure when called from storage policies.
CREATE OR REPLACE FUNCTION support_is_ticket_requester(p_ticket_id_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM support_tickets t
    WHERE t.id::text = p_ticket_id_text
    AND (
      t.requester_id = auth.uid()
      OR t.requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION support_is_ticket_requester TO authenticated;

-- Fix customer upload policy: use SECURITY DEFINER helper to avoid RLS nesting
DROP POLICY IF EXISTS "Customers can upload to own tickets" ON storage.objects;

CREATE POLICY "Customers can upload to own tickets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'support-attachments'
  AND auth.uid() IS NOT NULL
  AND support_is_ticket_requester(split_part(name, '/', 1))
);

-- Fix customer read policy: same RLS nesting fix
DROP POLICY IF EXISTS "Customers can read own ticket attachments" ON storage.objects;

CREATE POLICY "Customers can read own ticket attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'support-attachments'
  AND auth.uid() IS NOT NULL
  AND support_is_ticket_requester(split_part(name, '/', 1))
);
