# Task TASK-2182: Expanded Search Vectors + ts_headline Snippets (DB Migration)

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

Create a new Supabase migration that expands support ticket full-text search to cover requester name/email and message bodies, and returns `ts_headline` highlight snippets showing where the search matched.

## Non-Goals

- Do NOT modify RLS policies
- Do NOT modify any other RPCs besides `support_list_tickets`
- Do NOT change grant permissions
- Do NOT create a separate search RPC
- Do NOT modify frontend code
- Do NOT add search within attachments or events

## Deliverables

1. New file: `supabase/migrations/20260315_support_expanded_search.sql`

This single migration file must contain all of the following:

## File Boundaries

N/A — sequential execution, single new file.

### Files to modify (owned by this task):

- `supabase/migrations/20260315_support_expanded_search.sql` (new)

### Files this task must NOT modify:

- Any existing migration files
- Any frontend files
- Any admin-portal files

## Acceptance Criteria

- [ ] Searching by requester name returns matching tickets
- [ ] Searching by requester email returns matching tickets
- [ ] Searching by message body text returns the parent ticket
- [ ] Existing search by subject/description still works
- [ ] `search_highlights` array is returned for each ticket when `p_search` is provided
- [ ] `search_highlights` contains field name, snippet with `<mark>` tags, and sender info for messages
- [ ] `search_highlights` is null/omitted when `p_search` is null
- [ ] Internal note messages do NOT match search for non-agent users
- [ ] Backfill populates search vectors for all existing tickets and messages
- [ ] All existing filters (status, priority, category, assignee) still work
- [ ] Pagination unchanged
- [ ] Audience filtering unchanged (agents see all, customers see own)

## Implementation Notes

### 1. Expand ticket search_vector trigger

The existing trigger only includes `subject` and `description`. Expand to include `requester_name` and `requester_email`.

**IMPORTANT:** The trigger column list is part of the trigger definition, not the function. You must `DROP TRIGGER` and recreate it.

```sql
-- Drop old trigger (column list is in the trigger, not the function)
DROP TRIGGER IF EXISTS support_tickets_search ON support_tickets;

-- Replace the function
CREATE OR REPLACE FUNCTION support_tickets_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.requester_name, '') || ' ' ||
    coalesce(NEW.requester_email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with expanded column list
CREATE TRIGGER support_tickets_search
  BEFORE INSERT OR UPDATE OF subject, description, requester_name, requester_email
  ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION support_tickets_search_trigger();
```

### 2. Add search_vector to support_ticket_messages

```sql
-- Add search_vector column
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create GIN index
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_search
  ON support_ticket_messages USING GIN (search_vector);

-- Create trigger function
CREATE OR REPLACE FUNCTION support_messages_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER support_messages_search
  BEFORE INSERT OR UPDATE OF body
  ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION support_messages_search_trigger();
```

### 3. Replace support_list_tickets RPC

The latest canonical version is in `supabase/migrations/20260313_support_security_fixes.sql` (lines 214-302). Use `CREATE OR REPLACE FUNCTION` to update it.

**Key changes to the search condition:**

Replace:
```sql
AND (p_search IS NULL OR t.search_vector @@ plainto_tsquery('english', p_search))
```

With:
```sql
AND (p_search IS NULL OR (
  t.search_vector @@ plainto_tsquery('english', p_search)
  OR EXISTS (
    SELECT 1 FROM support_ticket_messages m
    WHERE m.ticket_id = t.id
    AND m.search_vector @@ plainto_tsquery('english', p_search)
    AND (v_is_agent OR m.message_type != 'internal_note')
  )
))
```

**SECURITY-CRITICAL:** The `AND (v_is_agent OR m.message_type != 'internal_note')` clause prevents non-agent users from discovering terms in internal notes via search.

**Add ts_headline snippets to the data query:**

In the data query (not the count query), add a `search_highlights` field to each ticket's JSON. Only compute when `p_search IS NOT NULL`.

The highlight structure should be:
```json
{
  "search_highlights": [
    {"field": "subject", "snippet": "...issue with <mark>billing</mark>..."},
    {"field": "description", "snippet": "...<mark>billing</mark> portal shows..."},
    {"field": "requester_name", "snippet": "<mark>John</mark> Smith"},
    {"field": "message", "snippet": "...<mark>billing</mark> was corrected...", "sender_name": "Jane", "sent_at": "2026-03-10T..."}
  ]
}
```

