# Task TASK-2171: Support Foundation - Database Schema, RLS, RPCs, Storage, RBAC

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Create the complete database foundation for the support ticketing system: 6 tables with indexes, ~25 RLS policies, 7 SECURITY DEFINER RPCs, a Supabase Storage bucket, 5 RBAC permission keys, category seed data, and role-permission assignments. Apply all migrations via Supabase MCP and verify they work.

## Non-Goals

- Do NOT build any UI (that is TASK-2172+)
- Do NOT implement SLA engine logic (timestamp fields present but no automation)
- Do NOT implement auto-assignment
- Do NOT implement email integration
- Do NOT create Edge Functions
- Do NOT modify any admin-portal or broker-portal code in this task

## Deliverables

1. New file: `supabase/migrations/20260313_support_schema.sql` -- Tables, indexes, constraints, triggers
2. New file: `supabase/migrations/20260313_support_rls_policies.sql` -- All RLS policies
3. New file: `supabase/migrations/20260313_support_rpcs.sql` -- All 7 RPCs
4. New file: `supabase/migrations/20260313_support_storage.sql` -- Storage bucket + policies
5. New file: `supabase/migrations/20260313_support_rbac_seed.sql` -- Permission keys, category seed data, role assignments

## File Boundaries

N/A -- sequential execution. This is the first task in the sprint.

## Acceptance Criteria

- [ ] All 6 tables created: `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `support_ticket_events`, `support_ticket_participants`, `support_categories`
- [ ] All tables have proper indexes (ticket lookup by status, assignee, requester; message lookup by ticket; category lookup)
- [ ] `support_tickets.status` constrained to: `new`, `assigned`, `in_progress`, `pending`, `resolved`, `closed`
- [ ] `support_tickets.priority` constrained to: `low`, `normal`, `high`, `urgent`
- [ ] `support_ticket_messages.message_type` constrained to: `reply`, `internal_note`
- [ ] ~25 RLS policies: agents (internal_roles users) see all; customers see only own tickets + non-internal messages
- [ ] Tables are READ-ONLY at RLS level for non-service-role (all writes through RPCs)
- [ ] 7 RPCs created as SECURITY DEFINER: `support_create_ticket`, `support_update_ticket_status`, `support_assign_ticket`, `support_add_message`, `support_get_ticket_detail`, `support_list_tickets`, `support_get_ticket_stats`
- [ ] `support_create_ticket` handles BOTH authenticated (uses auth.uid()) AND unauthenticated (accepts email, name params) submissions
- [ ] `support_update_ticket_status` enforces the allowed transition state machine
- [ ] All RPCs log events to `support_ticket_events`
- [ ] `support-attachments` storage bucket created with RLS policies
- [ ] 5 permission keys seeded: `support.view`, `support.respond`, `support.assign`, `support.manage`, `support.admin`
- [ ] `support` category added to `admin_permissions` table
- [ ] 7 categories with subcategories seeded to `support_categories`
- [ ] `support-agent` and `support-supervisor` roles get appropriate support permissions
- [ ] All migrations applied successfully via `mcp__supabase__apply_migration`
- [ ] RPCs verified via `mcp__supabase__execute_sql` (create a ticket, list it, add message, change status)

## Implementation Notes

### Table Schema

#### `support_tickets`

```sql
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
  requester_id UUID REFERENCES auth.users(id),  -- NULL for unauthenticated submissions
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
  -- SLA fields (present but not enforced in Phase 1)
  sla_first_response_deadline TIMESTAMPTZ,
  sla_resolution_deadline TIMESTAMPTZ,
  sla_first_response_met BOOLEAN,
  sla_resolution_met BOOLEAN,
  -- Search
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**IMPORTANT:** `support_categories` must be created BEFORE `support_tickets` because of the FK references. Order the table creation accordingly.

#### `support_ticket_messages`

```sql
CREATE TABLE support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),  -- NULL for system messages
  sender_email TEXT,
  sender_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'reply' CHECK (message_type IN ('reply', 'internal_note')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `support_ticket_attachments`

```sql
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
```

#### `support_ticket_events`

```sql
CREATE TABLE support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,  -- 'created', 'status_changed', 'assigned', 'priority_changed', 'message_added', 'participant_added', etc.
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `support_ticket_participants`

```sql
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
```

#### `support_categories`

