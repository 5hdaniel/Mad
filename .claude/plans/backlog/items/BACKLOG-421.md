# BACKLOG-421: Broker Portal - Request Changes Text Color is White

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P2 (Medium)
**Category**: Bug Fix / UI
**Sprint**: SPRINT-050
**Estimate**: ~3K tokens

---

## Problem

When a broker uses "Request Changes" action, the text input field has white text on a light background, making it unreadable.

## Expected Behavior

- Text in the feedback/notes textarea should be black (or dark color)
- Text should be clearly visible while typing

## Fix

Find the textarea/input component in the Review Actions and add proper text color:

```tsx
// Change from:
<textarea className="..." />

// To:
<textarea className="... text-gray-900" />
```

## Files to Check

- `broker-portal/app/dashboard/submissions/[id]/page.tsx`
- `broker-portal/components/ReviewActions.tsx`

## Acceptance Criteria

- [ ] Text in Request Changes textarea is visible (black/dark color)
