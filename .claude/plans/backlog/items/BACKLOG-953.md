# BACKLOG-953: Customer-Side Ticket Closing

**Priority:** Medium
**Type:** Feature
**Area:** Broker Portal + Supabase
**Status:** Pending
**Created:** 2026-03-15

---

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

---

## Summary

Allow customers to close their own support tickets from the broker portal ticket detail page. Currently only agents can transition tickets through the status state machine. Customers should be able to mark a ticket as resolved/closed when their issue is handled, without needing to wait for an agent to do it.

---

## Problem

Today the customer ticket detail page (`broker-portal/app/support/[id]/page.tsx`) is read-only for status:
- Customer sees status badge but has no controls to change it
- If an agent resolves a ticket, the customer sees "This ticket has been resolved. Reply below to reopen it."
- If the customer's issue is actually fixed, they have no way to confirm/close it
- If the customer resolves their own issue (found the answer, no longer relevant), they can't close the ticket — it stays open until an agent notices

This creates unnecessary open ticket clutter and forces agents to follow up just to close tickets.

---

## Solution

### 1. "Close Ticket" Button on Customer Detail Page

Add a button to the customer ticket detail page header for tickets in certain statuses:

- **Visible when status is:** `new`, `assigned`, `in_progress`, `pending`, `resolved`
- **Not visible when:** `closed` (already closed)
- Button text: **"Close Ticket"** or **"Mark as Resolved"**
- Clicking shows a confirmation: "Are you sure you want to close this ticket? You can reopen it later by replying."
- On confirm: transitions ticket to `closed` status

### 2. Status Transition Rule Update

The current state machine only allows agents to transition statuses. Add a customer-side transition:

**New allowed customer transitions:**
- Any active status → `closed` (customer can close their own ticket at any point)

This should be a separate RPC or a flag on the existing `support_update_ticket_status` RPC to indicate the caller is the requester (not an agent). The RPC must verify:
- `auth.uid()` matches `requester_id` on the ticket, OR
- The caller's email matches `requester_email` on the ticket
- Only the `closed` transition is allowed for customers (they can't change to `assigned`, `in_progress`, etc.)

### 3. New RPC: `support_close_ticket_by_requester`

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

  -- Verify caller is the requester
  IF v_ticket.requester_id != v_caller_id
     AND v_ticket.requester_email != v_caller_email THEN
    RAISE EXCEPTION 'You can only close your own tickets';
  END IF;

  -- Already closed
  IF v_ticket.status = 'closed' THEN
    RAISE EXCEPTION 'Ticket is already closed';
  END IF;

  -- Close the ticket
  UPDATE support_tickets
  SET status = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Log event
  INSERT INTO support_ticket_events (ticket_id, actor_id, event_type, old_value, new_value)
  VALUES (p_ticket_id, v_caller_id, 'status_changed', v_ticket.status, 'closed');

  RETURN jsonb_build_object('closed', true);
END;
$$;
```

### 4. Broker Portal UI Changes

In `broker-portal/app/support/[id]/page.tsx`:

```
┌──────────────────────────────────────────────────┐
│  #145                                            │
│  Can't export PDF report                         │
│  Account Issues · Mar 12, 2026                   │
│                                    Normal  ● In Progress │
│                                                  │
│                               [ Close Ticket ]   │
└──────────────────────────────────────────────────┘
```

- Button styled as secondary/outline (not primary blue — closing is deliberate, not the main action)
- Confirmation dialog before closing
- After closing: page reloads, shows "This ticket is closed" state (same as current closed state)
- Button hidden when status is already `closed`

### 5. Reopening (Already Works)

The existing flow already handles reopening: when a ticket is `resolved` or `closed`, the customer can reply to reopen it. The `support_add_message` RPC transitions `resolved` → `in_progress` when a customer replies. For `closed` tickets, this behavior should also work (reply reopens).

If `closed` tickets currently block replies (the UI shows "This ticket is closed" with no reply form), consider whether customer-closed tickets should allow reopening via reply within a window (e.g., 5 days), matching the resolved ticket behavior.

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_support_close_by_requester.sql` | New RPC |
| `broker-portal/app/support/[id]/page.tsx` | Add "Close Ticket" button + confirmation |
| `broker-portal/lib/support-queries.ts` | Add `closeTicketByRequester()` function |
| `broker-portal/lib/support-types.ts` | (may not need changes if types are shared) |

---

## Acceptance Criteria

- [ ] "Close Ticket" button visible on customer ticket detail page for active tickets
- [ ] Button hidden when ticket is already closed
- [ ] Confirmation dialog shown before closing
- [ ] Only the requester can close their own ticket (RPC enforces ownership)
- [ ] Closing sets status to `closed`, records `closed_at` timestamp
- [ ] Status change event logged in `support_ticket_events`
- [ ] Page updates to show closed state after closing
- [ ] Agent sees the closure in the admin portal (event shows customer closed it)
- [ ] Closed tickets can still be reopened by replying (if within window)

---

## Dependencies

- BACKLOG-938 (Support Platform Phase 1) — must be shipped (it is)

## Estimated Effort

~20K tokens (1 new RPC + broker portal button + confirmation dialog + query function)
