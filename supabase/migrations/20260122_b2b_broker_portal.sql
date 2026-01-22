-- ============================================
-- B2B BROKER PORTAL SCHEMA
-- Migration: 20260122_b2b_broker_portal
-- Purpose: Organizations, submissions, broker review workflow
-- ============================================

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- for URLs: acme-realty

  -- Plan & Limits
  plan VARCHAR(50) DEFAULT 'trial' CHECK (plan IN ('trial', 'pro', 'enterprise')),
  max_seats INTEGER DEFAULT 5,

  -- Compliance Settings
  retention_years INTEGER DEFAULT 7,  -- archive retention period
  require_dual_approval BOOLEAN DEFAULT false,  -- two brokers must approve
  auto_reject_incomplete BOOLEAN DEFAULT false,
  minimum_attachment_types TEXT[],  -- required doc types

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION MEMBERS (User-Org Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL until user accepts invite

  -- Role & Status
  role VARCHAR(50) NOT NULL CHECK (role IN ('agent', 'broker', 'admin', 'it_admin')),
  license_status VARCHAR(50) DEFAULT 'pending' CHECK (license_status IN ('pending', 'active', 'suspended', 'expired')),

  -- Invitation Flow
  invited_email TEXT,  -- email invited (may differ from user's email)
  invitation_token TEXT UNIQUE,  -- for invitation links
  invitation_expires_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,  -- when user accepted invite

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- ============================================
-- TRANSACTION SUBMISSIONS (Cloud Copy of Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id),  -- the agent

  -- Transaction Data (denormalized snapshot from desktop)
  local_transaction_id TEXT NOT NULL,  -- ID from desktop SQLite
  property_address TEXT NOT NULL,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  transaction_type VARCHAR(50) CHECK (transaction_type IN ('purchase', 'sale', 'other')),
  listing_price NUMERIC,
  sale_price NUMERIC,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Review Workflow
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN (
    'draft',        -- agent started but not submitted
    'submitted',    -- agent submitted, waiting for review
    'under_review', -- broker started reviewing
    'needs_changes', -- broker requested changes
    'resubmitted',  -- agent resubmitted after changes
    'approved',     -- broker approved
    'rejected'      -- broker rejected
  )),
  reviewed_by UUID REFERENCES users(id),  -- the broker
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,  -- broker's feedback

  -- Versioning (for resubmissions)
  version INTEGER DEFAULT 1,
  parent_submission_id UUID REFERENCES transaction_submissions(id),

  -- Deadline Tracking
  review_deadline TIMESTAMPTZ,  -- SLA for broker review

  -- Counts (denormalized for performance)
  message_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,

  -- Metadata
  submission_metadata JSONB,  -- detection_source, confidence, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, local_transaction_id, version)
);

