# Task TASK-2179: Support Ticket Email Notifications

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

Create 6 email notification templates for support ticket lifecycle events and a typed notification service that triggers them from the existing admin-portal ticket management flows. After this task, ticket participants automatically receive email notifications at key events (creation, reply, resolution, etc.).

## Non-Goals

- Do NOT modify the email service (`emailService.ts`) or base layout (`BaseLayout.tsx`) -- those are from TASK-2177
- Do NOT modify the invitation email templates -- those are from TASK-2178
- Do NOT add SLA warning/breach notifications
- Do NOT add email-to-ticket (inbound parsing)
- Do NOT add reply-via-email functionality
- Do NOT add notification preferences per user
- Do NOT add digest/summary emails
- Do NOT modify the Supabase RPCs -- notifications are triggered from the Next.js layer AFTER RPCs succeed

## Deliverables

1. New file: `admin-portal/lib/email/templates/TicketCreatedEmail.tsx`
2. New file: `admin-portal/lib/email/templates/TicketReplyEmail.tsx`
3. New file: `admin-portal/lib/email/templates/TicketCustomerReplyEmail.tsx`
4. New file: `admin-portal/lib/email/templates/TicketResolvedEmail.tsx`
5. New file: `admin-portal/lib/email/templates/TicketClosedEmail.tsx`
6. New file: `admin-portal/lib/email/templates/TicketAssignedEmail.tsx`
7. New file: `admin-portal/lib/email/supportNotifications.ts` -- typed notification functions
8. Update: admin-portal support pages/server actions that invoke ticket RPCs (add notification calls)
9. New file: `admin-portal/lib/email/__tests__/supportNotifications.test.ts`

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] 6 email templates created, all using `BaseLayout` from TASK-2177
- [ ] `supportNotifications.ts` exports 6 typed notification functions (see list below)
- [ ] **Ticket created** -> sends acknowledgment to requester with ticket number + portal link
- [ ] **Agent reply (public)** -> sends notification to requester + participants (NOT the replying agent)
- [ ] **Customer reply** -> sends notification to assignee (or default address if unassigned)
- [ ] **Status -> Resolved** -> sends resolution email to requester with reopen instructions
- [ ] **Status -> Closed** -> sends closure email to requester
- [ ] **Ticket assigned** -> sends notification to assignee with ticket summary
- [ ] Internal notes do NOT trigger customer-facing notifications
- [ ] All emails include ticket number in subject: `[Keepr Support #123] ...`
- [ ] All emails include a link to view the ticket in the appropriate portal
- [ ] Notification failure does NOT block the ticket action (fire-and-forget)
- [ ] `npx tsc --noEmit` passes in admin-portal
- [ ] All CI checks pass

## Implementation Notes

### Notification Service (`supportNotifications.ts`)

```typescript
import { sendEmail } from './emailService';
import { TicketCreatedEmail } from './templates/TicketCreatedEmail';
import { TicketReplyEmail } from './templates/TicketReplyEmail';
import { TicketCustomerReplyEmail } from './templates/TicketCustomerReplyEmail';
import { TicketResolvedEmail } from './templates/TicketResolvedEmail';
import { TicketClosedEmail } from './templates/TicketClosedEmail';
import { TicketAssignedEmail } from './templates/TicketAssignedEmail';
import type { SupportTicket, SupportTicketMessage } from '../support-types';

const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_BROKER_PORTAL_URL || 'https://app.keeprcompliance.com';
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'https://admin.keeprcompliance.com';

function ticketUrl(ticketId: string, portal: 'customer' | 'agent'): string {
  const base = portal === 'customer' ? PORTAL_BASE_URL : ADMIN_BASE_URL;
  return `${base}/support/${ticketId}`;
}

export async function notifyTicketCreated(ticket: SupportTicket): Promise<void> {
  void sendEmail({
    to: ticket.requester_email,
    subject: `[Keepr Support #${ticket.ticket_number}] Ticket received: ${ticket.subject}`,
    template: TicketCreatedEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      priority: ticket.priority,
      portalUrl: ticketUrl(ticket.id, 'customer'),
    }),
  });
}

