# BACKLOG-631: Setup Callback Redirect to Admin Consent

**Priority:** Medium
**Category:** service
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Update the setup callback to redirect the IT admin to the `/setup/consent` page after successful org provisioning, instead of directly to `/dashboard`. This connects the setup flow to the admin consent flow.

## Acceptance Criteria

- [ ] After successful org provisioning, redirect to /setup/consent with tenant and org params
- [ ] Error paths unchanged

## Task File

`.claude/plans/tasks/TASK-1930-setup-redirect.md`

## Related

- Depends on: BACKLOG-630 (consent page must exist)
