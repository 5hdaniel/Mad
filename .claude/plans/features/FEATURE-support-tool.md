# Feature: Internal Support Tool + Email Service

**Status:** Planning
**Created:** 2026-02-07
**Priority:** High

---

## Overview

Build an internal support/CRM tool into the broker portal (`/support` route) that enables support agents to manage customer tickets, impersonate users for debugging, track SLAs, and view telemetry. Also establish a transactional email service for team invites, ticket replies, and notifications.

---

## Phase 1: Email Service + Team Invites

### Email Service Setup

- **Provider**: Resend or Postmark (inbound + outbound, Next.js friendly)
- **Domain verification**: SPF/DKIM for magicaudit.com
- **Shared utility**: `sendEmail()` function usable across the app
- **Supabase Auth emails stay on Supabase built-in mailer** (no change)

### Email Routing

| Type | Service |
|------|---------|
| Auth emails (confirm, magic link, password reset) | Supabase built-in |
| Team invites | Resend/Postmark |
| Ticket replies (outbound) | Resend/Postmark |
| SLA alerts / notifications | Resend/Postmark |
| Inbound ticket creation (email → ticket) | Resend/Postmark inbound webhook |

### Team Invites

- Admin/IT Admin can invite users by email
- Invite creates a pending record, sends branded email with invite link
- Recipient clicks link → signs in with Microsoft/Google → auto-joins org with assigned role
- Invite expiration (7 days default)
- Resend/revoke invite from UI

---

## Phase 2: Support Tool

### Where It Lives

- New `/support` route in the broker portal (not a separate app)
- Gated behind support-specific roles
- Shares existing auth, deployment, and codebase

### Support Agent Roles

| Role | Permissions |
|------|-------------|
| `support_agent` (billing) | View/respond to billing tickets, basic customer info |
| `support_agent` (technical) | View/respond to technical tickets, view telemetry, diagnostics |
| `support_engineer` | All technical agent permissions + impersonation (read + action) |
| `account_manager` | View customer org health, SLA status, escalate, reassign |
| `support_supervisor` | Full access, manage agents, override SLAs, view all dashboards |

### Ticket System

#### Submission Channels

1. **Desktop app** - In-app ticket form with:
   - Subject + description
   - Screenshot attachment (capture or upload)
   - Automatic diagnostics report (app version, OS, sync status, recent errors)
   - Category selection (bug, feature request, billing, account)
2. **Email** - Customers email support@magicaudit.com:
   - Inbound parse webhook creates ticket
   - Sender email matched to org/user
   - Attachments stored in Supabase Storage
   - Reply threading via Message-ID / In-Reply-To headers

#### Ticket Fields

- ID, subject, description, category, priority (P1-P4)
- Status: `open`, `in_progress`, `waiting_on_customer`, `resolved`, `closed`, `reopened`
- Assigned agent, escalation level
- SLA tier (from org), SLA deadlines (response, resolution)
- Parent ticket ID (for incident linking)
- Created via (desktop_app, email, portal)
- Customer user ID, organization ID

#### Ticket Features

- **Threaded messages**: Agent and customer replies in a conversation view
- **Attachments**: Screenshots, diagnostics reports, files (Supabase Storage)
- **Reopen**: Customer or agent can reopen a resolved ticket (resets SLA clock for new response)
- **Internal notes**: Agent-only comments not visible to customer
- **Audit log**: Every action (created, assigned, escalated, resolved, reopened) timestamped

### Parent/Child Tickets (Incident Management)

- When an outage or widespread issue occurs:
  1. First ticket becomes the **incident** (parent)
  2. Subsequent related tickets linked as children
  3. Resolving parent auto-resolves children with "resolved via incident" note
  4. SLA clock runs on the parent; children inherit incident SLA
- Manual linking: agent can link/unlink tickets to an incident
- Incident dashboard: see all open incidents and affected ticket count

### SLA Engine

#### Tiers

- Per-org SLA policies (e.g., Enterprise, Standard, Free)
- Default global policy for orgs without a specific tier

#### Metrics

| Metric | Description |
|--------|-------------|
| **Time to first response** | Clock starts at ticket creation, stops at first agent reply |
| **Time to resolution** | Clock starts at creation, stops at status → resolved |
| **Business hours** | SLA clock only ticks during business hours (configurable per policy) |

#### Targets (Example)

| Tier | P1 Response | P1 Resolution | P2 Response | P2 Resolution |
|------|-------------|---------------|-------------|---------------|
| Enterprise | 1 hour | 4 hours | 4 hours | 24 hours |
| Standard | 4 hours | 24 hours | 8 hours | 48 hours |