export async function notifyTicketReply(
  ticket: SupportTicket,
  message: SupportTicketMessage,
  participantEmails: string[]
): Promise<void> {
  // Send to requester + participants, but NOT the person who wrote the reply
  const recipients = [ticket.requester_email, ...participantEmails]
    .filter(email => email !== message.sender_email);

  if (recipients.length === 0) return;

  void sendEmail({
    to: recipients,
    subject: `[Keepr Support #${ticket.ticket_number}] New reply on: ${ticket.subject}`,
    template: TicketReplyEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      senderName: message.sender_name || 'Support Agent',
      replyPreview: message.body.slice(0, 200),
      portalUrl: ticketUrl(ticket.id, 'customer'),
    }),
  });
}

export async function notifyCustomerReply(
  ticket: SupportTicket,
  message: SupportTicketMessage
): Promise<void> {
  const recipientEmail = ticket.assignee_email || process.env.SUPPORT_DEFAULT_EMAIL;
  if (!recipientEmail) return;

  void sendEmail({
    to: recipientEmail,
    subject: `[Keepr Support #${ticket.ticket_number}] Customer replied: ${ticket.subject}`,
    template: TicketCustomerReplyEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      customerName: message.sender_name || ticket.requester_name,
      replyPreview: message.body.slice(0, 200),
      portalUrl: ticketUrl(ticket.id, 'agent'),
    }),
  });
}

export async function notifyTicketResolved(ticket: SupportTicket): Promise<void> {
  void sendEmail({
    to: ticket.requester_email,
    subject: `[Keepr Support #${ticket.ticket_number}] Resolved: ${ticket.subject}`,
    template: TicketResolvedEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      portalUrl: ticketUrl(ticket.id, 'customer'),
    }),
  });
}

export async function notifyTicketClosed(ticket: SupportTicket): Promise<void> {
  void sendEmail({
    to: ticket.requester_email,
    subject: `[Keepr Support #${ticket.ticket_number}] Closed: ${ticket.subject}`,
    template: TicketClosedEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      portalUrl: ticketUrl(ticket.id, 'customer'),
    }),
  });
}

