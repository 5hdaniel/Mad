# BACKLOG-939: Organization-Level Support Ticket Toggle

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

## Problem

There is no org-level control over whether users can submit support tickets. Some organizations may want to disable the support ticketing feature entirely — for example, orgs that handle support through their own channels, or orgs on plans where support is not included. Currently, if support ticketing is enabled globally, all org users can submit tickets regardless of org preference.

## Solution

Add an org-level boolean setting (`support_tickets_enabled`) that the organization's main admin can toggle from the broker portal settings page. This controls whether users in that org can access the ticket submission flow.

### Database Change

Add a column to the `organizations` table:

```sql
ALTER TABLE organizations
ADD COLUMN support_tickets_enabled BOOLEAN NOT NULL DEFAULT true;
```

### Backend Changes

- The ticket creation RPC must check `organizations.support_tickets_enabled` for the requesting user's org before allowing submission.
- Return a clear error (e.g., `SUPPORT_TICKETS_DISABLED`) when a user attempts to create a ticket and their org has the feature disabled.

### Broker Portal Changes (Org Admin Settings)

- Add a toggle to the org admin settings page: "Enable support tickets for your organization"
- Default: ON (enabled)
- Only the main org admin can change this setting
- Show confirmation dialog when disabling: "Disabling this will hide the support section for all users in your organization."

### Desktop App / Customer UI Changes

- When `support_tickets_enabled = false` for the user's org:
  - Hide the support section entirely, OR
  - Show a message: "Support tickets are not enabled for your organization. Contact your organization administrator for assistance."
- When `support_tickets_enabled = true` (default): normal ticket submission and viewing behavior

### Broker Portal Customer View

- Same behavior as desktop: hide or show messaging when disabled
- When enabled: users can submit and view tickets as normal

## Acceptance Criteria

- [ ] `support_tickets_enabled` column added to `organizations` table (default `true`)
- [ ] Ticket creation RPC rejects submissions when org has `support_tickets_enabled = false`
- [ ] Broker portal org admin settings page includes the toggle
- [ ] Only org main admin can toggle the setting
- [ ] Desktop app hides support or shows "not enabled" message when disabled
- [ ] Broker portal customer view respects the flag
- [ ] Enabling the toggle restores full ticket functionality
- [ ] RLS policies updated to respect the new column where needed

## Estimation

~30K tokens (schema migration + RPC guard + broker portal toggle UI + desktop/broker conditional rendering)

## Dependencies

- BACKLOG-938 (Support Platform — Core Ticketing) must have base ticketing infrastructure in place before this toggle is meaningful
- `organizations` table must exist (already does)
