# BACKLOG-943: Support Ticket Email Notifications

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** Pending
**Created:** 2026-03-13

---

## Summary

Add email notifications for support ticket lifecycle events. When tickets are created, replied to, or have status changes, send email notifications to the relevant parties (requester, assignee, participants). Uses the Resend service from BACKLOG-941.

---

## Context

Support Platform Phase 1 (BACKLOG-938, SPRINT-130) shipped core ticketing with:
- Ticket creation (web form + admin-created)
- Conversation threads (public replies + internal notes)
- Status state machine (new -> assigned -> in_progress -> pending -> resolved -> closed)
- Participants/CC model (`support_ticket_participants` table)
- Ticket events audit log (`support_ticket_events` table)

The requirements doc (REQUIREMENTS-support-ticketing-v1.md) Section 9 specifies:
- Auto acknowledgment for newly created tickets
- v1: Notifications by email + replies handled in portal
- Outbound email uses support system addresses only (no personal mailboxes)

---

## Notification Events

| Trigger | Recipient(s) | Template | Notes |
|---------|-------------|----------|-------|
| Ticket created | Requester | `TicketCreatedEmail` | Acknowledgment with ticket number + portal link |
| Agent reply (public) | Requester + participants | `TicketReplyEmail` | New reply notification with snippet |
| Customer reply | Assignee (or all agents if unassigned) | `TicketCustomerReplyEmail` | Agent notification |
| Status -> Resolved | Requester | `TicketResolvedEmail` | Includes reopen instructions (5-day window) |
| Status -> Closed | Requester | `TicketClosedEmail` | Final notification |
| Ticket assigned | Assignee | `TicketAssignedEmail` | Agent notification of new assignment |

### Explicitly NOT included (Phase 2+)
- SLA warning/breach notifications
- Email-to-ticket (inbound parsing)
- Reply-via-email (customer replies to notification email to update ticket)
- Digest/summary emails
- Notification preferences per user

---

## Requirements

### 1. Email Templates (6 total)

All templates share the base layout from BACKLOG-941 and include:
- Ticket number + subject in email subject line
- Link to view ticket in portal (requester -> broker portal, agent -> admin portal)
- "Do not reply to this email" notice (v1 -- no inbound email parsing yet)

#### TicketCreatedEmail
- Subject: `[Keepr Support #123] Ticket received: {subject}`
- Body: Acknowledgment, ticket details (priority, category), portal link
- Recipient: requester_email

#### TicketReplyEmail
- Subject: `[Keepr Support #123] New reply on: {subject}`
- Body: Reply preview (first 200 chars), sender name, portal link
- Recipient: requester_email + participant emails
- Skip: do NOT send to the person who wrote the reply

#### TicketCustomerReplyEmail
- Subject: `[Keepr Support #123] Customer replied: {subject}`
- Body: Reply preview, customer name, portal link to ticket detail
- Recipient: assignee email (or configured default if unassigned)

#### TicketResolvedEmail
- Subject: `[Keepr Support #123] Resolved: {subject}`
- Body: Resolution notice, "reply within 5 days to reopen", portal link
- Recipient: requester_email

#### TicketClosedEmail
- Subject: `[Keepr Support #123] Closed: {subject}`
- Body: Closure notice, "submit a new ticket if you need further help", portal link
- Recipient: requester_email

#### TicketAssignedEmail
- Subject: `[Keepr Support #123] Assigned to you: {subject}`
- Body: Ticket summary (requester, priority, category), portal link
- Recipient: assignee email

### 2. Notification Service

Create `lib/email/supportNotifications.ts` with typed functions:
```typescript
async function notifyTicketCreated(ticket: SupportTicket): Promise<void>
async function notifyTicketReply(ticket: SupportTicket, message: TicketMessage): Promise<void>
async function notifyCustomerReply(ticket: SupportTicket, message: TicketMessage): Promise<void>
async function notifyTicketResolved(ticket: SupportTicket): Promise<void>
async function notifyTicketClosed(ticket: SupportTicket): Promise<void>
async function notifyTicketAssigned(ticket: SupportTicket, assigneeEmail: string): Promise<void>
```

### 3. Integration Points

Notifications trigger from the existing RPCs/server actions:
- `support_create_ticket` RPC -> `notifyTicketCreated()`
- `support_add_message` RPC -> `notifyTicketReply()` or `notifyCustomerReply()` (based on sender role)
- `support_update_ticket_status` RPC -> `notifyTicketResolved()` or `notifyTicketClosed()`
- `support_assign_ticket` RPC -> `notifyTicketAssigned()`

**Architecture decision:** Notifications are triggered from the Next.js API layer (not from Postgres triggers), because:
- Resend API requires an HTTP call (not available from PL/pgSQL)
- Template rendering needs React
- Error handling is simpler in application code
- Can easily add rate limiting, deduplication, preferences later

This means the notification calls will be added to the admin-portal API routes/server actions that invoke these RPCs, or alternatively via a lightweight Supabase Edge Function triggered by database webhooks. The simpler approach for v1 is calling from the Next.js layer after the RPC succeeds.

### 4. Deduplication
- Do not send duplicate notifications within a 1-minute window for the same ticket + event type
- Use a simple in-memory or Redis-based dedup (in-memory is fine for v1 since the admin portal is a single Vercel deployment)

---

## Acceptance Criteria

- [ ] Ticket creation sends acknowledgment email to requester
- [ ] Agent public reply sends notification to requester and participants
- [ ] Customer reply sends notification to assigned agent
- [ ] Status change to Resolved sends resolution email to requester
- [ ] Status change to Closed sends closure email to requester
- [ ] Ticket assignment sends notification to new assignee
- [ ] All emails include ticket number, subject, and portal link
- [ ] Internal notes do NOT trigger customer-facing notifications
- [ ] Notification failure does not block the ticket action (fire-and-forget with logging)
- [ ] All notification sends logged in audit trail

---

## Dependencies

- BACKLOG-941 (Transactional Email Service Layer) -- must be completed first
- BACKLOG-938 (Support Platform Phase 1) -- must be shipped (it is)

## Estimated Effort

~60K tokens (6 email templates + notification service + integration into 6 trigger points + deduplication)
