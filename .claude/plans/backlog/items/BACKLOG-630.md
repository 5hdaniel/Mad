# BACKLOG-630: Admin Consent Page and Callback for Graph API

**Priority:** High
**Category:** ui
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Create `/setup/consent` page that redirects IT admins to Microsoft admin consent URL so desktop app permissions (Mail.Read, Contacts.Read) are pre-approved for all tenant users. Create callback route to capture consent result and update org record.

## Acceptance Criteria

- [ ] Consent page with Grant Permissions button and Skip option
- [ ] Callback captures consent result and updates organizations table
- [ ] Works with Microsoft admin consent URL format
- [ ] Graceful error handling

## Task File

`.claude/plans/tasks/TASK-1929-consent-page.md`

## Related

- Depends on: BACKLOG-628 (consent columns)
- Depends on: BACKLOG-627 (stable callback)