Use `ts_headline` with these options:
```sql
ts_headline('english', field_text, plainto_tsquery('english', p_search),
  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=1')
```

**Implementation approach for highlights:** Use a helper to build the highlights array. For each ticket in the paginated result:

1. Check if subject matches → add subject headline
2. Check if description matches → add description headline
3. Check if requester_name matches → add requester headline
4. Check if requester_email matches → add requester headline
5. Query matching messages → add message headlines with sender_name and sent_at

Only include fields that actually match (don't generate headlines for non-matching fields).

**Keep existing search_highlights null when p_search is null** to avoid unnecessary computation.

### 4. Backfill existing data

```sql
-- Backfill ticket search vectors
UPDATE support_tickets SET search_vector = to_tsvector('english',
  coalesce(subject, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(requester_name, '') || ' ' ||
  coalesce(requester_email, '')
);

-- Backfill message search vectors
UPDATE support_ticket_messages SET search_vector = to_tsvector('english',
  coalesce(body, '')
);
```

### Important Details

- The `v_is_agent` variable is already computed at the top of the existing RPC — reuse it
- The count query does NOT need ts_headline computation — only the data query
- Both the count query AND the data query need the expanded search condition (ticket + message vectors)
- Remember the WHERE clause is duplicated (count query + data query) — update BOTH
- Test with `plainto_tsquery` which handles multi-word searches safely

## Integration Notes

- Imports from: Existing `support_tickets` and `support_ticket_messages` tables
- Exports to: TASK-2183 (frontend consumes the `search_highlights` field)
- Used by: Admin portal support pages via `listTickets()` in `admin-portal/lib/support-queries.ts`
- Depends on: Nothing (first task in sprint)

## Do / Don't

### Do:
- Use `CREATE OR REPLACE FUNCTION` for the RPC
- Use `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` for trigger changes
- Use `IF NOT EXISTS` for column/index additions (idempotent)
- Filter internal notes in the message search for non-agents
- Only compute ts_headline on the paginated result set (max 20 rows)

### Don't:
- Don't use ILIKE — use tsvector everywhere for consistency and performance
- Don't compute ts_headline in the count query
- Don't modify any other RPCs
- Don't forget to update BOTH WHERE clauses (count + data)
- Don't include internal_note matches for non-agent callers

## When to Stop and Ask

- If the `support_ticket_messages` table schema differs from expected (no `body` column, no `message_type` column)
- If the existing RPC has been modified since the security_fixes migration (check latest version)
- If there's already a `search_vector` column on `support_ticket_messages`
- If the migration would affect more than the listed tables

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (pure SQL migration)

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Required scenarios (manual SQL verification):
  - Call `support_list_tickets` with `p_search` matching a requester name
  - Call with `p_search` matching a message body
  - Verify `search_highlights` array structure
  - Verify internal notes filtered for non-agents
  - Verify backfill worked on existing data

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no TS changes, but CI runs it)
- [ ] Lint (no TS changes)
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): expand ticket search to messages, requesters with highlighted snippets`
- **Labels**: `support`, `database`
- **Depends on**: Nothing

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~15K-25K

**Token Cap:** 100K

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new migration file | +5K |
| Code volume | ~150-200 lines SQL | +10K |
| Complexity | Medium — RPC replacement with highlights | +5K |
| Test complexity | Low — manual SQL verification | +2K |

**Confidence:** High

**Risk factors:**
- ts_headline integration in RPC may require iteration
- Duplicated WHERE clause is easy to miss

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
- [ ] supabase/migrations/20260315_support_expanded_search.sql

Features implemented:
- [ ] Expanded ticket search_vector trigger
- [ ] Message search_vector column + index + trigger
- [ ] Updated support_list_tickets RPC with cross-table search
- [ ] ts_headline snippet generation
- [ ] Internal note filtering in message search
- [ ] Backfill existing data

Verification:
- [ ] Migration applies without errors
- [ ] Search by requester name returns correct tickets
- [ ] Search by message body returns parent ticket
- [ ] search_highlights populated correctly
- [ ] Internal notes filtered for non-agents
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any>

**Design decisions:**
<Document any>

**Issues encountered:**
<Document any>

**Lessons / Insights:**
<What did you learn?>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~20K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**

**Suggestion for similar tasks:**

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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

**Lessons / Insights:**

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
