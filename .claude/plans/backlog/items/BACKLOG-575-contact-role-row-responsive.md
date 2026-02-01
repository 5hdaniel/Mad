# BACKLOG-575: ContactRoleRow Responsive Layout

## Summary
Make ContactRoleRow component responsive so the role dropdown wraps to next line on narrow screens.

## Problem
On narrow screens, the contact name was truncating with "..." and the source pill was being hidden under the dropdown.

## Solution
1. Added `flex-wrap` to outer container
2. Grouped dropdown and remove button together so they wrap as a unit
3. Removed `min-w-0` and `truncate` from contact name - name always shows fully
4. Added `flex-wrap` to name+pill row so pill can wrap if needed
5. Reduced dropdown min-width from 160px to 140px

## Layout Behavior
**Wide screen:**
```
[Avatar] [Name] [Pill]     [Dropdown ▼] [X]
```

**Narrow screen:**
```
[Avatar] [Name] [Pill]
         [Dropdown ▼] [X]
```

## Files Modified
- `src/components/shared/ContactRoleRow.tsx`

## Status
Completed - Sprint 066
