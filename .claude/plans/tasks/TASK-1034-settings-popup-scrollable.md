# TASK-1034: Fix Settings Popup Not Scrollable

**Status:** Pending
**Sprint:** Unassigned (Critical Bug Fix)
**Backlog Item:** BACKLOG-212
**Priority:** Critical
**Category:** fix

---

## Summary

The Settings popup modal is not scrollable, preventing users from accessing options that are below the visible area (such as "Force Re-import"). This is blocking user testing.

---

## Problem

The Settings modal has `overflow-hidden` on the container div, which clips content and prevents scrolling. The inner div has `overflow-y-auto` but the parent's `overflow-hidden` takes precedence, making the entire content area non-scrollable.

**User Impact:** Cannot access Force Re-import or any settings below the fold, blocking testing workflows.

---

## Root Cause

In `src/components/Settings.tsx` at line 249:

```tsx
// CURRENT (broken)
<div className="flex-1 min-h-0 overflow-hidden px-2">
```

The `overflow-hidden` class prevents the child's `overflow-y-auto` from working properly.

---

## Fix

Remove `overflow-hidden` from the class list:

**File:** `src/components/Settings.tsx`
**Line:** 249

```tsx
// BEFORE
<div className="flex-1 min-h-0 overflow-hidden px-2">

// AFTER
<div className="flex-1 min-h-0 px-2">
```

---

## Files to Change

| File | Change | Lines |
|------|--------|-------|
| `src/components/Settings.tsx` | Remove `overflow-hidden` from line 249 | -1 word |

**Total:** 1 file, trivial change

---

## Acceptance Criteria

- [ ] Settings modal is scrollable when content exceeds viewport height
- [ ] Force Re-import option is accessible by scrolling
- [ ] All settings options remain accessible
- [ ] No visual regression in Settings modal appearance
- [ ] TypeScript compiles without errors

---

## Testing

1. Open Settings modal
2. Resize window to be smaller than settings content
3. Verify scrollbar appears and content is scrollable
4. Scroll to bottom and confirm Force Re-import is visible and clickable
5. Verify no horizontal overflow issues

---

## Estimated Effort

| Metric | Estimate |
|--------|----------|
| Tokens | ~5K |
| Duration | ~5 minutes |
| Complexity | Trivial (single class removal) |

---

## Branch Information

**Branch From:** claude/real-estate-archive-app-011CUStmvmVNXPNe4oF321jJ
**Branch Name:** fix/TASK-1034-settings-scrollable
**Target:** claude/real-estate-archive-app-011CUStmvmVNXPNe4oF321jJ

---

## Engineer Section

### Agent ID

```
Engineer Agent ID: [TO BE FILLED BY ENGINEER]
```

### Implementation Summary

[TO BE FILLED BY ENGINEER AFTER IMPLEMENTATION]

---

## SR Engineer Review

### Agent ID

```
SR Engineer Agent ID: [TO BE FILLED]
```

### Review Checklist

- [ ] Fix is minimal and targeted
- [ ] No unintended side effects
- [ ] Commit message follows conventions
- [ ] Visual testing completed

---

## Related Items

| ID | Relationship |
|----|--------------|
| BACKLOG-212 | Parent backlog item |

---

## Changelog

- 2026-01-12: Task created
