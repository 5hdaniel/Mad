# BACKLOG-388: RLS Policies + Storage Bucket

**Priority:** P0 (Critical)
**Category:** security / infrastructure
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~20K

---

## Summary

Create Row-Level Security (RLS) policies for all B2B tables and configure a Supabase Storage bucket for submission attachments with proper access controls.

---

## Problem Statement

The schema created in BACKLOG-387 has no security policies. Without RLS:
- Any authenticated user could see all organizations' data
- Agents could see other agents' submissions
- Brokers could access data from other organizations
- Storage files would be publicly accessible

---

## Proposed Solution

### RLS Policies

#### organizations Table

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can see their own organization(s)
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can update organization settings
CREATE POLICY "Admins can update organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'it_admin')
    )
  );
```

#### organization_members Table

```sql
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can see members in their organization
CREATE POLICY "View org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins can manage members
CREATE POLICY "Admins manage members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'it_admin', 'broker')
    )
  );
```

#### transaction_submissions Table

```sql
ALTER TABLE transaction_submissions ENABLE ROW LEVEL SECURITY;

-- Agents see their own submissions
CREATE POLICY "Agents view own submissions"
  ON transaction_submissions FOR SELECT
  USING (submitted_by = auth.uid());

-- Agents can create submissions
CREATE POLICY "Agents create submissions"
  ON transaction_submissions FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

-- Agents can update own submissions (for resubmission)
CREATE POLICY "Agents update own submissions"
  ON transaction_submissions FOR UPDATE
  USING (submitted_by = auth.uid());

-- Brokers/admins see all org submissions
CREATE POLICY "Brokers view org submissions"
  ON transaction_submissions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
    )
  );

-- Brokers can update submissions (review actions)
CREATE POLICY "Brokers review submissions"
  ON transaction_submissions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
    )
  );
```

#### submission_messages Table

```sql
ALTER TABLE submission_messages ENABLE ROW LEVEL SECURITY;

-- Access follows submission access
CREATE POLICY "View submission messages"
  ON submission_messages FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
      )
    )
  );

-- Agents can insert messages on their submissions
CREATE POLICY "Insert submission messages"
  ON submission_messages FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );
```

#### submission_attachments Table

```sql
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;

-- Same pattern as messages
CREATE POLICY "View submission attachments"
  ON submission_attachments FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
      )
    )
  );

CREATE POLICY "Insert submission attachments"
  ON submission_attachments FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
    )
  );
```

#### submission_comments Table

```sql
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- View comments on accessible submissions
CREATE POLICY "View submission comments"
  ON submission_comments FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE submitted_by = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
      )
    )
  );

-- Brokers can add comments
CREATE POLICY "Brokers add comments"
  ON submission_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    submission_id IN (
      SELECT id FROM transaction_submissions
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
      )
    )
  );
```

### Storage Bucket Configuration

```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-attachments',
  'submission-attachments',
  false,  -- Private bucket
  52428800,  -- 50MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']
);

-- Storage path pattern: {org_id}/{submission_id}/{filename}

-- Storage policies
CREATE POLICY "Agents upload to own submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submission-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "View own org attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_b2b_rls_policies.sql` | All RLS policies |
| `supabase/migrations/YYYYMMDD_b2b_storage_bucket.sql` | Storage bucket setup |

---

## Dependencies

- BACKLOG-387: Schema must exist before policies can be created

---

## Acceptance Criteria

- [ ] RLS enabled on all 6 B2B tables
- [ ] Agent can only see own submissions
- [ ] Broker can see all submissions in their org
- [ ] Agent cannot see other agents' submissions
- [ ] Broker cannot see other orgs' submissions
- [ ] Storage bucket created with correct MIME type restrictions
- [ ] Storage policies enforce org-scoped access

---

## Technical Notes

### Demo Considerations

For demo purposes, the service key approach is acceptable:
- Desktop app uses service key (bypasses RLS)
- Portal uses user JWT (RLS enforced)

**Production Migration Required:**
- Desktop must eventually authenticate users properly
- RLS will then protect desktop queries too

### Testing RLS Policies

```sql
-- Test as agent user
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "agent-uuid-here"}';

-- Should only see own submissions
SELECT * FROM transaction_submissions;

-- Test as broker user
SET LOCAL request.jwt.claims TO '{"sub": "broker-uuid-here"}';

-- Should see all org submissions
SELECT * FROM transaction_submissions;
```

### Storage Path Convention

```
submission-attachments/
  {org_id}/
    {submission_id}/
      document.pdf
      photo.jpg
```

This allows RLS policies to check org membership from the path.

---

## Security Considerations

1. **No Service Key in Portal**: Web portal uses only anon key + user JWT
2. **Defense in Depth**: Even if RLS bypassed, API validation exists
3. **Audit Logging**: Consider adding audit log triggers (post-demo)
4. **Rate Limiting**: Consider per-user upload limits (post-demo)

---

## Testing Plan

1. Create test users: agent1, agent2, broker1 (same org), broker2 (different org)
2. Agent1 creates submission - verify only agent1 sees it
3. Broker1 reviews - verify broker1 sees submission
4. Broker2 queries - verify broker2 does NOT see submission
5. Agent2 queries - verify agent2 does NOT see submission
6. Test storage: agent1 uploads file, broker1 can download, agent2/broker2 cannot

---

## Related Items

- BACKLOG-387: Supabase Schema (dependency)
- BACKLOG-389: Demo Seed Data (depends on this)
- SPRINT-050: B2B Broker Portal Demo
