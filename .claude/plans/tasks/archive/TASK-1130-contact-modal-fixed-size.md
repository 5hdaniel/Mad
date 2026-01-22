# TASK-1130: Fix Contact Select Modal Size Consistency

## Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1130 |
| **Backlog Item** | BACKLOG-315 |
| **Sprint** | SPRINT-045 |
| **Priority** | Medium |
| **Estimated Tokens** | ~5K |
| **Status** | TODO |

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1130-contact-modal-fixed-size

---

## Summary

Fix the Select Contact modal (`ContactSelectModal.tsx`) so it maintains a consistent fixed size regardless of search results. Currently, the modal jumps around when searching as it resizes to fit content.

---

## Context

The modal uses `max-h-[80vh]` but has no minimum height constraint, allowing it to shrink when search results are filtered. This causes jarring visual changes during search interaction.

---

## Requirements

### Must Have
1. Modal maintains consistent dimensions when search results change
2. Content area scrolls within the fixed container
3. Empty state displays correctly (centered, not squished)

### Should Have
1. Smooth visual experience during search filtering
2. Proper vertical spacing in all states

### Must Not
1. Break existing contact selection functionality
2. Cause horizontal layout issues
3. Create TypeScript errors

---

## Implementation Plan

### Step 1: Modify Modal Container Height

**File:** `src/components/ContactSelectModal.tsx`

**Current (line 202):**
```tsx
<div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
```

**Change to:**
```tsx
<div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[70vh] max-h-[80vh] flex flex-col">
```

Using `h-[70vh]` as a fixed height provides:
- Consistent modal size during search
- Reasonable space on smaller screens (70% viewport)
- max-h-[80vh] still caps on very tall screens

### Step 2: Verify Content Scrolling

The content area (line 310) already has proper scroll handling:
```tsx
<div className="flex-1 overflow-y-auto p-4">
```

No changes needed here - `flex-1` will expand to fill fixed container.

### Step 3: Test Empty State

Verify the empty state (lines 311-331) centers properly within the fixed height container. The current flexbox layout should handle this automatically.

---

## Testing Requirements

### Manual Testing Checklist

- [ ] Modal size remains constant when typing in search
- [ ] Modal size remains constant when search filters to 0 results
- [ ] Modal size remains constant when clearing search
- [ ] Content scrolls properly with many results (50+)
- [ ] Empty state message is vertically centered
- [ ] Modal looks correct on smaller screens (test 768px viewport)
- [ ] Modal looks correct on larger screens (test 1920px viewport)

### Visual Regression Points

| State | Expected Behavior |
|-------|-------------------|
| Initial load (many contacts) | Scrollable list, fixed modal size |
| Searching (few matches) | Same modal size, shorter content area |
| No matches | Same modal size, centered empty message |
| After clearing search | Same modal size as initial |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ContactSelectModal.tsx` | Add fixed height to modal container |

---

## Acceptance Criteria

From BACKLOG-315:
- [ ] Modal maintains consistent size when search results change
- [ ] Content area scrolls within the fixed container
- [ ] Modal looks correct with 0 results (empty state centered)
- [ ] Modal looks correct with many results (scrollable list)
- [ ] No horizontal layout changes
- [ ] No TypeScript errors
- [ ] Visual appearance remains clean and professional

---

## Out of Scope

- Responsive breakpoint-specific sizing (can be a future enhancement)
- Animation on search result changes
- Modal position or width changes

---

## Dependencies

None - this is a standalone CSS fix.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Empty state looks awkward in larger modal | Test and adjust empty state styling if needed |
| Very short content lists look sparse | Fixed height is still reasonable (70vh) |

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | (inline execution - no subagent ID) |
| **Branch** | fix/TASK-1130-contact-modal-fixed-size |
| **Files Modified** | src/components/ContactSelectModal.tsx |
| **Lines Changed** | 1 |
| **Tests Added/Modified** | None (CSS-only change) |
| **PR Number** | #482 |

### Changes Made

Added `h-[70vh]` to the modal container class on line 202. This gives the modal a fixed height of 70% viewport height while still respecting `max-h-[80vh]` on smaller screens. The content area already had `flex-1 overflow-y-auto` so it automatically scrolls within the fixed container.

### Deviations from Plan

None - implemented exactly as specified in the task file.

### Testing Performed

- Type-check passes
- Lint passes
- Verified the class change is syntactically correct
