# BACKLOG-630: Organization Settings Page

**Status:** Pending
**Priority:** High
**Category:** feature
**Effort:** ~40K tokens
**Created:** 2026-02-06

## Overview

Admin/IT Admin settings page at `/dashboard/settings` allowing organization-level configuration toggles. Uses existing DB columns where available and adds new JSONB settings for extended configuration.

## Business Value

- Admins can self-service configure org behavior without developer intervention
- Controls dual approval, SSO enforcement, broker assignment, and review requirements
- Foundation for BACKLOG-631 (User Groups) and BACKLOG-632 (Agent-Broker Assignment)

## Requirements

### Existing DB Columns (toggle controls)

1. `require_dual_approval` — require two approvals before submission accepted
2. `auto_reject_incomplete` — automatically reject submissions missing required fields
3. `sso_required` — enforce SSO-only login (no direct email/password)
4. `default_member_role` — dropdown to set default role for new members

### New JSONB Settings (stored in `organizations.settings` column)

5. `allow_direct_login` — allow email/password login alongside SSO
6. `enforce_broker_assignment` — require broker assignment on submissions (used by BACKLOG-632)
7. `require_review_notes` — require reviewers to add notes when approving/rejecting

### UI

- Page at `/dashboard/settings`
- Only visible to `admin` and `it_admin` roles
- Toggle switches for boolean settings
- Dropdown for `default_member_role`
- Save button with optimistic UI + error handling
- Success/error toast notifications

## Acceptance Criteria

- [ ] Settings page renders at `/dashboard/settings`
- [ ] Only admin/it_admin can access (redirect others)
- [ ] All 7 settings are toggleable/configurable
- [ ] Changes persist to Supabase
- [ ] RLS enforces admin-only writes on organizations table
- [ ] Page loads current values on mount

## Technical Considerations

- Use existing `organizations` table — add `settings JSONB DEFAULT '{}'` column if not present
- Server action for save (not client-side Supabase calls)
- Follow existing dashboard page patterns (layout, breadcrumbs, etc.)

## Dependencies

- None (standalone)

## Dependents

- BACKLOG-632 (reads `enforce_broker_assignment` toggle)

## References

- Existing `organizations` table schema
- Dashboard layout patterns in `broker-portal/app/dashboard/`
