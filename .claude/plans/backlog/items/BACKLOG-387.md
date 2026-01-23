# BACKLOG-387: Supabase Schema - Organizations, Members, Submissions

**Priority:** P0 (Critical)
**Category:** schema / infrastructure
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~25K

---

## Summary

Create the complete Supabase database schema for the B2B broker portal feature. This includes all tables needed for multi-tenant organization support, user membership with roles, transaction submissions for broker review, and related messages/attachments.

---

## Problem Statement

Magic Audit currently operates as a single-user B2C application with all data stored locally. To support B2B broker workflows, we need:
- Organization/tenant model for broker firms
- User-organization relationships with role-based access
- Cloud storage of submitted transactions for broker review
- Message and attachment records for compliance review

---

## Proposed Solution

Create a new migration file with all required tables and their relationships.

### Tables to Create

#### 1. organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- for URLs: acme-realty
  plan VARCHAR(50) DEFAULT 'trial',   -- trial, pro, enterprise
  max_seats INTEGER DEFAULT 5,
  retention_years INTEGER DEFAULT 7,  -- compliance archive period
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. organization_members
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,  -- 'agent', 'broker', 'admin', 'it_admin'
  license_status VARCHAR(50) DEFAULT 'active',  -- active, suspended, expired
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  -- SR Engineer additions
  invited_email VARCHAR(255),      -- email for pending invitations
  invitation_token VARCHAR(255),   -- token for invite redemption
  UNIQUE(organization_id, user_id)
);
```

#### 3. transaction_submissions
```sql
CREATE TABLE transaction_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  submitted_by UUID REFERENCES auth.users(id),  -- the agent

  -- Transaction Data (denormalized from desktop)
  local_transaction_id TEXT NOT NULL,  -- ID from desktop SQLite
  property_address TEXT NOT NULL,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  transaction_type VARCHAR(50),  -- purchase, sale, other
  listing_price NUMERIC,
  sale_price NUMERIC,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Review Workflow
  status VARCHAR(50) DEFAULT 'submitted',
  -- submitted -> under_review -> needs_changes -> resubmitted -> approved/rejected
  reviewed_by UUID REFERENCES auth.users(id),  -- the broker
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,  -- broker's feedback

  -- SR Engineer additions for resubmission tracking
  version INTEGER DEFAULT 1,
  parent_submission_id UUID REFERENCES transaction_submissions(id),

  -- Counts (denormalized for list performance)
  message_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,

  -- Metadata
  submission_metadata JSONB,  -- detection_source, confidence, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, local_transaction_id, version)
);
```

#### 4. submission_messages
```sql
CREATE TABLE submission_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  local_message_id TEXT,  -- ID from desktop

  channel VARCHAR(50),  -- email, sms, imessage
  direction VARCHAR(50),  -- inbound, outbound
  subject TEXT,
  body_text TEXT,
  participants JSONB,  -- {from, to, cc, bcc}
  sent_at TIMESTAMPTZ,
  thread_id TEXT,

  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. submission_attachments
```sql
CREATE TABLE submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES submission_messages(id),

  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes INTEGER,
  storage_path TEXT NOT NULL,  -- Supabase Storage path

  document_type VARCHAR(50),  -- offer, inspection, contract, etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. submission_comments (SR Engineer addition)
```sql
CREATE TABLE submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES transaction_submissions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),

  content TEXT NOT NULL,
  comment_type VARCHAR(50) DEFAULT 'feedback',  -- feedback, question, internal_note

  -- For threaded comments
  parent_comment_id UUID REFERENCES submission_comments(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_submissions_org ON transaction_submissions(organization_id);
CREATE INDEX idx_submissions_status ON transaction_submissions(status);
CREATE INDEX idx_submissions_submitted_by ON transaction_submissions(submitted_by);
CREATE INDEX idx_submission_messages_submission ON submission_messages(submission_id);
CREATE INDEX idx_submission_attachments_submission ON submission_attachments(submission_id);
CREATE INDEX idx_submission_comments_submission ON submission_comments(submission_id);
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_b2b_schema.sql` | New migration with all tables |

---

## Dependencies

- None (first task in sprint)

---

## Acceptance Criteria

- [ ] Migration file created with all 6 tables
- [ ] All foreign key relationships properly defined
- [ ] Indexes created for common query patterns
- [ ] Migration runs successfully on Supabase
- [ ] Tables visible in Supabase Dashboard
- [ ] No breaking changes to existing `users` table

---

## Technical Notes

### Existing Schema Considerations

The `users` table already exists with auth fields. The new `organization_members` table references `auth.users(id)` (Supabase's auth schema), not a custom users table.

### Status Values

For `transaction_submissions.status`:
- `submitted` - Initial state after agent submits
- `under_review` - Broker has opened for review
- `needs_changes` - Broker requested modifications
- `resubmitted` - Agent has resubmitted after changes
- `approved` - Broker approved
- `rejected` - Broker rejected

### JSONB Fields

- `organizations.settings` - Future extensibility for org preferences
- `transaction_submissions.submission_metadata` - Source info, confidence scores
- `submission_messages.participants` - Structured email addresses

---

## Testing Plan

1. Run migration in development Supabase project
2. Verify all tables created with correct columns
3. Test foreign key constraints work correctly
4. Test unique constraints prevent duplicates
5. Verify indexes created

---

## Related Items

- BACKLOG-388: RLS Policies + Storage Bucket (depends on this)
- BACKLOG-389: Demo Seed Data (depends on this)
- SPRINT-050: B2B Broker Portal Demo
