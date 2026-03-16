# BACKLOG-952: Unified Activity Timeline — Merge Messages & Events

**Priority:** Medium
**Type:** Feature
**Area:** Admin Portal
**Status:** Completed
**Created:** 2026-03-15

---

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

---

## Summary

Replace the current separated layout (messages in the conversation thread + events in the sidebar) with a single unified chronological timeline. Messages, status changes, assignee changes, priority changes, ticket links, and participant additions all appear as entries in one stream — giving agents a complete picture of what happened and when.

---

## Problem

Currently the ticket detail page splits activity into two disconnected views:

1. **ConversationThread** (left column) — only shows messages/replies and internal notes
2. **EventsTimeline** (sidebar) — only shows system events (status changes, assignments, etc.)

This means an agent can't see the full story in one place. For example:
- Customer sends a message at 2:00 PM
- Agent changes status to "In Progress" at 2:05 PM
- Agent replies at 2:10 PM
- Agent changes priority to "Urgent" at 2:15 PM

In the current UI, you'd see the messages on the left and the status/priority changes buried in the sidebar. You can't tell the chronological relationship between them without mentally cross-referencing timestamps.

Every major ticketing system (Zendesk, Freshdesk, Intercom, Linear) uses a unified timeline for exactly this reason.

---

## Solution

### 1. Unified Timeline Component

Create a new `ActivityTimeline` component that merges messages and events into a single chronological list:

- **Messages** render as they do today (card with sender, body, attachments)
- **Events** render as compact inline system cards:
  - Small icon + description + actor name + timestamp
  - Visually distinct from messages (smaller, muted colors, no card border)
  - Same info currently in EventsTimeline, just inline in the conversation

### 2. Event Card Designs

Each event type gets a compact inline card:

```
  ● Status changed: New → In Progress                    Daniel · Mar 12, 2:05 PM
  ▲ Priority changed: Normal → Urgent                    Daniel · Mar 12, 2:15 PM
  ☻ Assigned to Sarah Chen                               Daniel · Mar 12, 2:20 PM
  🔗 Linked to ticket #167 (duplicate)                    Daniel · Mar 12, 2:25 PM
  + Participant added: mike@acme.com (CC)                 Daniel · Mar 12, 2:30 PM
  − Participant removed: old@example.com                  Daniel · Mar 12, 2:35 PM
```

Style: gray background strip (not a full card), centered horizontally in the timeline, smaller text than messages. Similar to how Slack shows "John joined the channel" inline.

### 3. Timeline Data Structure

Merge messages and events into a single sorted array:

```typescript
type TimelineEntry =
  | { type: 'message'; data: SupportTicketMessage; timestamp: string }
  | { type: 'event'; data: SupportTicketEvent; timestamp: string };

function buildTimeline(
  messages: SupportTicketMessage[],
  events: SupportTicketEvent[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...messages.map(m => ({ type: 'message' as const, data: m, timestamp: m.created_at })),
    ...events.map(e => ({ type: 'event' as const, data: e, timestamp: e.created_at })),
  ];
  // Sort chronologically (oldest first for reading order, or newest first to match current)
  return entries.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
```

### 4. Sort Order

Use **oldest first** (chronological reading order) for the unified timeline. This is the standard for CRM conversation views — you read top to bottom like a chat. The current newest-first order made sense when messages were standalone, but a unified timeline reads better chronologically.

The reply composer stays pinned at the bottom (below the timeline), and new entries appear at the bottom.

### 5. Sidebar Changes

- **Remove** the `EventsTimeline` component from the sidebar (events now live in the main timeline)
- The sidebar becomes cleaner: status, priority, assignee, category, requester, participants, related tickets, dates, details
- Optionally keep a collapsed "Activity Summary" count in the sidebar as a quick reference (e.g., "12 messages, 5 events")

### 6. Event Types to Support

