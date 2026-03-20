# BACKLOG-951: Related & Linked Tickets in Sidebar

**Priority:** Medium
**Type:** Feature
**Area:** Admin Portal + Supabase
**Status:** Completed
**Created:** 2026-03-15

---

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

---

## Summary

Add a "Related Tickets" section to the ticket detail sidebar that shows two types of related tickets:

1. **Auto-related** — other tickets from the same requester (by email), populated automatically
2. **Manually linked** — tickets explicitly linked by an agent via a "Link Ticket" button, with a search/ticket # lookup

This gives agents immediate context on the customer's history and lets them connect related issues across different requesters.

---

## Problem

Agents currently have no visibility into a requester's other tickets from the ticket detail page. They must manually search the queue to check for related issues. There's also no way to formally connect two tickets that are about the same underlying problem (e.g., a customer and their broker both reporting the same issue).

---

## Solution

### 1. Auto-Related Tickets (Same Requester)

When viewing a ticket, automatically query other tickets with the same `requester_email`:

- Show up to 5 most recent (excluding the current ticket)
- Display: ticket #, subject (truncated), status badge, created date
- Clickable — navigates to that ticket's detail page
- Sorted by created_at DESC
- Count shown in section header: "Related Tickets (3)"

### 2. Manually Linked Tickets

Agents can link any ticket to the current one via a "Link Ticket" button:

- Opens a small inline search: agent types a ticket # or keyword
- Debounced search returns matching tickets (by number or subject)
- Selecting a result creates a bidirectional link (both tickets show the link)
- Linked tickets shown with a link icon to distinguish from auto-related
- Links can be removed (unlinked) by the agent who created them or any admin

### 3. New Database Table

```sql
CREATE TABLE support_ticket_links (
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

CREATE INDEX idx_support_ticket_links_ticket ON support_ticket_links(ticket_id);
CREATE INDEX idx_support_ticket_links_linked ON support_ticket_links(linked_ticket_id);
```

**Link types:**
- `related` — general association (default)
- `duplicate` — this ticket is a duplicate of the linked one
- `parent` / `child` — hierarchical relationship (e.g., sub-issue)

### 4. New RPCs

```sql
-- Get related tickets for sidebar (auto + manual)
support_get_related_tickets(p_ticket_id UUID)
  → returns: ticket_id, ticket_number, subject, status, priority, created_at, link_type, is_manual_link

-- Link two tickets
support_link_tickets(p_ticket_id UUID, p_linked_ticket_id UUID, p_link_type TEXT)
  → creates bidirectional link + event

-- Unlink two tickets
support_unlink_tickets(p_ticket_id UUID, p_linked_ticket_id UUID)
  → removes both directions + event

-- Search tickets for linking (by number or subject)
support_search_tickets_for_link(p_query TEXT, p_exclude_ticket_id UUID)
  → returns: id, ticket_number, subject, status, requester_name
```

### 5. Event Logging

When a ticket is manually linked/unlinked, create an event in `support_ticket_events`:
- `event_type: 'ticket_linked'` — new_value: `"#123 (related)"`
- `event_type: 'ticket_unlinked'` — old_value: `"#123"`

Both tickets receive the event (bidirectional).

### 6. Sidebar UI

New section in `TicketSidebar`, placed between **Participants** and **Events Timeline**:

```
┌─────────────────────────────────┐
│ RELATED TICKETS (4)         ▲  │
│                                 │
│  🔗 #167 Can't export PDF      │
│     In Progress · Mar 12        │
│                                 │
│  🔗 #152 Login issue iPad       │
│     Resolved · Mar 5            │
│                                 │
│  ── auto (same requester) ──    │
│                                 │
│  #139 Missing transaction       │
│     Pending · Feb 28            │
│                                 │
│  #128 Sync not working          │
│     Closed · Feb 20             │
│                                 │
│  [+ Link Ticket]                │
│                                 │
│  ┌─ Link search ────────────┐  │
│  │ Search by # or subject...│  │
│  │                          │  │
│  │ #201 Password reset fail │  │
│  │ #198 Billing question    │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

- Manually linked tickets shown first with link icon, then auto-related below a subtle divider
- Collapsible section (same pattern as EventsTimeline)
- "Link Ticket" button opens inline search at the bottom
- Link type shown as subtle label if not "related" (e.g., "duplicate", "parent")

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_support_ticket_links.sql` | New table + RPCs |
| `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` | Add RelatedTickets section |
| `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx` | New component |
| `admin-portal/lib/support-queries.ts` | Add `getRelatedTickets()`, `linkTickets()`, `unlinkTickets()`, `searchTicketsForLink()` |
| `admin-portal/lib/support-types.ts` | Add `TicketLink`, `RelatedTicket` types |

---

## Acceptance Criteria

- [ ] Sidebar shows auto-related tickets (same requester email, excluding current)
- [ ] "Link Ticket" button opens inline search by ticket # or subject
- [ ] Selecting a search result creates a bidirectional link
- [ ] Linked tickets shown with link icon, distinguished from auto-related
- [ ] Link type selectable (related, duplicate, parent, child)
- [ ] Links can be removed by the linking agent or admins
- [ ] Link/unlink events logged in `support_ticket_events` for both tickets
- [ ] Clicking a related/linked ticket navigates to its detail page
- [ ] Section collapsible with count in header
- [ ] Duplicate links prevented (UNIQUE constraint)
- [ ] Self-linking prevented (CHECK constraint)

---

## Dependencies

- BACKLOG-938 (Support Platform Phase 1) — must be shipped (it is)

## Estimated Effort

~40K tokens (new table + 4 RPCs + RelatedTicketsPanel component + sidebar integration + types)
