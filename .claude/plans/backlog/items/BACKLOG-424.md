# BACKLOG-424: Broker Portal Submission List UX Tweaks

**Created**: 2026-01-23
**Priority**: Low
**Category**: UX
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Two UX improvements for the submission list on the broker portal dashboard:

### 1. Make Entire Row Clickable

Currently only the "Review" button navigates to the submission detail. The entire row should be clickable for better UX.

**Before:**
```
| Property | Agent | Status | Messages | Actions |
| 123 Oak  | John  | Pending| 15 msgs  | [Review] | <- only button clickable
```

**After:**
```
| Property | Agent | Status | Submitted |
| 123 Oak  | John  | Pending| Jan 22    | <- entire row clickable
```

### 2. Remove Docs/Messages Column

The "Messages" column showing message and attachment counts is not needed on the list view. This information is visible on the detail page.

---

## Files to Modify

- `broker-portal/components/SubmissionList.tsx`

---

## Implementation

```tsx
// Make row clickable with cursor pointer
<tr
  key={submission.id}
  className="hover:bg-gray-50 cursor-pointer"
  onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
>
  {/* Remove Messages column */}
  {/* Remove Actions column with Review button */}
</tr>
```

---

## Acceptance Criteria

- [ ] Clicking anywhere on the row navigates to submission detail
- [ ] Row has hover state and pointer cursor
- [ ] Messages/Docs column removed from table
- [ ] Review button/Actions column removed (row click replaces it)

---

## Related

- BACKLOG-398: Portal - Dashboard + Submission List
- SPRINT-050: B2B Broker Portal Demo
