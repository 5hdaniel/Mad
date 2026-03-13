-- ============================================
-- SUPPORT TICKETING: SCHEMA
-- Migration: 20260313_support_schema
-- Purpose: Create 6 support tables, indexes, triggers, full-text search
-- Sprint: SPRINT-130 / TASK-2171
-- ============================================

-- ============================================
-- 1. support_categories (must be FIRST due to FK references)
-- ============================================
CREATE TABLE support_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES support_categories(id),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. support_tickets
-- ============================================
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ticket_type TEXT,
  category_id UUID REFERENCES support_categories(id),
  subcategory_id UUID REFERENCES support_categories(id),
  requester_id UUID REFERENCES auth.users(id),
  requester_email TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  source_channel TEXT NOT NULL DEFAULT 'web_form' CHECK (source_channel IN ('web_form', 'email', 'in_app_redirect', 'admin_created')),
  pending_reason TEXT CHECK (pending_reason IS NULL OR pending_reason IN ('customer', 'vendor', 'internal')),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reopened_count INT DEFAULT 0,
  sla_first_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_first_response_met BOOLEAN,
  sla_resolution_met BOOLEAN,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. support_ticket_messages
-- ============================================
CREATE TABLE support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_email TEXT,
  sender_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'reply' CHECK (message_type IN ('reply', 'internal_note')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. support_ticket_attachments
-- ============================================
CREATE TABLE support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. support_ticket_events
-- ============================================
CREATE TABLE support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. support_ticket_participants
-- ============================================
CREATE TABLE support_ticket_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'cc' CHECK (role IN ('cc', 'watcher')),
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, email)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assignee ON support_tickets(assignee_id);
CREATE INDEX idx_support_tickets_requester ON support_tickets(requester_id);
CREATE INDEX idx_support_tickets_requester_email ON support_tickets(requester_email);
CREATE INDEX idx_support_tickets_category ON support_tickets(category_id);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX idx_support_ticket_events_ticket ON support_ticket_events(ticket_id, created_at);
CREATE INDEX idx_support_ticket_attachments_ticket ON support_ticket_attachments(ticket_id);
CREATE INDEX idx_support_ticket_participants_ticket ON support_ticket_participants(ticket_id);
CREATE INDEX idx_support_categories_parent ON support_categories(parent_id);
CREATE INDEX idx_support_tickets_search ON support_tickets USING GIN (search_vector);

-- ============================================
-- TRIGGERS: updated_at
-- ============================================
CREATE FUNCTION support_tickets_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_updated_at();

-- ============================================
-- TRIGGERS: full-text search vector
-- ============================================
CREATE FUNCTION support_tickets_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.subject, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_search_update
  BEFORE INSERT OR UPDATE OF subject, description ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_search_trigger();