export async function notifyTicketAssigned(
  ticket: SupportTicket,
  assigneeEmail: string
): Promise<void> {
  void sendEmail({
    to: assigneeEmail,
    subject: `[Keepr Support #${ticket.ticket_number}] Assigned to you: ${ticket.subject}`,
    template: TicketAssignedEmail({
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      requesterName: ticket.requester_name,
      priority: ticket.priority,
      portalUrl: ticketUrl(ticket.id, 'agent'),
    }),
  });
}
```

### Template Pattern (All 6 Follow This)

Each template:
1. Wraps content in `BaseLayout` with a `preview` string
2. Shows ticket number prominently
3. Has a "View Ticket" button linking to the appropriate portal
4. Uses inline styles (no CSS classes)
5. Includes "Do not reply to this email" notice (from BaseLayout footer)

### Integration Points

Find and update these server-side files in admin-portal:

| Trigger | Where to add notification call | Which function |
|---------|-------------------------------|----------------|
| Ticket created | Server action/API route that calls `support_create_ticket` RPC | `notifyTicketCreated()` |
| Agent reply (public) | Server action that calls `support_add_message` RPC (check `message_type === 'reply'`) | `notifyTicketReply()` |
| Customer reply | Broker portal server action that calls `support_add_message` (or admin-portal if proxied) | `notifyCustomerReply()` |
| Status -> Resolved | Server action that calls `support_update_ticket_status` with new status `resolved` | `notifyTicketResolved()` |
| Status -> Closed | Server action that calls `support_update_ticket_status` with new status `closed` | `notifyTicketClosed()` |
| Ticket assigned | Server action that calls `support_assign_ticket` RPC | `notifyTicketAssigned()` |

**IMPORTANT**: The notification calls go in the Next.js layer (server actions / API routes), NOT in Postgres triggers. This is an architecture decision documented in BACKLOG-943.

**IMPORTANT**: For customer replies, the notification needs to reach the admin portal's notification service. Since the customer reply happens from the broker portal, you have two options:
1. Call the notification service from the broker portal (preferred -- duplicate the `notifyCustomerReply` in broker-portal)
2. Use a Supabase database webhook to trigger a notification

Option 1 is simpler for v1.

### Participant Email Collection

When sending `notifyTicketReply()`, you need participant emails. Query the `support_ticket_participants` table for the ticket to get CC/watcher emails. The admin-portal `support-queries.ts` already has `getTicketDetail()` which returns participants.

## Integration Notes

- Imports from: TASK-2177 (`sendEmail`, `BaseLayout`)
- Imports from: existing `admin-portal/lib/support-types.ts` (`SupportTicket`, `SupportTicketMessage`)
- Depends on: TASK-2177 (email service must exist)
- References: TASK-2178 (template patterns)
- Support Platform Phase 1 (BACKLOG-938) must be merged (it is, v2.9.5)

## Do / Don't

### Do:

- Use `BaseLayout` from TASK-2177 for all 6 templates
- Use the `void sendEmail(...)` pattern (fire-and-forget, no await in calling flow)
- Include ticket number in ALL email subjects: `[Keepr Support #123]`
- Link to the correct portal (customer -> broker portal, agent -> admin portal)
- Filter out the sender from reply notifications (don't notify someone about their own reply)
- Log notification sends: `console.log('[Support Notification] Sent ${type} for ticket #${number}')`

### Don't:

- Do NOT modify `emailService.ts` or `BaseLayout.tsx`
- Do NOT modify Supabase RPCs or database triggers
- Do NOT add email-to-ticket or reply-via-email
- Do NOT send notifications for internal notes (only public replies)
- Do NOT add deduplication in v1 (noted in BACKLOG-943 but deferred)
- Do NOT block ticket actions on notification failure

## When to Stop and Ask

- If you cannot locate the server actions / API routes that invoke ticket RPCs
- If the customer reply flow is not in the admin portal (may be in broker portal)
- If participant email data is not available from existing queries
- If you need to modify Supabase RPCs to get required data
- If adding notification calls requires restructuring existing server actions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `supportNotifications.test.ts`: Mock `sendEmail`, test each notification function sends to correct recipients with correct subject line. Test that agent reply excludes sender from recipients. Test that internal notes don't trigger customer notifications.
- Existing tests to update: None expected

### Coverage

- Coverage impact: New files, target >80% on `supportNotifications.ts`

### Integration / Feature Tests

- Required scenarios:
  - Manual: Create ticket -> verify acknowledgment email to requester
  - Manual: Reply as agent -> verify notification to requester (not to agent)
  - Manual: Reply as customer -> verify notification to assignee
  - Manual: Resolve ticket -> verify resolution email
  - Manual: Close ticket -> verify closure email
  - Manual: Assign ticket -> verify assignment email to assignee

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add email notifications for ticket lifecycle events`
- **Labels**: `feature`, `email`, `support`, `SPRINT-131`
- **Depends on**: TASK-2177

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30K-60K

**Token Cap:** 240K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 8 new files (6 templates, 1 notification service, 1 test) | +25K |
| Files to modify | 4-6 server action files (ticket CRUD integration points) | +20K |
| Code volume | ~500 lines | +10K |
| Test complexity | Medium (mock sendEmail, test routing logic) | +10K |

**Confidence:** Medium

**Risk factors:**
- Finding all integration points in admin portal may require exploration
- Customer reply notification routing (broker portal -> admin portal notification service)
- Participant email collection may need additional queries

**Similar past tasks:** Service-layer tasks typically come in at 0.5x estimate

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/lib/email/templates/TicketCreatedEmail.tsx
- [ ] admin-portal/lib/email/templates/TicketReplyEmail.tsx
- [ ] admin-portal/lib/email/templates/TicketCustomerReplyEmail.tsx
- [ ] admin-portal/lib/email/templates/TicketResolvedEmail.tsx
- [ ] admin-portal/lib/email/templates/TicketClosedEmail.tsx
- [ ] admin-portal/lib/email/templates/TicketAssignedEmail.tsx
- [ ] admin-portal/lib/email/supportNotifications.ts
- [ ] admin-portal/lib/email/__tests__/supportNotifications.test.ts

Features implemented:
- [ ] 6 notification functions in supportNotifications.ts
- [ ] All 6 templates render correctly
- [ ] Integration with ticket creation flow
- [ ] Integration with reply flow (agent + customer)
- [ ] Integration with status change flow (resolved + closed)
- [ ] Integration with assignment flow
- [ ] Internal notes excluded from notifications
- [ ] Sender excluded from reply notifications

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~60K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~60K | ~XK | +/-X% |
| Duration | - | X sec | - |

---

## SR Engineer Review (SR-Owned)

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

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
