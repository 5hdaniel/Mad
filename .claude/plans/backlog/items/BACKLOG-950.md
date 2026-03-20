# BACKLOG-950: Agent Ticket Creation — Requester Lookup & Contact Fields

**Priority:** High
**Type:** Feature
**Area:** Admin Portal + Supabase
**Status:** Completed
**Created:** 2026-03-15

---

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

---

## Summary

Upgrade the admin portal "Create Ticket" dialog from manual requester entry to an autocomplete-driven workflow with new contact fields. When an agent takes a phone call and needs to create a ticket, they should be able to search for the caller, auto-fill their info, see recent tickets to avoid duplicates, and capture phone/contact preference.

---

## Problem

The current `CreateTicketDialog` requires agents to manually type requester email and name every time. This causes:

1. **Slow ticket creation** — agent must ask for and manually type contact info on every call
2. **No duplicate prevention** — agent has no visibility into the caller's existing open tickets
3. **No phone number capture** — callers provide phone numbers but there's nowhere to store them
4. **No preferred contact method** — agents don't know if the customer prefers email or callback
5. **Typos and inconsistency** — manual entry leads to the same customer appearing under slightly different names/emails

---

## Solution

### 1. Requester Search Autocomplete

Replace the separate email/name inputs with a single search field at the top of the form:

- Agent types 2+ characters → debounced search (300ms) queries profiles, auth.users, and organizations
- Results show: **Name — email — Organization**
- Search matches against: name, email, and organization name (one search field, multiple vectors)
- Selecting a match auto-fills: email, name, phone, organization
- Organization comes for free via the `organization_members → organizations` join — no separate org lookup needed

#### "New Contact" Flow

If no match is found, show an inline option: **"No match — enter contact details manually"**
- Clicking it reveals the manual entry fields (email, name, phone) so the agent can type freely
- This replaces the current always-visible manual fields

### 2. Organization Context (Automatic)

When a requester is selected and they belong to an organization:
- Show the org name as a badge/label below the requester field
- Show a small expandable "Other members at [Org Name]" list (clickable to switch requester)
- This helps when the caller says "I'm calling from Acme Realty" but the agent picked the wrong person

No separate org search field needed — the org comes from the user match automatically.

### 3. New Database Fields

Add two columns to `support_tickets`:

```sql
ALTER TABLE support_tickets
  ADD COLUMN requester_phone TEXT,
  ADD COLUMN preferred_contact TEXT DEFAULT 'email'
    CHECK (preferred_contact IN ('email', 'phone', 'either'));
```

- **requester_phone** — optional, denormalized like requester_email/name
- **preferred_contact** — defaults to 'email'; agent sets based on caller preference

### 4. New Form Fields

Add to the CreateTicketDialog form:

- **Phone Number** — text input, optional, shown in the requester section
- **Preferred Contact Method** — radio group or segmented control: Email | Phone | Either

### 5. Recent Tickets Panel (Duplicate Prevention)

Once a requester is identified (by email match), display their recent/open tickets below the requester section:

- Show last 5 tickets (ordered by created_at DESC)
- Each row: ticket #, subject, status badge, created date
- Clickable — navigates to the existing ticket detail page
- If any are status `new`, `assigned`, `in_progress`, or `pending`, show a yellow notice: **"This customer has X open ticket(s) — consider adding to an existing ticket instead"**
- Panel only appears after requester selection, not during search

### 6. New Supabase RPC

```sql
CREATE OR REPLACE FUNCTION support_search_requesters(p_query TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  phone TEXT,
  organization_id UUID,
  organization_name TEXT,
  open_ticket_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    COALESCE(p.full_name, p.display_name, u.email) AS name,
    p.phone,
    om.organization_id,
    o.name AS organization_name,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 7. Recent Tickets Query

```sql
CREATE OR REPLACE FUNCTION support_requester_recent_tickets(p_email TEXT)
RETURNS TABLE (
  id UUID,
  ticket_number INT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT st.id, st.ticket_number, st.subject, st.status, st.priority, st.created_at
  FROM support_tickets st
  WHERE st.requester_email = p_email
  ORDER BY st.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## UI Flow (Agent Experience)

```
1. Agent opens "Create Ticket" dialog
2. Types in search field: "john" or "acme" or "john@..."
3. Dropdown shows matches: "John Smith — john@acmerealty.com — Acme Realty (2 open)"
4. Agent selects John Smith
5. Auto-fills: email, name, phone (if on profile)
6. Shows org badge: "Acme Realty" with expandable member list
7. Shows recent tickets panel:
   ┌─────────────────────────────────────────────────────┐
   │ ⚠ This customer has 2 open ticket(s)               │
   │                                                     │
   │  #145  "Can't export PDF"        In Progress  3/12  │
   │  #139  "Login issue on iPad"     Pending      3/8   │
   │  #128  "Missing transaction"     Resolved     2/28  │
   └─────────────────────────────────────────────────────┘
8. Agent fills in: phone (if not on file), preferred contact, subject, description, etc.
9. Submits ticket
```

---

## Files Affected

| File | Change |
|------|--------|
| `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` | Major rewrite — add search autocomplete, new fields, recent tickets panel |
| `admin-portal/lib/support-queries.ts` | Add `searchRequesters()` and `getRequesterRecentTickets()` functions |
| `admin-portal/lib/support-types.ts` | Add `RequesterSearchResult`, `PreferredContact` type, update `CreateTicketParams` |
| `supabase/migrations/YYYYMMDD_support_requester_lookup.sql` | New columns + 2 new RPCs |
| `supabase/migrations/20260313_support_rpcs.sql` | Update `support_create_ticket` to accept phone + preferred_contact params |

---

## Acceptance Criteria

- [ ] Search autocomplete returns results matching name, email, or org name
- [ ] Selecting a result auto-fills email, name, phone, and org
- [ ] "No match" option allows manual entry of new contact info
- [ ] Org members shown as context after requester selection
- [ ] Phone number field present and saved to `support_tickets.requester_phone`
- [ ] Preferred contact method field present and saved to `support_tickets.preferred_contact`
- [ ] Recent tickets panel shows last 5 tickets for the selected requester
- [ ] Open ticket count shown inline in search results
- [ ] Warning displayed when requester has open tickets
- [ ] Clicking a recent ticket navigates to ticket detail
- [ ] Phone and preferred contact visible on ticket detail page (TicketSidebar)
- [ ] Search debounced at 300ms, minimum 2 characters
- [ ] Form still works for brand new contacts (no existing profile)

---

## Dependencies

- BACKLOG-938 (Support Platform Phase 1) — must be shipped (it is)
- `profiles` table must exist with name/phone fields (it does)
- `organization_members` + `organizations` tables must exist (they do)

## Estimated Effort

~50K tokens (new RPC + migration + major CreateTicketDialog rewrite + query layer + types + TicketSidebar updates)