```sql
CREATE TABLE support_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES support_categories(id),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,  -- e.g., { "disclaimer": "We provide product guidance..." }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Strategy

**Core principle:** Tables are read-only at RLS level. ALL writes go through SECURITY DEFINER RPCs.

**Agent detection:** Check if user has an `internal_roles` entry:
```sql
EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
```

**Customer detection for tickets:** Match `requester_id = auth.uid()` OR `requester_email` matches the user's email.

**Internal notes filtering:** Customers can see messages WHERE `message_type != 'internal_note'`.

**Enable RLS on all 6 tables.** Apply SELECT policies only (no INSERT/UPDATE/DELETE for non-service-role).

For `support_categories`: allow SELECT to all (including anon) since the ticket form needs categories.

### Status State Machine (Enforce in `support_update_ticket_status`)

```sql
-- Allowed transitions
CASE
  WHEN old_status = 'new' AND new_status IN ('assigned', 'in_progress') THEN true
  WHEN old_status = 'assigned' AND new_status IN ('in_progress', 'pending') THEN true
  WHEN old_status = 'in_progress' AND new_status IN ('pending', 'resolved') THEN true
  WHEN old_status = 'pending' AND new_status = 'in_progress' THEN true
  WHEN old_status = 'resolved' AND new_status IN ('in_progress', 'closed') THEN true
  WHEN old_status = 'closed' AND new_status = 'in_progress' THEN true  -- admin reopen only
  ELSE false
END
```

For `closed -> in_progress`, verify the caller has `support.admin` permission via `has_permission()` RPC or direct check against role_permissions.

### RPC: `support_create_ticket`

This RPC must handle two cases:
1. **Authenticated user** (`auth.uid()` is not null): Use `auth.uid()` as `requester_id`, look up email/name from profiles or accept as params
2. **Unauthenticated / agent-created** (`auth.uid()` is null or `p_on_behalf_of` is true): Accept `p_requester_email` and `p_requester_name` as required params, set `requester_id` to null (or look up user by email)

**For unauthenticated submissions:** The RPC will be called with the anon key. Set `SECURITY DEFINER` and explicitly allow anon role to call it:
```sql
GRANT EXECUTE ON FUNCTION support_create_ticket TO anon;
GRANT EXECUTE ON FUNCTION support_create_ticket TO authenticated;
```

The RPC must also create the initial 'created' event in `support_ticket_events`.

### RPC: `support_list_tickets`

Accept filter params:
```sql
p_status TEXT DEFAULT NULL,
p_priority TEXT DEFAULT NULL,
p_category_id UUID DEFAULT NULL,
p_assignee_id UUID DEFAULT NULL,
p_search TEXT DEFAULT NULL,
p_requester_email TEXT DEFAULT NULL,
p_page INT DEFAULT 1,
p_page_size INT DEFAULT 20
```

For agents (internal_roles users): return all matching tickets.
For customers: return only tickets where `requester_id = auth.uid()` or `requester_email = p_requester_email` (if provided).
For anon: return only tickets matching `p_requester_email`.

Return total_count alongside results for pagination.

### RPC: `support_get_ticket_detail`

Returns the ticket plus:
- All messages (for agents: all; for customers: exclude `internal_note`)
- All events
- All attachments
- All participants

### RPC: `support_add_message`

Accept params: `p_ticket_id`, `p_body`, `p_message_type`, `p_sender_email` (optional, for unauthenticated), `p_sender_name` (optional).

For authenticated: use `auth.uid()` as `sender_id`.
For unauthenticated: set `sender_id` to null, use provided email/name.

Log a 'message_added' event.

Grant to both `anon` and `authenticated` roles.

### RBAC Permissions

Insert into `admin_permissions`:
```sql
INSERT INTO admin_permissions (key, name, description, category) VALUES
  ('support.view', 'View Support Queue', 'View the support ticket queue', 'support'),
  ('support.respond', 'Respond to Tickets', 'Reply to tickets and add internal notes', 'support'),
  ('support.assign', 'Assign Tickets', 'Assign and reassign tickets to agents', 'support'),
  ('support.manage', 'Manage Tickets', 'Change ticket status, priority, and category', 'support'),
  ('support.admin', 'Administrate Support', 'Delete tickets, configure categories, reopen closed tickets', 'support');
```

Assign to existing roles:
- `support-agent`: `support.view`, `support.respond`, `support.assign`, `support.manage`
- `support-supervisor`: all 5 support permissions
- `super-admin` (if exists): all 5 support permissions

**Look up role IDs first:** `SELECT id, name FROM internal_role_definitions;`

### Category Seed Data

Seed the 7 top-level categories and their subcategories. The Compliance Guidance category should have metadata:
```json
{ "disclaimer": "We provide product guidance and workflow support. We do not provide legal advice." }
```

### Storage Bucket

Follow the pattern from `20260122_storage_bucket_policies.sql`:
- Bucket name: `support-attachments`
- Path convention: `{ticket_id}/{attachment_id}/{filename}`
- Agents (internal_roles) can read/write all
- Customers can read attachments for their own tickets
- Anon users can upload (for the public form)
- 10MB file size limit (enforced application-side, not in SQL)

### Full-Text Search Setup

```sql
CREATE FUNCTION support_tickets_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.subject, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_search_update
  BEFORE INSERT OR UPDATE OF subject, description ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_search_trigger();

