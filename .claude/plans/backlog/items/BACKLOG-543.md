# BACKLOG-543: Audit Period Not Displayed After Transaction Creation Until Edit/Save

## Summary

When creating a new transaction, the audit period doesn't show in the Overview tab summary. User has to click Edit, then Save for the audit period to appear.

## Problem

- After creating a new transaction with a start date, the audit period is not displayed in the Overview tab
- The `started_at` field is either not being saved on initial creation, or the UI isn't refreshing properly after creation
- User must click Edit, then Save (without making changes) for the audit period to finally appear

## Expected Behavior

- Audit period should show immediately after creating a transaction
- If user entered a start date during creation, it should display as "Jan 1, 2026 - Ongoing" (or similar format with end date if provided)

## Technical Investigation Areas

1. **Transaction creation flow** - Check if `started_at` is included in the initial INSERT
2. **State refresh after creation** - Verify the transaction detail view re-fetches data after creation
3. **Component state** - Check if Overview tab is reading stale state from creation form instead of fetched data

## Acceptance Criteria

- [ ] After creating a transaction with a start date, the audit period displays immediately in Overview
- [ ] No edit/save workaround required
- [ ] Verify `started_at` is persisted correctly on initial creation

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-543 |
| Type | Bug |
| Category | UI/State |
| Priority | P3 |
| Status | Pending |
| Sprint | - |
| Estimated Tokens | ~15K |
| Created | 2026-01-27 |