| Event Type | Inline Display | Icon |
|-----------|---------------|------|
| `created` | "Ticket created" | + (green) |
| `status_changed` | "Status: New → In Progress" | ● (blue) |
| `assigned` | "Assigned to Sarah Chen" | ☻ (purple) |
| `priority_changed` | "Priority: Normal → Urgent" | ▲ (orange) |
| `message_added` | *Skip — the message itself is already in the timeline* | — |
| `ticket_linked` | "Linked to #167 (duplicate)" | 🔗 (gray) |
| `ticket_unlinked` | "Unlinked from #167" | ✕ (gray) |
| `participant_added` | "Added mike@acme.com as CC" | + (gray) |
| `participant_removed` | "Removed old@example.com" | − (gray) |

Note: `message_added` events are **skipped** in the timeline since the message itself is already there. This prevents duplication.

---

## UI Layout Change

**Before (current):**
```
┌──────────────────────┐  ┌──────────────┐
│ Description (pinned) │  │ Status       │
│                      │  │ Priority     │
│ Reply Composer       │  │ Assignee     │
│                      │  │ Category     │
│ Message 3 (newest)   │  │ Requester    │
│ Message 2            │  │ Participants │
│ Message 1 (oldest)   │  │ Events ←──── separate!
│                      │  │ Dates        │
└──────────────────────┘  └──────────────┘
```

**After (unified):**
```
┌──────────────────────┐  ┌──────────────┐
│ Description (pinned) │  │ Status       │
│                      │  │ Priority     │
│ ● Status → Assigned  │  │ Assignee     │
│ ☻ Assigned to Sarah  │  │ Category     │
│                      │  │ Requester    │
│ Message 1 (reply)    │  │ Participants │
│                      │  │ Related Tkts │
│ ▲ Priority → Urgent  │  │ Dates        │
│                      │  │ Details      │
│ Message 2 (reply)    │  └──────────────┘
│                      │
│ + Added CC: mike@... │
│                      │
│ Message 3 (note)     │
│                      │
│ Reply Composer       │
└──────────────────────┘
```

---

## Files Affected

| File | Change |
|------|--------|
| `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` | New component — unified timeline rendering |
| `admin-portal/app/dashboard/support/components/ConversationThread.tsx` | Refactor `MessageList` or replace with `ActivityTimeline` |
| `admin-portal/app/dashboard/support/components/EventsTimeline.tsx` | Remove from sidebar (may keep for reference/delete) |
| `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` | Remove EventsTimeline import/usage |
| `admin-portal/app/dashboard/support/[id]/page.tsx` | Pass events to ActivityTimeline instead of sidebar; move composer to bottom |
| `admin-portal/lib/support-types.ts` | Add `TimelineEntry` union type |

---

## Acceptance Criteria

- [ ] Messages and events render in a single chronological stream (oldest first)
- [ ] Event cards are visually distinct from message cards (compact, muted, inline)
- [ ] Each event card shows: icon, description, actor name, timestamp
- [ ] Status changes show old → new value
- [ ] Priority changes show old → new value
- [ ] Assignment changes show assignee name
- [ ] `message_added` events are excluded (message itself is shown)
- [ ] Internal notes still have amber/yellow styling
- [ ] Reply composer positioned at the bottom of the timeline
- [ ] New messages/events appear at the bottom
- [ ] EventsTimeline removed from sidebar
- [ ] Ticket detail page layout otherwise unchanged
- [ ] Attachment display on messages unaffected
- [ ] Performance: timeline renders efficiently with 100+ entries

---

## Dependencies

- BACKLOG-938 (Support Platform Phase 1) — must be shipped (it is)
- BACKLOG-951 (Related & Linked Tickets) — if shipped first, `ticket_linked`/`ticket_unlinked` events render in timeline; if not, those event types just won't appear yet

## Estimated Effort

~35K tokens (new ActivityTimeline component + ConversationThread refactor + sidebar cleanup + types + sort order change)
