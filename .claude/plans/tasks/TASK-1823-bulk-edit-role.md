# TASK-1823: Fix and Commit Bulk Edit Role Feature

## Objective

Commit three untracked user management files from a previous sprint, fix type errors, and clean up placeholder code.

## Backlog Item

BACKLOG-623

## Branch

`feature/bulk-edit-role`

## Status

Complete

## Files Changed

| File | Action |
|------|--------|
| `broker-portal/components/users/BulkEditRoleModal.tsx` | Added (new file) |
| `broker-portal/components/users/UserTableRow.tsx` | Added + fixed type error |
| `broker-portal/components/users/UserActionsDropdown.tsx` | Modified (added `onEditRole` prop + menu item) |
| `broker-portal/lib/actions/bulkUpdateRole.ts` | Added + cleaned up placeholder filter |
| `.claude/plans/backlog/items/BACKLOG-623.md` | Created backlog item |
| `.claude/plans/backlog/data/backlog.csv` | Added BACKLOG-623 entry |

## Implementation Summary

### Type Error Fix (UserTableRow.tsx line 123)

**Problem:** `UserTableRow` passed two props to `UserActionsDropdown` that were not in its interface:
- `invitationToken={member.invitation_token}` -- not used by dropdown
- `onEditRole={onEditRole}` -- useful but missing from interface

**Fix:**
- Removed `invitationToken` prop from the call site (not needed in the dropdown)
- Added `onEditRole?: () => void` as an optional prop to `UserActionsDropdownProps`
- Added "Edit Role" menu button to the dropdown UI (shown for active, non-pending members)

### Placeholder Filter Fix (bulkUpdateRole.ts lines 57-60)

**Problem:** A `filter()` call with `return true` and a TODO comment about server-side filtering.

**Fix:** The server-side filtering was already implemented via `.neq('user_id', user.id)` on line 72. Replaced the no-op filter with a direct assignment and added a clarifying comment.

### Deviations

None.

### Issues/Blockers

None.

## Engineer Checklist

- [x] Type error fixed
- [x] TypeScript compiles clean (no errors in changed files)
- [x] Placeholder code cleaned up
- [x] Backlog item created (BACKLOG-623)
- [x] Task file created
- [x] PR created

## Metrics

| Metric | Value |
|--------|-------|
| Estimated Tokens | ~15K |
| Actual Tokens | TBD (auto-captured) |
| Turns | ~15 |
| Files Changed | 6 |