-- ============================================
-- SUBMISSION MESSAGES (Communications)
-- ============================================
CREATE TABLE IF NOT EXISTS submission_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  local_message_id TEXT,  -- ID from desktop

  -- Message Data
  channel VARCHAR(50) CHECK (channel IN ('email', 'sms', 'imessage')),
  direction VARCHAR(50) CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body_text TEXT,
  participants JSONB,  -- {from, to, cc, bcc}
  sent_at TIMESTAMPTZ,
  thread_id TEXT,

  -- Attachment Info
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBMISSION ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES submission_messages(id) ON DELETE SET NULL,

  -- File Info
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes INTEGER,
  storage_path TEXT NOT NULL,  -- Supabase Storage path

  -- Document Classification
  document_type VARCHAR(50) CHECK (document_type IN (
    'offer', 'inspection', 'disclosure', 'contract',
    'appraisal', 'amendment', 'addendum', 'title',
    'closing', 'correspondence', 'other'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBMISSION COMMENTS (Broker Feedback)
-- ============================================
CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  -- Optional: Comment on specific item
  message_id UUID REFERENCES submission_messages(id) ON DELETE CASCADE,
  attachment_id UUID REFERENCES submission_attachments(id) ON DELETE CASCADE,

  -- Comment Content
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,  -- broker-only vs visible to agent

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_email ON organization_members(invited_email);
CREATE INDEX IF NOT EXISTS idx_org_members_invitation_token ON organization_members(invitation_token);

CREATE INDEX IF NOT EXISTS idx_submissions_org_id ON transaction_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON transaction_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON transaction_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON transaction_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_local_txn_id ON transaction_submissions(local_transaction_id);

CREATE INDEX IF NOT EXISTS idx_submission_messages_submission_id ON submission_messages(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_sent_at ON submission_messages(sent_at);

CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id ON submission_attachments(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_message_id ON submission_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_id ON submission_comments(submission_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Organizations
-- ============================================

-- Users can read orgs they belong to
CREATE POLICY "members_can_read_org" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can modify org settings
CREATE POLICY "admins_can_modify_org" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

-- Service role has full access (for desktop app using service key)
CREATE POLICY "service_role_full_access_organizations" ON organizations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- RLS POLICIES - Organization Members
-- ============================================

-- Members can see other members in their org
CREATE POLICY "members_can_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins can manage members
CREATE POLICY "admins_can_manage_members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'it_admin')
    )
  );

-- Users can update their own membership (accept invite)
CREATE POLICY "users_can_accept_invite" ON organization_members
  FOR UPDATE USING (
    invited_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_members" ON organization_members
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- RLS POLICIES - Transaction Submissions
-- ============================================

-- Agents can see their own submissions
CREATE POLICY "agents_can_read_own_submissions" ON transaction_submissions
  FOR SELECT USING (
    submitted_by = auth.uid()
  );

-- Brokers/admins can see all submissions in their org
CREATE POLICY "brokers_can_read_org_submissions" ON transaction_submissions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Agents can create submissions in their org
CREATE POLICY "agents_can_create_submissions" ON transaction_submissions
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Agents can update their own draft/needs_changes submissions
CREATE POLICY "agents_can_update_own_submissions" ON transaction_submissions
  FOR UPDATE USING (
    submitted_by = auth.uid()
    AND status IN ('draft', 'needs_changes')
  );

-- Brokers can update submission status (approve/reject)
CREATE POLICY "brokers_can_review_submissions" ON transaction_submissions
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('broker', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_submissions" ON transaction_submissions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- RLS POLICIES - Submission Messages
-- ============================================

-- Same access as parent submission
CREATE POLICY "message_access_via_submission" ON submission_messages
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('broker', 'admin')
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

-- Service role has full access
CREATE POLICY "service_role_full_access_messages" ON submission_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- RLS POLICIES - Submission Attachments
-- ============================================

-- Same access as parent submission
CREATE POLICY "attachment_access_via_submission" ON submission_attachments
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('broker', 'admin')
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

-- Service role has full access
CREATE POLICY "service_role_full_access_attachments" ON submission_attachments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- RLS POLICIES - Submission Comments
-- ============================================

-- Users can see comments on submissions they have access to
CREATE POLICY "comment_access_via_submission" ON submission_comments
  FOR SELECT USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('broker', 'admin')
      )
    )
    -- Internal comments only visible to brokers
    AND (
      is_internal = false
      OR submission_id IN (
        SELECT ts.id FROM transaction_submissions ts
        JOIN organization_members om ON ts.organization_id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND om.role IN ('broker', 'admin')
      )
    )
  );

-- Users can create comments on submissions they have access to
CREATE POLICY "users_can_create_comments" ON submission_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('broker', 'admin')
      )
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_comments" ON submission_comments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON transaction_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Link pending invitations on user signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user_invitation_link()
RETURNS TRIGGER AS $$
BEGIN
  -- Link any pending invitations by email
  UPDATE organization_members
  SET
    user_id = NEW.id,
    joined_at = NOW(),
    license_status = 'active'
  WHERE invited_email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger should be attached to auth.users if using Supabase Auth
-- For now with custom auth, call this function manually after user creation

-- ============================================
-- STORAGE BUCKET (Run in Supabase Dashboard)
-- ============================================
-- Note: Storage bucket creation must be done via Supabase Dashboard or API
--
-- Bucket: submission-attachments
-- Public: false
-- File size limit: 50MB
-- Allowed MIME types: application/pdf, image/*, application/msword,
--   application/vnd.openxmlformats-officedocument.*, text/plain
--
-- Storage RLS Policy (create in Dashboard):
--
-- SELECT: Allow access if user is in the same org
-- INSERT: Allow if user is agent in the org
--
-- Path convention: {org_id}/{submission_id}/{filename}

-- ============================================
-- SEED DATA FOR DEMO (Optional - run separately)
-- ============================================
-- See: .claude/plans/backlog/items/BACKLOG-389.md for seed data script