CREATE INDEX idx_support_tickets_search ON support_tickets USING GIN (search_vector);
```

### Updated_at Trigger

```sql
CREATE FUNCTION support_tickets_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_updated_at();
```

### Indexes

```sql
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
```

## Integration Notes

- This task creates the foundation that ALL subsequent tasks depend on
- TASK-2172 will use the RPCs via `supabase.rpc()` calls
- The `support_list_tickets` RPC is used by both admin and broker portal
- The `support_create_ticket` RPC must work for both authenticated (admin + broker) and unauthenticated (public form) callers
- The `support_add_message` RPC must work for both authenticated and unauthenticated callers

## Do / Don't

### Do:
- Use SECURITY DEFINER for all RPCs
- Log every mutation to `support_ticket_events`
- Test each RPC via `mcp__supabase__execute_sql` after applying
- Follow existing migration naming: `20260313_support_*.sql`
- Use `gen_random_uuid()` for all primary keys
- Use `CHECK` constraints for enums (not PostgreSQL ENUM types)
- Grant anon role EXECUTE on `support_create_ticket` and `support_add_message`
- Grant anon role SELECT on `support_categories`
- Use `mcp__supabase__apply_migration` to apply each migration file
- Verify tables exist via `mcp__supabase__list_tables` after applying
- Create `support_categories` table BEFORE `support_tickets` (FK dependency)

### Don't:
- Do NOT create PostgreSQL ENUM types (use CHECK constraints for flexibility)
- Do NOT allow direct INSERT/UPDATE/DELETE on tables via RLS (read-only policies only, except categories which are read-only for everyone)
- Do NOT implement SLA calculation logic
- Do NOT implement auto-assignment
- Do NOT create any UI code
- Do NOT use `CREATE OR REPLACE` for tables (use plain `CREATE TABLE`)

## When to Stop and Ask

- If `admin_permissions` table does not exist or has a different schema than expected
- If `internal_roles` table does not exist or cannot be queried
- If `internal_role_definitions` table does not exist
- If `organizations` table does not exist
- If migration apply fails with an unexpected error
- If the `support-agent` or `support-supervisor` roles don't exist in the DB
- If any RPC fails verification tests

## Testing Expectations

### Unit Tests
- Required: No (database-only task, no TypeScript code)

### RPC Verification (MANDATORY)
After applying all migrations, verify each RPC works via `mcp__supabase__execute_sql`:

1. **Create ticket (authenticated):** Call `support_create_ticket` with test data
2. **Create ticket (unauthenticated):** Call with email/name but no auth context
3. **List tickets:** Call `support_list_tickets` and verify the created ticket appears
4. **Add message (reply):** Call `support_add_message` with `message_type = 'reply'`
5. **Add message (internal note):** Call `support_add_message` with `message_type = 'internal_note'`
6. **Update status:** Call `support_update_ticket_status` with valid transition (new -> assigned)
7. **Update status (invalid):** Call with invalid transition (new -> closed) and verify it fails
8. **Assign ticket:** Call `support_assign_ticket`
9. **Get ticket detail:** Call `support_get_ticket_detail` and verify messages + events included
10. **Get stats:** Call `support_get_ticket_stats` and verify counts

### RLS Verification (MANDATORY)
Test dual-audience visibility:
1. As an agent (internal_roles user): Can see all tickets, all messages including internal notes
2. As a customer: Can see only own tickets, cannot see internal_note messages

### CI Requirements
- [ ] Migration files are valid SQL
- [ ] No TypeScript changes to validate (DB-only task)

## PR Preparation

- **Title**: `feat(support): add database schema, RLS, RPCs, storage, and RBAC for support ticketing`
- **Labels**: `feature`, `database`, `support`
- **Depends on**: None (first task)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~60K-80K

**Token Cap:** 320K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 migration files | +30K |
| SQL complexity | 6 tables, 7 RPCs, ~25 RLS policies | +30K |
| Verification via MCP | 10+ execute_sql calls | +15K |
| Schema multiplier | x 1.3 | Applied |

**Confidence:** Medium

**Risk factors:**
- RPC complexity (especially create_ticket dual-auth handling)
- RLS policy count (~25 policies across 6 tables)
- Anon role access for public form RPC

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] supabase/migrations/20260313_support_schema.sql
- [ ] supabase/migrations/20260313_support_rls_policies.sql
- [ ] supabase/migrations/20260313_support_rpcs.sql
- [ ] supabase/migrations/20260313_support_storage.sql
- [ ] supabase/migrations/20260313_support_rbac_seed.sql

Features implemented:
- [ ] 6 tables with indexes and constraints
- [ ] ~25 RLS policies (dual-audience)
- [ ] 7 SECURITY DEFINER RPCs
- [ ] Status state machine enforcement
- [ ] Storage bucket with RLS
- [ ] 5 RBAC permission keys
- [ ] 7 categories with subcategories seeded
- [ ] Role-permission assignments

Verification:
- [ ] All migrations applied via mcp__supabase__apply_migration
- [ ] All RPCs verified via mcp__supabase__execute_sql
- [ ] RLS verified (customer vs agent visibility)
- [ ] Tables verified via mcp__supabase__list_tables
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~80K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
