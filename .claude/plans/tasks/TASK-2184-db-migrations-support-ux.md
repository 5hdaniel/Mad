# Task TASK-2184: DB Migrations — RPCs + Schema for Requester Lookup & Ticket Links

**Status:** Completed
**Completed:** 2026-03-15
**PR:** #1155 (merged)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Apply all pending and new Supabase migrations for the support ticket UX enhancements sprint: apply the two existing BACKLOG-940 RPCs, add new columns to `support_tickets`, create the `support_ticket_links` table, and create all new RPCs needed by TASK-2185/2186/2187. This is the prerequisite task that unlocks the three frontend tasks.

## Non-Goals

- Do NOT build any frontend UI — this task is DB-only
- Do NOT modify any admin-portal TypeScript files
- Do NOT create React components
- Do NOT modify existing RPCs that are already working (e.g., `support_list_tickets`, `support_get_ticket_detail`)

## Deliverables

1. Apply existing: `supabase/migrations/20260313_support_analytics_rpc.sql` (already written)
2. Apply existing: `supabase/migrations/20260313_support_delete_ticket_rpc.sql` (already written)
3. New migration: `supabase/migrations/20260315_support_requester_lookup.sql` — new columns + 2 RPCs
4. New migration: `supabase/migrations/20260315_support_ticket_links.sql` — new table + 4 RPCs
5. Update existing: `supabase/migrations/20260313_support_rpcs.sql` — OR create a new migration to alter `support_create_ticket` to accept optional `p_requester_phone` and `p_preferred_contact` params

## File Boundaries

> N/A — sequential execution (Phase 1, no parallel peers).

### Files to modify (owned by this task):

- `supabase/migrations/20260315_support_requester_lookup.sql` (new)
- `supabase/migrations/20260315_support_ticket_links.sql` (new)
- `supabase/migrations/20260315_support_create_ticket_v2.sql` (new — updates support_create_ticket to accept phone + preferred_contact)

### Files this task must NOT modify:

- Any files under `admin-portal/` — owned by TASK-2185/2186/2187

## Acceptance Criteria

- [ ] `support_agent_analytics` RPC is live and callable (BACKLOG-940)
- [ ] `support_delete_ticket` RPC is live and callable (BACKLOG-940)
- [ ] `support_tickets` table has new columns: `requester_phone TEXT`, `preferred_contact TEXT DEFAULT 'email'` with CHECK constraint
- [ ] `support_create_ticket` RPC accepts optional `p_requester_phone` and `p_preferred_contact` params (backwards compatible)
- [ ] `support_search_requesters(p_query TEXT)` RPC returns correct results
- [ ] `support_requester_recent_tickets(p_email TEXT)` RPC returns correct results
- [ ] `support_ticket_links` table exists with proper constraints (UNIQUE, CHECK, FK with ON DELETE CASCADE)
- [ ] `support_get_related_tickets(p_ticket_id UUID)` RPC returns both auto-related and manual links
- [ ] `support_link_tickets(p_ticket_id, p_linked_ticket_id, p_link_type)` RPC creates bidirectional link + events
- [ ] `support_unlink_tickets(p_ticket_id, p_linked_ticket_id)` RPC removes both directions + events
- [ ] `support_search_tickets_for_link(p_query TEXT, p_exclude_ticket_id UUID)` RPC returns matching tickets
- [ ] All RPCs have SECURITY DEFINER and auth guard (auth.uid() check)
- [ ] All migrations applied successfully via Supabase MCP

## Implementation Notes

### Step 1: Apply Existing BACKLOG-940 Migrations

These files already exist and are correct. Apply them via Supabase MCP:

```sql
-- File: supabase/migrations/20260313_support_analytics_rpc.sql
-- Already reviewed — creates support_agent_analytics(p_period_days)

-- File: supabase/migrations/20260313_support_delete_ticket_rpc.sql
-- Already reviewed — creates support_delete_ticket(p_ticket_id)
```

Use `mcp__supabase__apply_migration` or `mcp__supabase__execute_sql` to apply.

