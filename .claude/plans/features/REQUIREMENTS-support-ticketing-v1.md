# Support Platform — Core Ticketing Requirements (v1)

**Source:** Stakeholder requirements document, finalized 2026-03-13
**Referenced by:** FEATURE-support-tool.md, BACKLOG-938

> This document preserves the original stakeholder requirements verbatim. Implementation decisions and deviations are documented in FEATURE-support-tool.md.

---

## Scope
This document defines the finalized **Core Ticketing** requirements for `support.keeprcompliance.com` based on stakeholder decisions.

---

## 1) Intake Channels

### Launch channels
- Web form
- Email-to-ticket (multiple inbound addresses)
- In-app "Contact support" that routes users to the web form
- Admin-created tickets (including create-on-behalf-of for end users)

### Inbox model
- Single unified ticket system with channel/source metadata.
- Required source metadata:
  - `source_channel` (`web_form`, `email`, `in_app_redirect`, `admin_created`)
  - `source_address` (for email-origin tickets)

### Multi-user visibility in ticket
- v1 uses **Option A: CC/Participants**.
- One `requester_id` remains canonical owner.
- Additional users are stored as participants and receive notifications based on preferences.

---

## 2) Categories and Subcategories

### Top-level categories (v1 default)
1. Authentication & Access
2. Product Technical
3. Billing & Subscription
4. Compliance Guidance
5. IT / Organization Setup
6. How-To / Training
7. Feature Request

### Suggested subcategories
- **Authentication & Access**
  - Login failure
  - MFA/2FA issue
  - Account lockout
- **Product Technical**
  - App bug/error
  - Performance issue
  - Data sync/import/export issue
- **Billing & Subscription**
  - Invoice/payment issue
  - Plan/seat change
  - Refund/cancellation request
- **Compliance Guidance**
  - Product capability clarification
  - Process/policy question
  - Documentation request
- **IT / Organization Setup**
  - SSO setup
  - SCIM setup
  - Provisioning/user management
- **How-To / Training**
  - Workflow question
  - Best-practice guidance
- **Feature Request**
  - New feature
  - Enhancement request

### Compliance disclaimer
- Compliance category must show: "We provide product guidance and workflow support. We do not provide legal advice."

---

## 3) Ticket Types

### Ticket types (v1)
1. Login issue
2. Technical issue (not login)
3. Billing
4. Compliance
5. Feature request
6. IT Organization Setup (SSO/SCIM)
7. How-to question

### Priority (enabled in v1)
- `Low`, `Normal`, `High`, `Urgent`

---

## 4) Required and Conditional Fields

### Always required
- `id`
- `subject`
- `description`
- `status`
- `priority`
- `requester_id`
- `created_at`
- `updated_at`

### Workflow/SLA required fields
- `assignee_id` (nullable)
- `first_response_at`
- `resolved_at`
- `closed_at`
- `reopened_count`
- `pending_reason`
- `sla_first_response_deadline`
- `sla_resolution_deadline`
- `sla_first_response_met`
- `sla_resolution_met`

### Conditional requirements
- If `status = Pending`, `pending_reason` is required with allowed values:
  - `Customer`, `Vendor`, `Internal`
- If `reporting_for_other_user = true`, require:
  - `affected_user_count`
  - either participant list or explicit affected-user details
- Billing tickets require billing-specific fields (e.g., invoice number) when relevant.
- Phone number is collected but **not required**.

---

## 5) Status Workflow and Transitions

### Status set
- `New`, `Assigned`, `In Progress`, `Pending`, `Resolved`, `Closed`

### Core rules
- Do not use `Open` as a status.
- Unassigned is represented as `assignee_id = null`.
- `Resolved` is reopenable.
- `Closed` is final for customers.

### Allowed transitions
- `New -> Assigned`
- `New -> In Progress`
- `Assigned -> In Progress`
- `Assigned -> Pending`
- `In Progress -> Pending`
- `In Progress -> Resolved`
- `Pending -> In Progress`
- `Resolved -> In Progress` (customer reopen)
- `Resolved -> Closed` (auto-close after reopen window)
- `Closed -> In Progress` (admin manual reopen only)

### Reopen and auto-close
- Reopen window: 5 days from resolution.
- Customer reply during window reopens to `In Progress`.
- No customer reply after 5 days auto-closes ticket.

---

## 6) SLA Behavior

### First Response SLA
- Starts at ticket creation.
- Stops only on first **meaningful human agent** response.
- Automated acknowledgment does **not** count.

### Resolution SLA
- Starts at ticket creation.
- Runs while status is `New`, `Assigned`, `In Progress`.
- Pauses while `Pending`.
- Stops at `Resolved`.
- Remains stopped in `Closed`.
- If reopened, resume from remaining time.

---

## 7) Assignment and Ownership

### Assignment modes (tenant-configurable)
1. Manual assignment
2. Round-robin/load-balanced
3. Rule/skill-based auto-assignment

### Skill-based model input
- Team eligibility
- Agent skills (technical, billing, sales, escalation)
- Current active ticket load

### Ownership model
- Single owner (`assignee_id`)
- Additional collaborators via watchers/participants

---

## 8) Conversation UX

### Editor
- Rich text editor with basic formatting and code formatting.
- Internal notes and public replies are separate message types.

### Attachment policy (v1 defaults)
- Max file size: **25 MB per file**
- Max files per reply: **10**
- Allowed file types:
  - Images: `png`, `jpg`, `jpeg`, `gif`, `webp`
  - Documents: `pdf`, `txt`, `doc`, `docx`, `csv`, `xlsx`
  - Video: `mp4`, `mov`
  - Archives: `zip` (allowed)
- UI must show uploaded attachment list before send.

---

## 9) Customer Communications

### Auto acknowledgment
- Send immediate acknowledgment for newly created tickets.

### Email reply model (clarified)
- **v1:** Notifications by email + replies handled in portal.
- **v1.5:** Add inbound email threading (customer can reply via email and update same ticket).

### Sender identity
- Outbound support email uses support system addresses only.
- No personal/individual mailbox sending.

---

## 10) Visibility, Permissions, Search, and Audit

### Roles (v1)
- `Admin`
- `Team Lead`
- `Agent`
- `Read-only`

### Visibility model
- Global visibility with role-based saved views at launch.
- Capability to restrict sensitive categories (e.g., Compliance/Billing) to authorized teams.

### Search and filter
- Full filtering and sorting by:
  - status, priority, assignee, team, type, customer, SLA risk, tags, channel
- Saved views required.
- Full-text search over ticket content and attachment metadata.

### Auditability
- Immutable audit log for ticket field/status/assignment changes with actor and timestamp.
- Collision warning when another agent is actively replying.
- Support merge/link tickets (for outage-style parent/child tracking).

---

## 11) Security and Compliance Baseline (v1)

Required day-1 controls:
- RBAC with least privilege defaults
- TLS in transit + encryption at rest
- Attachment malware scanning
- Retention policy (default 24 months; tenant-configurable)
- DSAR-ready user/org export and delete workflows
- PII-safe operational practices (masking/redaction aids)
- Full audit logs retained per policy
