# Task TASK-2199: Support Ticket Notification Emails

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

Add email notifications for two key support ticket events: (1) when a support agent replies to a ticket, the customer receives an email notification with a preview of the reply and a link to view the full conversation, and (2) when a ticket is assigned to an agent, that agent receives an email notification with ticket details. These notifications use the email service from TASK-2197 and are triggered from the existing support ticket flows.

## Non-Goals

- Do NOT modify the email service module itself (`lib/email/`) -- that is TASK-2197, already merged
- Do NOT implement inbound email-to-ticket (email parsing) -- Sprint B scope
- Do NOT implement SLA breach notifications -- Sprint C scope
- Do NOT implement in-app notifications (push/websocket) -- separate backlog item
- Do NOT modify the invite flow -- that is TASK-2198
- Do NOT modify ticket creation flow (only reply and assignment notifications)
- Do NOT send emails for internal notes (agent-only comments) -- only customer-visible replies

## Deliverables

1. New file: `broker-portal/app/api/email/ticket-notification/route.ts` -- API route that admin portal calls after agent actions
2. Update: `admin-portal/lib/support-queries.ts` -- add email notification trigger after `support_add_message` RPC call for replies
3. Update: `admin-portal/lib/support-queries.ts` -- add email notification trigger after ticket assignment
4. New file: `broker-portal/__tests__/app/api/email/ticket-notification/route.test.ts` -- unit tests

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/lib/support-queries.ts` -- add notification triggers
- All new files listed in Deliverables

### Files this task must NOT modify:

- `broker-portal/lib/email/*` -- owned by TASK-2197 (read-only import)
- `broker-portal/lib/actions/inviteUser.ts` -- owned by TASK-2198
- `broker-portal/components/users/InviteUserModal.tsx` -- owned by TASK-2198
- `broker-portal/lib/support-queries.ts` -- customer-side, not involved in agent reply
- `broker-portal/app/dashboard/support/[id]/page.tsx` -- customer-side ticket view
- Any Electron app files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] When a support agent sends a reply (not an internal note), the customer receives an email notification
- [ ] The customer notification email contains: ticket subject, ticket number, reply preview (first 200 chars), link to view ticket in broker portal
- [ ] The customer notification email does NOT reveal internal notes or agent-only content
- [ ] When a ticket is assigned to an agent, that agent receives an email notification
- [ ] The assignment notification email contains: ticket subject, ticket number, customer name/email, priority, link to ticket in admin portal
- [ ] The API route at `/api/email/ticket-notification` validates the request (requires valid notification type and ticket data)
- [ ] The API route returns 200 on success and 400/500 on error with descriptive messages
- [ ] Email failures do NOT block the reply or assignment action (fire-and-forget pattern with error logging)
- [ ] Internal notes (message_type === 'internal_note') do NOT trigger customer notifications
- [ ] Unit tests verify: reply notification sent for customer-visible replies, internal notes do not trigger notification, assignment notification sent with correct data, error handling
- [ ] `npm run type-check` passes (in both admin-portal and broker-portal)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes (in both admin-portal and broker-portal)
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### Architecture: Cross-Portal Communication

The admin portal (where agents reply) and broker portal (where the email service lives) are separate Next.js apps. The notification flow is:

```
Admin Portal                         Broker Portal
(agent replies)                      (email service)
     |                                    |
     ├─ RPC: support_add_message ────►    |
     |                                    |
     ├─ fetch('/api/email/ticket-     ──► |
     |   notification', { POST })         ├─ sendTicketReplyNotification()
     |                                    ├─ Resend API
     |   (fire-and-forget, don't          |
     |    await in the main flow)         |
```

### API Route: `/api/email/ticket-notification`

```typescript
// broker-portal/app/api/email/ticket-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendTicketReplyNotification, sendTicketAssignmentNotification } from '@/lib/email';

interface TicketReplyNotificationRequest {
  type: 'reply';
  ticketId: string;
  ticketNumber: number;
  ticketSubject: string;
  customerEmail: string;
  customerName: string;
  agentName: string;
  replyPreview: string; // First 200 chars of the reply
  ticketUrl: string; // Full URL to view ticket in broker portal
}

interface TicketAssignmentNotificationRequest {
  type: 'assignment';
  ticketId: string;
  ticketNumber: number;
  ticketSubject: string;
  agentEmail: string;
  agentName: string;
  customerName: string;
  priority: string;
  ticketUrl: string; // Full URL to view ticket in admin portal
}

type NotificationRequest = TicketReplyNotificationRequest | TicketAssignmentNotificationRequest;

export async function POST(request: NextRequest) {
  try {
    // Validate request has an API secret (simple shared secret for inter-service auth)
    const authHeader = request.headers.get('x-api-secret');
    if (authHeader !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: NotificationRequest = await request.json();

    if (body.type === 'reply') {
      const result = await sendTicketReplyNotification({
        recipientEmail: body.customerEmail,
        recipientName: body.customerName,
        ticketSubject: body.ticketSubject,
        ticketNumber: body.ticketNumber,
        agentName: body.agentName,
        replyPreview: body.replyPreview,
        ticketUrl: body.ticketUrl,
      });
      return NextResponse.json({ success: result.success, messageId: result.messageId });
    }

    if (body.type === 'assignment') {
      const result = await sendTicketAssignmentNotification({
        recipientEmail: body.agentEmail,
        recipientName: body.agentName,
        ticketSubject: body.ticketSubject,
        ticketNumber: body.ticketNumber,
        customerName: body.customerName,
        priority: body.priority,
        ticketUrl: body.ticketUrl,
      });
      return NextResponse.json({ success: result.success, messageId: result.messageId });
    }

    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  } catch (err) {
    console.error('[TicketNotification] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Changes to `admin-portal/lib/support-queries.ts`

Add a fire-and-forget notification call after the existing `support_add_message` RPC for customer-visible replies:

```typescript
// After the existing addReply function succeeds and messageType is 'reply' (not 'internal_note'):

async function notifyCustomerOfReply(params: {
  ticketId: string;
  ticketNumber: number;
  ticketSubject: string;
  customerEmail: string;
  customerName: string;
  agentName: string;
  replyBody: string;
}) {
  try {
    const brokerPortalUrl = process.env.NEXT_PUBLIC_BROKER_PORTAL_URL || 'https://app.keeprcompliance.com';
    const replyPreview = params.replyBody.substring(0, 200) + (params.replyBody.length > 200 ? '...' : '');

    await fetch(`${brokerPortalUrl}/api/email/ticket-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        type: 'reply',
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        ticketSubject: params.ticketSubject,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        agentName: params.agentName,
        replyPreview,
        ticketUrl: `${brokerPortalUrl}/dashboard/support/${params.ticketId}`,
      }),
    });
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.error('[Support] Failed to send reply notification:', err);
  }
}
```

### Inter-Service Authentication

Use a simple shared secret (`INTERNAL_API_SECRET`) for the API route. This is adequate for now because:
- Both portals are internal services deployed on the same Vercel account
- The secret is stored in environment variables, never exposed to clients
- This can be upgraded to JWT-based auth later if needed

### Getting Customer and Agent Details

The admin portal `support-queries.ts` file already has access to the Supabase client. To get customer email and agent name for the notification:

```typescript
// Get customer info from the ticket
const { data: ticket } = await supabase
  .from('support_tickets')
  .select('subject, ticket_number, requester_email, requester_name, user_id')
  .eq('id', ticketId)
  .single();

// Get agent name from the current user
const { data: { user } } = await supabase.auth.getUser();
const { data: agentProfile } = await supabase
  .from('users')
  .select('full_name, email')
  .eq('id', user.id)
  .single();
```

### Important Details

- Only send customer notifications for `reply` message types, NOT `internal_note`
- The `replyPreview` should be plain text (strip any HTML/markdown), truncated to 200 chars
- The ticket URL for customer notifications points to the broker portal: `/dashboard/support/{ticketId}`
- The ticket URL for agent assignment notifications points to the admin portal: `/support/{ticketId}`
- Fire-and-forget pattern: the notification `fetch` call should NOT be awaited in the main reply/assignment flow. Use `.catch()` to handle errors silently.
- Environment variable `NEXT_PUBLIC_BROKER_PORTAL_URL` already exists in the broker portal. For admin portal, use `BROKER_PORTAL_URL` (server-side only, no `NEXT_PUBLIC_` prefix needed).

## Integration Notes

- Imports from: `broker-portal/lib/email` (TASK-2197 -- read-only dependency)
- Cross-portal: admin-portal calls broker-portal API route
- Environment variables needed:
  - `INTERNAL_API_SECRET` (both portals, same value)
  - `BROKER_PORTAL_URL` (admin portal, points to broker portal base URL)
- Depends on: TASK-2197 (email service must exist before this task can run)

## Do / Don't

### Do:

- Use fire-and-forget pattern for notification calls (don't block the main flow)
- Validate the notification type in the API route
- Strip HTML/markdown from reply body before creating preview
- Use `x-api-secret` header for inter-service authentication
- Log errors with `[Support]` or `[TicketNotification]` prefix
- Handle missing environment variables gracefully (log warning, skip notification)

### Don't:

- Don't send notifications for internal notes -- ever
- Don't block reply/assignment actions on email delivery success
- Don't expose the API route without authentication
- Don't send the full reply body in the email -- only a 200-char preview with "View full reply" link
- Don't modify the `lib/email/` module
- Don't modify broker-portal support queries (customer-side)
- Don't hardcode portal URLs -- use environment variables

## When to Stop and Ask

- If `sendTicketReplyNotification` or `sendTicketAssignmentNotification` are not exported from `broker-portal/lib/email`
- If the `support_tickets` table doesn't have `requester_email` or `requester_name` columns
- If the admin portal `support-queries.ts` reply function has a different signature than expected
- If you can't determine how ticket assignment currently works (what function/RPC handles it)
- If `INTERNAL_API_SECRET` creates security concerns or deployment issues
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write in `broker-portal/__tests__/app/api/email/ticket-notification/route.test.ts`:
  - Test reply notification: valid request returns 200 and calls `sendTicketReplyNotification`
  - Test assignment notification: valid request returns 200 and calls `sendTicketAssignmentNotification`
  - Test unauthorized request (wrong/missing x-api-secret) returns 401
  - Test invalid notification type returns 400
  - Test internal note does NOT trigger notification
  - Test error handling returns 500 with error message
- Mock strategy: Mock `@/lib/email` module (`jest.mock`)

### Coverage

- Coverage impact: New API route should have full test coverage for all code paths

### Integration / Feature Tests

- Manual test: Agent replies to ticket in admin portal -> customer receives email notification
- Manual test: Ticket assigned to agent -> agent receives email notification
- Manual test: Agent sends internal note -> NO email sent

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking (both admin-portal and broker-portal)
- [ ] Lint / format checks
- [ ] Build step (both admin-portal and broker-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add email notifications for ticket replies and agent assignments`
- **Labels**: `feature`, `email`, `support`, `broker-portal`, `admin-portal`
- **Depends on**: TASK-2197 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (API route + test) | +5K |
| Files to modify | 1 file (admin-portal support-queries) | +4K |
| Code volume | ~200 lines (API route + notification helpers + tests) | +4K |
| Test complexity | Medium (mocking fetch + email module) | +2K |

**Confidence:** Medium

**Risk factors:**
- Cross-portal communication adds complexity (inter-service fetch call)
- Admin portal support-queries.ts structure may require significant refactoring to add notification hooks
- Getting customer email from ticket data may require additional DB queries

**Similar past tasks:** Similar to service wiring tasks but cross-portal adds ~30% overhead. Applying 0.5x service multiplier but adding buffer for cross-portal complexity.

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
- [ ] broker-portal/app/api/email/ticket-notification/route.ts
- [ ] broker-portal/__tests__/app/api/email/ticket-notification/route.test.ts

Files modified:
- [ ] admin-portal/lib/support-queries.ts

Features implemented:
- [ ] API route for ticket email notifications
- [ ] Customer notification on agent reply
- [ ] Agent notification on ticket assignment
- [ ] Inter-service authentication (x-api-secret)
- [ ] Internal notes excluded from notifications
- [ ] Fire-and-forget error handling

Verification:
- [ ] npm run type-check passes (broker-portal)
- [ ] npm run type-check passes (admin-portal)
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run build passes (broker-portal)
- [ ] npm run build passes (admin-portal)
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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
