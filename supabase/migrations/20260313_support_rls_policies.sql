-- ============================================
-- SUPPORT TICKETING: RLS POLICIES
-- Migration: 20260313_support_rls_policies
-- Purpose: Enable RLS and create ~25 SELECT-only policies for dual-audience access
-- Sprint: SPRINT-130 / TASK-2171
-- ============================================
-- Core principle: Tables are READ-ONLY at RLS level.
-- ALL writes go through SECURITY DEFINER RPCs.
-- Agent detection: EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
-- Customer detection: requester_id = auth.uid() OR requester_email matches user email
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL 6 TABLES
-- ============================================
ALTER TABLE support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- support_categories: Everyone can read (including anon for the public form)
-- ============================================
CREATE POLICY "Anyone can view active categories"
  ON support_categories FOR SELECT
  USING (is_active = true);

-- ============================================
-- support_tickets: Agents see all, customers see own only
-- ============================================

-- Agents (internal_roles users) can see all tickets
CREATE POLICY "Agents can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Authenticated customers can see their own tickets (by requester_id)
CREATE POLICY "Customers can view own tickets by id"
  ON support_tickets FOR SELECT
  USING (
    requester_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Authenticated customers can also see tickets by email match
CREATE POLICY "Customers can view own tickets by email"
  ON support_tickets FOR SELECT
  USING (
    requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- support_ticket_messages: Agents see all, customers see non-internal-note only
-- ============================================

-- Agents see all messages (including internal notes)
CREATE POLICY "Agents can view all messages"
  ON support_ticket_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Customers see only public replies on their own tickets
CREATE POLICY "Customers can view public messages on own tickets"
  ON support_ticket_messages FOR SELECT
  USING (
    message_type != 'internal_note'
    AND EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- support_ticket_attachments: Agents see all, customers see own ticket attachments
-- ============================================

-- Agents see all attachments
CREATE POLICY "Agents can view all attachments"
  ON support_ticket_attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Customers see attachments on their own tickets (non-internal-note messages only)
CREATE POLICY "Customers can view attachments on own tickets"
  ON support_ticket_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND (
      message_id IS NULL
      OR EXISTS (
        SELECT 1 FROM support_ticket_messages m
        WHERE m.id = message_id AND m.message_type != 'internal_note'
      )
    )
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- support_ticket_events: Agents see all, customers see own ticket events
-- ============================================

-- Agents see all events
CREATE POLICY "Agents can view all events"
  ON support_ticket_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Customers see events on their own tickets
CREATE POLICY "Customers can view events on own tickets"
  ON support_ticket_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- support_ticket_participants: Agents see all, customers see own ticket participants
-- ============================================

-- Agents see all participants
CREATE POLICY "Agents can view all participants"
  ON support_ticket_participants FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- Customers see participants on their own tickets
CREATE POLICY "Customers can view participants on own tickets"
  ON support_ticket_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
    AND NOT EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
  );

-- ============================================
-- GRANT SELECT ON SUPPORT TABLES TO anon AND authenticated
-- (RLS controls what they actually see)
-- ============================================
GRANT SELECT ON support_categories TO anon;
GRANT SELECT ON support_categories TO authenticated;
GRANT SELECT ON support_tickets TO authenticated;
GRANT SELECT ON support_ticket_messages TO authenticated;
GRANT SELECT ON support_ticket_attachments TO authenticated;
GRANT SELECT ON support_ticket_events TO authenticated;
GRANT SELECT ON support_ticket_participants TO authenticated;
