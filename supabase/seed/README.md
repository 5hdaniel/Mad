# Supabase Seed Data

This directory contains seed data scripts for development and demo purposes.

## Demo Seed Data (B2B Broker Portal)

The `demo_seed.sql` script creates demo data for SPRINT-050: B2B Broker Portal Demo.

### Prerequisites

1. **Schema Migration Applied**: Ensure `20260122_b2b_broker_portal.sql` has been run first
2. **Supabase Project**: You need a Supabase project (local or cloud)
3. **Service Role Key**: The seed script requires admin access to bypass RLS

### Step 1: Create Demo Users in Supabase Auth

Before running the seed script, create the demo users in Supabase Auth:

| User | Email | Password | Role |
|------|-------|----------|------|
| Alice | alice@acme-demo.test | demo-password-123 | agent |
| Bob | bob@acme-demo.test | demo-password-123 | agent |
| Carol | carol@acme-demo.test | demo-password-123 | broker |
| Dana | dana@acme-demo.test | demo-password-123 | admin |

**Option A: Using Supabase Dashboard**

1. Go to Authentication > Users
2. Click "Add user" for each demo user
3. Use email/password authentication
4. Note: OAuth providers can be linked later

**Option B: Using Supabase CLI**

```bash
# Start local Supabase (if using local)
supabase start

# Create users via SQL (run in Supabase SQL Editor)
SELECT
  supabase.auth.create_user(
    email := 'alice@acme-demo.test',
    password := 'demo-password-123',
    email_confirmed := true,
    user_metadata := '{"full_name": "Alice Agent"}'::jsonb
  );
-- Repeat for bob, carol, dana
```

**Option C: Using Admin API**

```bash
# Replace with your service role key and project URL
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme-demo.test",
    "password": "demo-password-123",
    "email_confirm": true,
    "user_metadata": {"full_name": "Alice Agent"}
  }'
```

### Step 2: Run the Seed Script

**Using Supabase CLI (Local)**

```bash
# From project root
supabase db reset  # This runs all migrations

# Then run seed manually
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/seed/demo_seed.sql
```

**Using Supabase Dashboard (Cloud)**

1. Go to SQL Editor
2. Paste the contents of `demo_seed.sql`
3. Run the query

**Using psql (Direct Connection)**

```bash
# Get connection string from Supabase Dashboard > Settings > Database
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" -f supabase/seed/demo_seed.sql
```

### Step 3: Verify Seed Data

Run these queries to verify:

```sql
-- Check organization
SELECT * FROM organizations WHERE slug = 'acme-realty';

-- Check members/invitations
SELECT
  om.role,
  om.license_status,
  om.invited_email,
  au.email as auth_email
FROM organization_members om
LEFT JOIN auth.users au ON om.user_id = au.id
WHERE om.organization_id = (
  SELECT id FROM organizations WHERE slug = 'acme-realty'
);

-- Check submissions
SELECT
  property_address,
  status,
  message_count,
  attachment_count
FROM transaction_submissions
WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'acme-realty'
);

-- Check messages for first submission
SELECT
  channel,
  direction,
  subject,
  sent_at
FROM submission_messages
WHERE submission_id = (
  SELECT id FROM transaction_submissions
  WHERE local_transaction_id = 'txn-local-001'
  LIMIT 1
)
ORDER BY sent_at;
```

### Data Overview

After running the seed script:

| Entity | Count | Details |
|--------|-------|---------|
| Organizations | 1 | Acme Realty Group |
| Members | 4 | 2 agents, 1 broker, 1 admin |
| Submissions | 4 | approved, needs_changes, submitted, under_review |
| Messages | 15 | Email and SMS for submission 1 |
| Attachments | 8 | PDFs for submission 1 |
| Comments | 4 | Broker feedback on submissions 2 and 4 |

### Demo Scenario Support

The seed data enables the following demo flow:

1. **Login as Alice (agent)** - See her 3 submissions
2. **Login as Bob (agent)** - See his 1 submission
3. **Login as Carol (broker)** - See all 4 submissions, review pending ones
4. **Login as Dana (admin)** - See all 4 submissions, manage organization

### Idempotent Design

The seed script is safe to run multiple times:
- Uses `ON CONFLICT DO UPDATE` for organizations and submissions
- Deletes and recreates messages/attachments
- Checks if users exist before creating submissions

### Resetting Demo Data

To reset to a clean state:

```sql
-- Delete all demo data
DELETE FROM organizations WHERE slug = 'acme-realty';
-- Cascade deletes will remove members, submissions, messages, etc.

-- Then re-run the seed script
```

### Troubleshooting

**"Skipping submissions - demo users not yet created"**
- Create users in Supabase Auth first (Step 1)
- Re-run the seed script

**"duplicate key value violates unique constraint"**
- The seed script handles this, but if you see errors, try resetting first

**RLS blocking access**
- Ensure you're running with service role key
- The seed script needs to bypass RLS to create data

### Related Files

- Schema: `supabase/migrations/20260122_b2b_broker_portal.sql`
- Backlog: `.claude/plans/backlog/items/BACKLOG-389.md`