### Step 2: Requester Lookup Migration

Create `supabase/migrations/20260315_support_requester_lookup.sql`:

```sql
-- 1. Add columns to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS requester_phone TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT 'email'
    CHECK (preferred_contact IN ('email', 'phone', 'either'));

-- 2. Create support_search_requesters RPC
CREATE OR REPLACE FUNCTION support_search_requesters(p_query TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  phone TEXT,
  organization_id UUID,
  organization_name TEXT,
  open_ticket_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(p.full_name, p.display_name, u.email)::TEXT AS name,
    p.phone::TEXT,
    om.organization_id,
    o.name::TEXT AS organization_name,
    (SELECT COUNT(*) FROM support_tickets st
     WHERE st.requester_email = u.email
     AND st.status NOT IN ('resolved', 'closed')) AS open_ticket_count
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN organization_members om ON om.user_id = u.id
  LEFT JOIN organizations o ON o.id = om.organization_id
  WHERE
    u.email ILIKE '%' || p_query || '%'
    OR COALESCE(p.full_name, '') ILIKE '%' || p_query || '%'
    OR COALESCE(p.display_name, '') ILIKE '%' || p_query || '%'
    OR COALESCE(o.name, '') ILIKE '%' || p_query || '%'
  ORDER BY
    CASE WHEN u.email ILIKE p_query || '%' THEN 0 ELSE 1 END,
    COALESCE(p.full_name, u.email)
  LIMIT 10;
END;
$$;

-- 3. Create support_requester_recent_tickets RPC
CREATE OR REPLACE FUNCTION support_requester_recent_tickets(p_email TEXT)
RETURNS TABLE (
  id UUID,
  ticket_number INT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT st.id, st.ticket_number, st.subject, st.status, st.priority, st.created_at
  FROM support_tickets st
  WHERE st.requester_email = p_email
  ORDER BY st.created_at DESC
  LIMIT 5;
END;
$$;
```

### Step 3: Ticket Links Migration

Create `supabase/migrations/20260315_support_ticket_links.sql`:

