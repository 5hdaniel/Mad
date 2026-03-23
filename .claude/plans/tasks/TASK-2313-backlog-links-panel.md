# TASK-2313: Backlog Links Panel on Support Ticket Detail Page

**Backlog ID:** BACKLOG-1343
**Sprint:** SPRINT-O
**Branch:** `feature/task-2313-backlog-links-panel`
**Branch From:** `int/identity-provisioning`
**Branch Into:** `int/identity-provisioning`
**Estimated Tokens:** ~15K

---

## Objective

Add a BacklogLinksPanel component to the support ticket detail sidebar that displays linked backlog items from the `support_ticket_backlog_links` table, showing each item's number, title, status, and link type.

---

## Context

- The `support_ticket_backlog_links` table already exists and has data
- Schema: `id (uuid), ticket_id (uuid), backlog_item_id (uuid), link_type (text), created_at (timestamptz), created_by (uuid)`
- Link types in use: `fix`, `related` (possibly also `duplicate`)
- The ticket detail page (`admin-portal/app/dashboard/support/[id]/page.tsx`) currently has NO UI for these links
- The PM module has `LinkedItemsPanel.tsx` which handles a similar pattern for pm_task_links -- reuse this pattern
- The sidebar currently contains: TicketSidebar + DiagnosticsPanel

---

## Requirements

### Must Do:
1. Create a `BacklogLinksPanel.tsx` component in `admin-portal/app/dashboard/support/components/`
2. Query `support_ticket_backlog_links` joined with `pm_backlog_items` to get item details (number, title, status, type, area)
3. Display each linked item with:
   - Item number (e.g., "BACKLOG-1339") as a link to the PM module item page
   - Title
   - Status badge (reuse existing badge patterns)
   - Link type label (Fix, Related, Duplicate)
4. Add the panel to the ticket detail page sidebar (right column, between TicketSidebar and DiagnosticsPanel)
5. Make the panel collapsible (match RelatedTicketsPanel pattern)
6. Show count in the section header (e.g., "Backlog Items (3)")
7. If no links exist, either hide the panel or show "No linked backlog items"

### Must NOT Do:
- Do not add create/edit/delete link functionality (read-only display for now)
- Do not modify the `support_ticket_backlog_links` table schema
- Do not modify `LinkedItemsPanel.tsx` in the PM module

---

## Acceptance Criteria

- [ ] BacklogLinksPanel component renders in the ticket detail sidebar
- [ ] Shows linked backlog items with item_number, title, status, and link_type
- [ ] Item numbers link to `/dashboard/pm/items/{item_number}` (or equivalent PM detail page)
- [ ] Panel is collapsible
- [ ] Panel shows count in header
- [ ] Empty state handled gracefully (no links = hidden or "No linked items" message)
- [ ] `npm run type-check` passes (in admin-portal)
- [ ] Matches visual style of existing sidebar panels (RelatedTicketsPanel, DiagnosticsPanel)

---

## Files to Modify

- `admin-portal/app/dashboard/support/components/BacklogLinksPanel.tsx` -- **NEW** component
- `admin-portal/app/dashboard/support/[id]/page.tsx` -- Add BacklogLinksPanel to sidebar
- `admin-portal/lib/support-queries.ts` -- Add query function for backlog links (or create RPC)

## Files to Read (for context)

- `admin-portal/app/dashboard/pm/components/LinkedItemsPanel.tsx` -- Pattern reference
- `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx` -- Sidebar panel pattern
- `admin-portal/app/dashboard/support/components/DiagnosticsPanel.tsx` -- Sidebar panel pattern
- `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` -- Current sidebar structure
- `admin-portal/app/dashboard/support/[id]/page.tsx` -- Where to add the panel

---

## Implementation Notes

### Data Query

You will need to join `support_ticket_backlog_links` with `pm_backlog_items`:

```sql
SELECT
  l.id, l.link_type, l.created_at,
  b.item_number, b.title, b.status, b.type, b.area, b.priority
FROM support_ticket_backlog_links l
JOIN pm_backlog_items b ON b.id = l.backlog_item_id
WHERE l.ticket_id = $1
ORDER BY l.created_at DESC;
```

This may need an RPC if RLS blocks direct access, or you can use the Supabase client with a service role if the admin portal already does that.

### Link Type Display

| DB Value | Display Label | Color |
|----------|---------------|-------|
| `fix` | Fix | green |
| `related` | Related | blue |
| `duplicate` | Duplicate | gray |

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI component, tested via manual QA)

### Manual Testing
- View a ticket that has backlog links (ticket_id: `35994c8c-0c16-45be-b023-e998d1814f2b` has 3 links)
- Verify all linked items display correctly
- Verify links navigate to PM module
- View a ticket with no backlog links -- verify graceful empty state

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] Build succeeds

---

## PR Preparation

- **Title:** `feat: add backlog links panel to support ticket detail sidebar (BACKLOG-1343)`
- **Branch:** `feature/task-2313-backlog-links-panel`
- **Target:** `int/identity-provisioning`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/identity-provisioning
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No UI for backlog links on ticket detail
- **After**: Collapsible BacklogLinksPanel in sidebar showing linked items
- **Actual Tokens**: ~XK (Est: 15K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- RLS blocks the join query and a new RPC is needed (create the RPC but flag it)
- `pm_backlog_items` table structure has changed since planning
- You need to add navigation routes that don't exist yet
- You encounter blockers not covered in the task file
