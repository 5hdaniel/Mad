# Task TASK-2175: Customer Portal - Ticket Detail & Reply

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Build the customer ticket detail page at `/support/[id]/` in the broker portal, showing the conversation thread (excluding internal notes), a reply form, and ticket metadata. This page allows customers to view their ticket history and add replies.

## Non-Goals

- Do NOT show internal notes to customers (filter client-side as defense-in-depth)
- Do NOT show the events timeline to customers
- Do NOT allow customers to change status/priority/assignment
- Do NOT implement file upload in the reply form (TASK-2176)
- Do NOT implement rich text editing
- Do NOT implement email notifications

## Deliverables

1. New file: `broker-portal/app/support/[id]/page.tsx` -- Customer ticket detail page
2. New file: `broker-portal/app/support/components/CustomerConversation.tsx` -- Customer conversation thread
3. New file: `broker-portal/app/support/components/CustomerReplyForm.tsx` -- Reply form
4. New file: `broker-portal/app/support/components/TicketStatusBadge.tsx` -- Status badge for customer portal
5. Update: `broker-portal/lib/support-queries.ts` -- Add getTicketDetail, addReply functions

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] `/support/[id]/` renders ticket detail with conversation
- [ ] Page shows: ticket subject, ticket number, status badge, priority badge, category, creation date
- [ ] Conversation thread shows messages in chronological order (oldest first)
- [ ] Internal notes (message_type = 'internal_note') are NOT displayed (filter client-side even if RPC/RLS handles it)
- [ ] Each message shows: sender name, timestamp, body
- [ ] Agent messages vs customer messages have distinct visual styling (different alignment or background)
- [ ] Reply form at the bottom with textarea and "Send Reply" button
- [ ] Reply sends `message_type = 'reply'` via `support_add_message` RPC
- [ ] After successful reply: conversation refreshes, composer clears
- [ ] If ticket is closed: reply form is hidden, show "This ticket is closed" message
- [ ] If ticket is resolved: show "This ticket has been resolved. Reply to reopen." above the reply form
- [ ] Back link to `/support/` (ticket list)
- [ ] Page handles ticket not found (404-style message) and loading state
- [ ] Auth-aware: if logged in, replies use session; if not, user must provide email
- [ ] `npx tsc --noEmit` passes in broker-portal

## Implementation Notes

### Query Additions (`broker-portal/lib/support-queries.ts`)

```typescript
export async function getTicketDetail(ticketId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_detail', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data;
}

export async function addReply(ticketId: string, body: string, senderEmail?: string, senderName?: string) {
  const supabase = createClient();
  const params: Record<string, unknown> = {
    p_ticket_id: ticketId,
    p_body: body,
    p_message_type: 'reply',
  };
  if (senderEmail) {
    params.p_sender_email = senderEmail;
    params.p_sender_name = senderName;
  }
  const { data, error } = await supabase.rpc('support_add_message', params);
  if (error) throw error;
  return data;
}
```

### Message Styling

Differentiate customer vs agent messages:
```typescript
const isCustomerMessage = message.sender_email === ticket.requester_email;
// Customer messages: right-aligned, blue background
// Agent messages: left-aligned, gray background
```

### Closed/Resolved Ticket Handling

```typescript
{ticket.status === 'closed' ? (
  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
    This ticket is closed.
  </div>
) : ticket.status === 'resolved' ? (
  <>
    <div className="text-center py-2 text-amber-600 bg-amber-50 rounded-lg mb-4">
      This ticket has been resolved. Reply below to reopen it.
    </div>
    <CustomerReplyForm ... />
  </>
) : (
  <CustomerReplyForm ... />
)}
```

## Do / Don't

### Do:
- Match broker portal's existing theme
- Filter out internal_note messages client-side (defense-in-depth)
- Handle the resolved state with reopen messaging
- Make the page mobile-responsive
- Show relative timestamps alongside absolute dates

### Don't:
- Do NOT show internal notes under any circumstances
- Do NOT allow status/assignment changes by customers
- Do NOT implement file upload (TASK-2176)
- Do NOT install new UI libraries

## When to Stop and Ask

- If `support_get_ticket_detail` RPC doesn't filter internal notes for non-agent callers
- If `support_add_message` RPC doesn't work for unauthenticated callers
- If the RPC response format is unexpected

## Testing Expectations

### Type Checking (MANDATORY)
- [ ] `npx tsc --noEmit` passes in `broker-portal/`

## PR Preparation

- **Title**: `feat(support): add customer ticket detail and reply in broker portal`
- **Labels**: `feature`, `ui`, `support`
- **Depends on**: TASK-2174

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~35K-50K

**Token Cap:** 200K (4x upper estimate)

**Confidence:** Medium-High

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

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

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
