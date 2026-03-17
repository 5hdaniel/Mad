# Task TASK-2188: Customer-Side Ticket Closing

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

Allow customers to close their own support tickets from the broker portal ticket detail page. Currently only agents can transition ticket status. Customers should be able to mark a ticket as resolved/closed when their issue is handled, reducing open ticket clutter and unnecessary agent follow-ups.

## Non-Goals

- Do NOT modify the admin portal support pages
- Do NOT change the agent-side status transition state machine
- Do NOT add ticket reopening logic (already works via reply)
- Do NOT modify the support queue or list pages
- Do NOT touch any `admin-portal/` files

## Deliverables

1. New Supabase migration: `support_close_ticket_by_requester` RPC
2. Update: `broker-portal/app/support/[id]/page.tsx` — add "Close Ticket" button with confirmation dialog
3. Update: `broker-portal/lib/support-queries.ts` — add `closeTicketByRequester()` function

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/YYYYMMDD_support_close_by_requester.sql` (new migration)
- `broker-portal/app/support/[id]/page.tsx` — add close button + confirmation dialog
- `broker-portal/lib/support-queries.ts` — add query function

### Files this task must NOT modify:

- Any files under `admin-portal/`
- `broker-portal/app/support/page.tsx` (ticket list page)
- Any other Supabase RPCs (only create the new one)

## Acceptance Criteria

- [ ] New RPC `support_close_ticket_by_requester(p_ticket_id UUID)` created
- [ ] RPC verifies caller is the requester (`auth.uid()` matches `requester_id` OR email matches `requester_email`)
- [ ] RPC only allows transition to `closed` status (customers can't set other statuses)
- [ ] RPC sets `status = 'closed'`, `closed_at = now()`, `updated_at = now()`
- [ ] RPC logs `status_changed` event in `support_ticket_events`
- [ ] RPC rejects if ticket is already closed
- [ ] "Close Ticket" button visible on customer ticket detail page for active tickets (status: new, assigned, in_progress, pending, resolved)
- [ ] Button hidden when ticket status is `closed`
- [ ] Button styled as secondary/outline (not primary — closing is deliberate)
- [ ] Confirmation dialog shown: "Are you sure you want to close this ticket? You can reopen it later by replying."
- [ ] After closing: page refreshes/updates to show closed state
- [ ] Type-check passes: `cd broker-portal && npx tsc --noEmit`

## Implementation Notes

### RPC Implementation

```sql
CREATE OR REPLACE FUNCTION support_close_ticket_by_requester(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_email TEXT;
  v_ticket RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  SELECT id, status, requester_id, requester_email
  INTO v_ticket
  FROM support_tickets WHERE id = p_ticket_id;

  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF v_ticket.requester_id != v_caller_id
     AND v_ticket.requester_email != v_caller_email THEN
    RAISE EXCEPTION 'You can only close your own tickets';
  END IF;

  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'Ticket is already closed';
  END IF;

  UPDATE support_tickets
  SET status = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (p_ticket_id, v_caller_id, 'status_changed', v_ticket.status, 'closed');

  RETURN jsonb_build_object('closed', true);
END;
$$;
```

### UI Mockup

```
┌──────────────────────────────────────────────────┐
│  #145                                            │
│  Can't export PDF report                         │
│  Account Issues · Mar 12, 2026                   │
│                                    Normal  ● In Progress │
│                               [ Close Ticket ]   │
└──────────────────────────────────────────────────┘
```

### Query Function

```typescript
// In broker-portal/lib/support-queries.ts
export async function closeTicketByRequester(supabase: SupabaseClient, ticketId: string) {
  const { data, error } = await supabase.rpc('support_close_ticket_by_requester', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data;
}
```

## Sprint

SPRINT-134

## Backlog Items

BACKLOG-953

## Estimated Tokens

~20K

## Metrics

| Metric | Value |
|--------|-------|
| Planned tokens | 20000 |
| Actual tokens | - |
| Files changed | ~3 |
| Lines added | ~80 |
| Lines removed | ~5 |