```sql
-- 1. Create support_ticket_links table
CREATE TABLE IF NOT EXISTS support_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  linked_ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'related'
    CHECK (link_type IN ('related', 'duplicate', 'parent', 'child')),
  linked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, linked_ticket_id),
  CHECK (ticket_id != linked_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_links_ticket ON support_ticket_links(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_links_linked ON support_ticket_links(linked_ticket_id);

-- 2. support_get_related_tickets RPC
-- Returns both auto-related (same requester) and manually linked tickets
CREATE OR REPLACE FUNCTION support_get_related_tickets(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_requester_email TEXT;
  v_auto_related JSONB;
  v_manual_links JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT requester_email INTO v_requester_email
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_requester_email IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Auto-related: same requester, excluding current ticket
  SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.created_at DESC), '[]'::JSONB)
  INTO v_auto_related
  FROM (
    SELECT st.id, st.ticket_number, st.subject, st.status, st.priority, st.created_at,
           'auto'::TEXT AS link_source
    FROM support_tickets st
    WHERE st.requester_email = v_requester_email
      AND st.id != p_ticket_id
    ORDER BY st.created_at DESC
    LIMIT 5
  ) t;

  -- Manual links: bidirectional lookup
  SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.created_at DESC), '[]'::JSONB)
  INTO v_manual_links
  FROM (
    SELECT st.id, st.ticket_number, st.subject, st.status, st.priority, st.created_at,
           stl.link_type, 'manual'::TEXT AS link_source, stl.id AS link_id
    FROM support_ticket_links stl
    JOIN support_tickets st ON st.id = CASE
      WHEN stl.ticket_id = p_ticket_id THEN stl.linked_ticket_id
      ELSE stl.ticket_id
    END
    WHERE stl.ticket_id = p_ticket_id OR stl.linked_ticket_id = p_ticket_id
    ORDER BY st.created_at DESC
  ) t;

  RETURN jsonb_build_object(
    'auto_related', v_auto_related,
    'manual_links', v_manual_links
  );
END;
$$;

-- 3. support_link_tickets RPC
CREATE OR REPLACE FUNCTION support_link_tickets(
  p_ticket_id UUID,
  p_linked_ticket_id UUID,
  p_link_type TEXT DEFAULT 'related'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_link_id UUID;
  v_ticket_number INTEGER;
  v_linked_number INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get ticket numbers for event logging
  SELECT ticket_number INTO v_ticket_number FROM support_tickets WHERE id = p_ticket_id;
  SELECT ticket_number INTO v_linked_number FROM support_tickets WHERE id = p_linked_ticket_id;

  IF v_ticket_number IS NULL OR v_linked_number IS NULL THEN
    RAISE EXCEPTION 'One or both tickets not found';
  END IF;

  -- Insert link (one direction — query handles bidirectional lookup)
  INSERT INTO support_ticket_links (ticket_id, linked_ticket_id, link_type, linked_by)
  VALUES (p_ticket_id, p_linked_ticket_id, p_link_type, v_caller_id)
  RETURNING id INTO v_link_id;

  -- Log event on both tickets
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, new_value)
  VALUES (p_ticket_id, v_caller_id, 'ticket_linked', '#' || v_linked_number || ' (' || p_link_type || ')');

  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, new_value)
  VALUES (p_linked_ticket_id, v_caller_id, 'ticket_linked', '#' || v_ticket_number || ' (' || p_link_type || ')');

  RETURN jsonb_build_object('link_id', v_link_id, 'linked', true);
END;
$$;

-- 4. support_unlink_tickets RPC
CREATE OR REPLACE FUNCTION support_unlink_tickets(
  p_ticket_id UUID,
  p_linked_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_ticket_number INTEGER;
  v_linked_number INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT ticket_number INTO v_ticket_number FROM support_tickets WHERE id = p_ticket_id;
  SELECT ticket_number INTO v_linked_number FROM support_tickets WHERE id = p_linked_ticket_id;

  -- Delete link (either direction)
  DELETE FROM support_ticket_links
  WHERE (ticket_id = p_ticket_id AND linked_ticket_id = p_linked_ticket_id)
     OR (ticket_id = p_linked_ticket_id AND linked_ticket_id = p_ticket_id);

  -- Log event on both tickets
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value)
  VALUES (p_ticket_id, v_caller_id, 'ticket_unlinked', '#' || v_linked_number);

  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value)
  VALUES (p_linked_ticket_id, v_caller_id, 'ticket_unlinked', '#' || v_ticket_number);

  RETURN jsonb_build_object('unlinked', true);
END;
$$;

-- 5. support_search_tickets_for_link RPC
CREATE OR REPLACE FUNCTION support_search_tickets_for_link(
  p_query TEXT,
  p_exclude_ticket_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ticket_number INT,
  subject TEXT,
  status TEXT,
  requester_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT st.id, st.ticket_number, st.subject, st.status, st.requester_name
  FROM support_tickets st
  WHERE (
    st.ticket_number::TEXT = p_query
    OR st.subject ILIKE '%' || p_query || '%'
  )
  AND (p_exclude_ticket_id IS NULL OR st.id != p_exclude_ticket_id)
  ORDER BY st.ticket_number DESC
  LIMIT 10;
END;
$$;
```

### Step 4: Update support_create_ticket RPC

Create `supabase/migrations/20260315_support_create_ticket_v2.sql`:

The existing `support_create_ticket` RPC in `20260313_support_rpcs.sql` needs to be updated (via `CREATE OR REPLACE`) to accept two new optional parameters: `p_requester_phone` and `p_preferred_contact`. Look at the existing function signature and add the params with defaults. The INSERT statement should include the new columns.

**Important**: Use `CREATE OR REPLACE` so the existing function is updated in-place. The new params must have defaults so existing callers are not broken.

### Verification Steps

After applying all migrations:

