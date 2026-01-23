# BACKLOG-389: Demo Seed Data

**Priority:** P0 (Critical)
**Category:** data / testing
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~10K

---

## Summary

Create seed data for the B2B broker portal demo including one organization, multiple test users with different roles, and sample submissions for demonstration.

---

## Problem Statement

After schema (BACKLOG-387) and RLS (BACKLOG-388) are in place, we need test data to:
- Verify RLS policies work correctly
- Enable development of portal and desktop features
- Provide realistic demo scenario data

---

## Proposed Solution

Create a SQL seed script that populates the demo environment with:
1. One organization (demo broker firm)
2. Multiple users with different roles
3. Sample transaction submissions in various states

### Demo Organization

```sql
-- Demo organization
INSERT INTO organizations (id, name, slug, plan, max_seats, retention_years)
VALUES (
  'org-demo-001',  -- Fixed UUID for easy reference
  'Acme Realty Group',
  'acme-realty',
  'pro',
  10,
  7
);
```

### Demo Users

Create users in Supabase Auth first (via Dashboard or API), then link to organization.

**Roles:**
| User | Email | Role | Purpose |
|------|-------|------|---------|
| Agent Alice | alice@acme-demo.test | agent | Primary demo agent |
| Agent Bob | bob@acme-demo.test | agent | Secondary agent |
| Broker Carol | carol@acme-demo.test | broker | Primary demo broker |
| Admin Dana | dana@acme-demo.test | admin | Organization admin |

```sql
-- After creating auth users, link to organization
-- (UUIDs will come from auth.users table)

INSERT INTO organization_members (organization_id, user_id, role, license_status, joined_at)
VALUES
  ('org-demo-001', 'alice-auth-uuid', 'agent', 'active', NOW()),
  ('org-demo-001', 'bob-auth-uuid', 'agent', 'active', NOW()),
  ('org-demo-001', 'carol-auth-uuid', 'broker', 'active', NOW()),
  ('org-demo-001', 'dana-auth-uuid', 'admin', 'active', NOW());
```

### Sample Submissions

Create submissions in various workflow states for demo:

```sql
-- Submission 1: Approved (happy path)
INSERT INTO transaction_submissions (
  id, organization_id, submitted_by,
  local_transaction_id, property_address, property_city, property_state, property_zip,
  transaction_type, listing_price, sale_price,
  status, reviewed_by, reviewed_at, review_notes,
  message_count, attachment_count
) VALUES (
  gen_random_uuid(), 'org-demo-001', 'alice-auth-uuid',
  'txn-local-001', '123 Oak Street', 'Los Angeles', 'CA', '90210',
  'sale', 850000, 825000,
  'approved', 'carol-auth-uuid', NOW() - INTERVAL '2 days', 'All documents in order. Approved.',
  15, 8
);

-- Submission 2: Needs Changes
INSERT INTO transaction_submissions (
  id, organization_id, submitted_by,
  local_transaction_id, property_address, property_city, property_state, property_zip,
  transaction_type, listing_price,
  status, reviewed_by, reviewed_at, review_notes,
  message_count, attachment_count
) VALUES (
  gen_random_uuid(), 'org-demo-001', 'alice-auth-uuid',
  'txn-local-002', '456 Maple Ave', 'Santa Monica', 'CA', '90401',
  'purchase', 1200000,
  'needs_changes', 'carol-auth-uuid', NOW() - INTERVAL '1 day', 'Missing inspection report. Please upload and resubmit.',
  12, 5
);

-- Submission 3: Newly Submitted (for demo action)
INSERT INTO transaction_submissions (
  id, organization_id, submitted_by,
  local_transaction_id, property_address, property_city, property_state, property_zip,
  transaction_type, listing_price,
  status,
  message_count, attachment_count
) VALUES (
  gen_random_uuid(), 'org-demo-001', 'bob-auth-uuid',
  'txn-local-003', '789 Pine Road', 'Beverly Hills', 'CA', '90212',
  'sale', 2500000,
  'submitted',
  20, 12
);

-- Submission 4: Under Review
INSERT INTO transaction_submissions (
  id, organization_id, submitted_by,
  local_transaction_id, property_address, property_city, property_state, property_zip,
  transaction_type, listing_price, sale_price,
  status, reviewed_by,
  message_count, attachment_count
) VALUES (
  gen_random_uuid(), 'org-demo-001', 'alice-auth-uuid',
  'txn-local-004', '321 Elm Court', 'Malibu', 'CA', '90265',
  'sale', 4200000, 4100000,
  'under_review', 'carol-auth-uuid',
  25, 15
);
```