#### Breach Handling

- Warning notification at 75% of SLA deadline
- Breach notification when SLA exceeded
- Auto-escalation on P1 breach (assign to supervisor)
- Breach log for reporting

### Escalation Workflow

- **Manual**: Agent escalates to supervisor or specialist
- **Automatic**: P1 tickets not responded to within SLA → auto-escalate
- **Escalation path**: support_agent → support_engineer → support_supervisor
- **Reassignment**: Supervisor can reassign to any agent

### Impersonation (View-As-User)

- Support engineers can impersonate a customer user
- **Read mode**: View their data as they see it (transactions, contacts, sync status)
- **Action mode**: Perform actions on their behalf (with explicit confirmation)
- **Audit trail**: Every impersonation session logged with:
  - Who impersonated whom
  - Duration
  - Actions taken
  - Reason (linked to ticket)
- **Permission**: Only `support_engineer` and `support_supervisor` roles
- **Safeguards**: Cannot impersonate admin users, session auto-expires after 30 minutes

### Telemetry Dashboard

#### Events Collected from Desktop App

| Event | Data |
|-------|------|
| App launch | Version, OS, timestamp |
| Sync success/failure | Duration, record count, error details |
| Error page shown | Error type, stack trace (sanitized), context |
| Crash report | Crash dump, last actions before crash |
| Feature usage | Which features used (optional, aggregate) |

#### Dashboard Views

- **Per-user**: Recent events, error rate, sync health, app version
- **Per-org**: Aggregate health, active users, common errors
- **Global**: System-wide error rates, version adoption, sync performance
- **Alerts**: Spike in errors, sync failures above threshold

### SLA Dashboard

- Open tickets by priority and SLA status (on track / at risk / breached)
- Average response and resolution times (by tier, by period)
- Agent performance (tickets resolved, avg response time)
- Breach history and trends
- Filterable by org, agent, priority, date range

---

## Database Schema (New Tables)

```
support_agents              - user_id, role_type, specializations, active
support_tickets             - id, subject, description, category, priority,
                              status, org_id, user_id, assigned_agent_id,
                              parent_ticket_id, sla_policy_id, created_via,
                              sla_response_deadline, sla_resolution_deadline,
                              first_responded_at, resolved_at, reopened_count
ticket_messages             - ticket_id, sender_type (agent/customer/system),
                              sender_id, body, is_internal_note
ticket_attachments          - ticket_id, message_id, file_name, file_url,
                              file_type, file_size (Supabase Storage)
ticket_assignments          - ticket_id, agent_id, assigned_at, unassigned_at,
                              reason (escalation/reassignment/auto)
ticket_events               - ticket_id, event_type, actor_id, metadata,
                              created_at (full audit log)
incident_links              - parent_ticket_id, child_ticket_id, linked_at,
                              linked_by
sla_policies                - id, name, tier, priority, response_target_mins,
                              resolution_target_mins, business_hours_only
sla_breaches                - ticket_id, policy_id, breach_type (response/resolution),
                              breached_at, escalated
email_threads               - ticket_id, message_id, in_reply_to, from_address
telemetry_events            - id, user_id, org_id, event_type, payload,
                              app_version, os, created_at
impersonation_log           - agent_id, target_user_id, ticket_id, reason,
                              started_at, ended_at, actions_taken
```

---

## Sprint Plan

| Sprint | Scope | Depends On |
|--------|-------|------------|
| **Sprint 0** | Email service setup (Resend/Postmark), domain verification, `sendEmail()` utility, team invite flow | - |
| **Sprint A** | DB schema, support agent roles, ticket CRUD, list/detail views, desktop app ticket form with screenshot + diagnostics upload | Sprint 0 |
| **Sprint B** | Email-to-ticket (inbound parse), outbound ticket replies, SLA engine with per-org tiers, assignment + escalation workflow | Sprint A |
| **Sprint C** | Parent/child incidents, reopen flow, SLA dashboard (response/resolution metrics, breach alerts) | Sprint B |
| **Sprint D** | Impersonation (read + action with audit trail), telemetry ingestion from desktop app, telemetry dashboard | Sprint A |

> Sprints C and D can run in parallel since they're independent.

---

## Open Questions

- [ ] Resend vs Postmark - evaluate both, pick one
- [ ] Business hours configuration - per-org or global?
- [ ] Telemetry opt-in/opt-out - do customers choose what to share?
- [ ] Desktop app diagnostics report format - what exactly to include?
- [ ] Email address: support@magicaudit.com - need to set up MX records
- [ ] Notification channels - email only, or also in-app notifications?
