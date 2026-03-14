# Task TASK-2173: Agent Dashboard - Ticket Detail & Conversation

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Build the ticket detail page in the admin portal at `/dashboard/support/[id]/`, including the conversation thread (public replies + internal notes with yellow highlight), reply composer with Reply/Internal Note toggle, status transition dropdown, assignment selector, and priority change control. Complete the query layer functions started in TASK-2172.

## Non-Goals

- Do NOT build the customer portal (TASK-2174+)
- Do NOT build attachment upload/download UI (TASK-2176)
- Do NOT build participant/CC management UI (TASK-2176)
- Do NOT build the events timeline UI (TASK-2176)
- Do NOT implement rich text editing (plain textarea for Phase 1)
- Do NOT implement collision warnings
- Do NOT implement file uploads in the composer

## Deliverables

1. New file: `admin-portal/app/dashboard/support/[id]/page.tsx` -- Ticket detail page
2. New file: `admin-portal/app/dashboard/support/components/ConversationThread.tsx` -- Message thread
3. New file: `admin-portal/app/dashboard/support/components/ReplyComposer.tsx` -- Reply/note composer
4. New file: `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` -- Ticket metadata sidebar
5. New file: `admin-portal/app/dashboard/support/components/StatusBadge.tsx` -- Reusable status badge
6. New file: `admin-portal/app/dashboard/support/components/PriorityBadge.tsx` -- Reusable priority badge
7. Update: `admin-portal/lib/support-queries.ts` -- Add getTicketDetail, updateStatus, assignTicket, addMessage

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] `/dashboard/support/[id]/` renders full ticket detail with conversation thread
- [ ] Conversation shows messages in chronological order (oldest first)
- [ ] Internal notes are visually distinct: yellow/amber background, "Internal Note" label, lock icon
- [ ] Public replies have a standard white/gray background
- [ ] Each message shows: sender name/email, timestamp, body, message type indicator
- [ ] Reply composer at bottom with textarea and "Reply" / "Internal Note" toggle
- [ ] "Reply" sends `message_type = 'reply'`; "Internal Note" sends `message_type = 'internal_note'`
- [ ] Internal Note composer has a yellow/amber border to match note styling
- [ ] Ticket sidebar (right side) shows: status, priority, category, assignee, requester info, created date, updated date
- [ ] Status dropdown shows only allowed transitions from current status (use ALLOWED_TRANSITIONS map from support-types.ts)
- [ ] Changing status calls `support_update_ticket_status` RPC
- [ ] Assignment selector lists internal users
- [ ] Changing assignment calls `support_assign_ticket` RPC
- [ ] Priority selector allows changing priority
- [ ] Back button/link navigates to `/dashboard/support/` (the queue)
- [ ] Ticket subject and ticket number (#) shown in page header
- [ ] Page handles loading state (skeleton/spinner) and error state (ticket not found)
- [ ] `npx tsc --noEmit` passes in admin-portal

## Implementation Notes

### Page Layout

Two-column layout: conversation thread (left, ~70%) + sidebar (right, ~30%).

### Query Layer Additions (`support-queries.ts`)

Add these functions:

```typescript
export async function getTicketDetail(ticketId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_detail', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data;
}

export async function updateTicketStatus(ticketId: string, newStatus: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_update_ticket_status', {
    p_ticket_id: ticketId,
    p_new_status: newStatus,
  });
  if (error) throw error;
  return data;
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_assign_ticket', {
    p_ticket_id: ticketId,
    p_assignee_id: assigneeId,
  });
  if (error) throw error;
  return data;
}

export async function addMessage(ticketId: string, body: string, messageType: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_add_message', {
    p_ticket_id: ticketId,
    p_body: body,
    p_message_type: messageType,
  });
  if (error) throw error;
  return data;
}

export async function getAssignableUsers() {
  const supabase = createClient();
  // Get internal users who could be assigned tickets
  const { data, error } = await supabase
    .from('internal_roles')
    .select('user_id, role_id, profiles:user_id(email, full_name)');
  if (error) throw error;
  return data;
}
```

### Status Transition Dropdown

Use the `ALLOWED_TRANSITIONS` map from `support-types.ts`:
```typescript
const allowedNext = ALLOWED_TRANSITIONS[ticket.status];
// Show only allowed options
```

For `closed -> in_progress`, additionally check `support.admin` permission.

### Internal Note Styling

```typescript
<div className={`rounded-lg p-4 ${
  message.message_type === 'internal_note'
    ? 'bg-amber-50 border border-amber-200'
    : 'bg-white border border-gray-200'
}`}>
  {message.message_type === 'internal_note' && (
    <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-2">
      <Lock className="h-3 w-3" /> Internal Note
    </div>
  )}
</div>
```

### Reply Composer Toggle

Two toggle buttons: "Reply" (blue when active) and "Internal Note" (amber when active). When "Internal Note" is selected, add amber border to the composer area.

## Do / Don't

### Do:
- Match existing admin portal styling (Tailwind classes)
- Auto-scroll to bottom of conversation when new message is added
- Disable send button while message is being sent
- Clear composer and refresh conversation after successful send
- Handle optimistic updates for status/assignment changes

### Don't:
- Do NOT implement rich text (plain textarea)
- Do NOT implement file upload in composer (TASK-2176)
- Do NOT implement participant management UI (TASK-2176)
- Do NOT implement events timeline (TASK-2176)
- Do NOT install new UI libraries

## When to Stop and Ask

- If the `support_get_ticket_detail` RPC returns data in an unexpected format
- If there's no way to list internal users for the assignment dropdown
- If the join syntax for profiles on internal_roles doesn't work

## Testing Expectations

### Type Checking (MANDATORY)
- [ ] `npx tsc --noEmit` passes in `admin-portal/`

## PR Preparation

- **Title**: `feat(support): add agent dashboard ticket detail with conversation thread`
- **Labels**: `feature`, `ui`, `support`
- **Depends on**: TASK-2172

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~50K-70K

**Token Cap:** 280K (4x upper estimate)

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~70K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