### Sample Messages (for one submission)

```sql
-- Get the first submission ID
WITH sub AS (
  SELECT id FROM transaction_submissions 
  WHERE local_transaction_id = 'txn-local-001' LIMIT 1
)
INSERT INTO submission_messages (submission_id, local_message_id, channel, direction, subject, body_text, sent_at)
SELECT 
  sub.id,
  'msg-' || n,
  CASE WHEN n % 3 = 0 THEN 'email' WHEN n % 3 = 1 THEN 'sms' ELSE 'email' END,
  CASE WHEN n % 2 = 0 THEN 'inbound' ELSE 'outbound' END,
  CASE WHEN n % 3 != 1 THEN 'RE: 123 Oak Street Transaction' ELSE NULL END,
  'Sample message content for demo ' || n,
  NOW() - (n || ' days')::INTERVAL
FROM sub, generate_series(1, 15) AS n;
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/seed/demo_seed.sql` | Demo data script |
| `supabase/seed/README.md` | Instructions for running seed |

---

## Dependencies

- BACKLOG-387: Schema must exist
- BACKLOG-388: RLS policies must be in place (seed runs as admin)

---

## Acceptance Criteria

- [ ] Demo organization created
- [ ] Four demo users with correct roles
- [ ] At least 4 submissions in different states
- [ ] Sample messages attached to at least one submission
- [ ] Seed can be run repeatedly (idempotent with ON CONFLICT)
- [ ] README documents how to run seed data

---

## Technical Notes

### Creating Auth Users

Demo users must be created in Supabase Auth first. Options:
1. **Supabase Dashboard**: Manually create users in Authentication > Users
2. **CLI**: Use `supabase auth create-user` commands
3. **Script**: Use Admin API with service key

For demo, recommend manual creation in Dashboard to ensure OAuth providers are linked.

### Idempotent Seed

Use `ON CONFLICT DO NOTHING` or `INSERT ... ON CONFLICT DO UPDATE` to make seed rerunnable:

```sql
INSERT INTO organizations (id, name, slug, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();
```

### Demo User Credentials

For OAuth demo:
- Use real Google/Microsoft accounts or
- Create test accounts in provider
- Document login credentials securely

---

## Demo Scenario Support

The seed data supports the full demo scenario:

| Step | Data Required |
|------|---------------|
| 1. Agent completes audit | Local SQLite (not seeded here) |
| 2. Agent submits | Creates new submission |
| 3. Broker sees list | Existing submissions in various states |
| 4. Broker reviews | Submission txn-local-003 (newly submitted) |
| 5. Broker requests changes | Updates submission status |
| 6. Agent sees notes | Status sync to desktop |
| 7. Agent resubmits | Creates version 2 |
| 8. Broker approves | Final approval |

---

## Testing Plan

1. Run seed script in development Supabase
2. Login as each demo user
3. Verify:
   - Alice sees 3 submissions (her own)
   - Bob sees 1 submission (his own)
   - Carol sees all 4 submissions (broker)
   - Dana sees all 4 submissions (admin)
4. Verify messages and attachments accessible
5. Test RLS enforcement for each role

---

## Related Items

- BACKLOG-387: Supabase Schema (dependency)
- BACKLOG-388: RLS Policies (dependency)
- SPRINT-050: B2B Broker Portal Demo