```sql
-- Verify BACKLOG-940 RPCs
SELECT support_agent_analytics(30);
-- Should return JSONB with summary + agents

-- Verify new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'support_tickets'
AND column_name IN ('requester_phone', 'preferred_contact');

-- Verify support_ticket_links table
SELECT * FROM information_schema.tables WHERE table_name = 'support_ticket_links';

-- Verify requester search
SELECT * FROM support_search_requesters('test');

-- Verify recent tickets
SELECT * FROM support_requester_recent_tickets('test@example.com');

-- Verify ticket link search
SELECT * FROM support_search_tickets_for_link('1');
```

## Integration Notes

- Exports to: TASK-2185 (uses `support_search_requesters`, `support_requester_recent_tickets`, updated `support_create_ticket`)
- Exports to: TASK-2186 (uses `support_get_related_tickets`, `support_link_tickets`, `support_unlink_tickets`, `support_search_tickets_for_link`)
- Exports to: TASK-2187 (uses new event types `ticket_linked`, `ticket_unlinked`)
- Depends on: Nothing — this is the foundation task

## Do / Don't

### Do:
- Use `CREATE OR REPLACE` for all functions
- Add `IF NOT EXISTS` to table/index/column creation
- Use `SECURITY DEFINER` and `SET search_path = public` on all RPCs
- Add `auth.uid()` check as first line of every RPC
- Use Supabase MCP tools to apply migrations

### Don't:
- Don't modify any admin-portal files
- Don't drop any existing tables or functions
- Don't change existing RPC signatures (only add optional params with defaults)
- Don't forget ON DELETE CASCADE on foreign keys

## When to Stop and Ask

- If `profiles` table schema is different than expected (no `full_name`, `display_name`, or `phone` columns)
- If `support_create_ticket` RPC signature differs from what's in `20260313_support_rpcs.sql`
- If any migration fails with a constraint or type error
- If `organization_members` or `organizations` tables don't exist

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (SQL migrations — verified via manual queries)

### Coverage

- Coverage impact: N/A — no TypeScript code changed

### Integration / Feature Tests

- Required scenarios:
  - All RPCs callable after migration
  - `support_search_requesters` returns results for known email/name
  - `support_ticket_links` UNIQUE and CHECK constraints enforced
  - `support_create_ticket` still works with old params (backwards compat)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no TS changes, should be clean)
- [ ] Build step
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add DB migrations for requester lookup, ticket links, and pending RPCs`
- **Labels**: `support`, `database`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new migration files | +10K |
| Files to modify | 1 file (update support_create_ticket) | +5K |
| Code volume | ~250 lines SQL | +10K |
| Test complexity | Manual verification queries | +5K |

**Confidence:** High

**Risk factors:**
- Existing `support_create_ticket` function signature may need careful inspection
- `profiles` table schema assumption (full_name, display_name, phone columns)

**Similar past tasks:** TASK-2182 (actual: ~25K tokens for DB migration + RPC work)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] supabase/migrations/20260315_support_requester_lookup.sql
- [ ] supabase/migrations/20260315_support_ticket_links.sql
- [ ] supabase/migrations/20260315_support_create_ticket_v2.sql

Features implemented:
- [ ] BACKLOG-940 RPCs applied (analytics + delete)
- [ ] requester_phone + preferred_contact columns added
- [ ] support_search_requesters RPC created
- [ ] support_requester_recent_tickets RPC created
- [ ] support_ticket_links table created
- [ ] support_get_related_tickets RPC created
- [ ] support_link_tickets RPC created
- [ ] support_unlink_tickets RPC created
- [ ] support_search_tickets_for_link RPC created
- [ ] support_create_ticket updated with new optional params

Verification:
- [ ] All RPCs callable from Supabase MCP
- [ ] npm run type-check passes (no TS changes)
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Lessons / Insights:**
<What did you learn? Patterns that worked well, estimation surprises, codebase discoveries, reusable approaches, or "None — straightforward implementation">

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

**Lessons / Insights:**
<Architecture observations, quality patterns worth replicating, review findings that inform future work, or "None">

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
