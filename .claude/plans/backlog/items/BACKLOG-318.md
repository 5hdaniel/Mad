# BACKLOG-318: Fix Loading State Layout Shift in EditContactsModal

## Type
UI / UX Polish

## Priority
Low

## Status
Done

**Sprint:** SPRINT-045
**PR:** #484
**Completed:** 2026-01-19

## Summary

When clicking "Edit Contacts", a "Loading contacts..." message appears briefly that shifts the interface down, then disappears when loading completes. This causes jarring layout shift and poor UX.

## Current Behavior

1. User clicks "Edit Contacts" button
2. Modal opens with "Loading contacts..." text at top of content area
3. This text pushes the role assignment sections down
4. When loading completes, the text disappears
5. Content shifts up - jarring visual experience

## Expected Behavior (Options)

**Option 1: Loading Overlay**
- Semi-transparent overlay blocking the modal content
- Centered spinner over existing layout
- Content remains in place (no shift)

**Option 2: Inline Spinner**
- Small spinner that doesn't affect layout
- Fixed position or absolute positioning
- Content layout unchanged

**Option 3: Skeleton/Placeholder**
- Show placeholder content that matches final layout dimensions
- Smooth transition to real content

## Affected Files

- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`
- The `useContactsLoader` hook shows loading state (lines ~420-428)

## Acceptance Criteria

- [ ] No visible layout shift when opening EditContactsModal
- [ ] Loading indicator still present so user knows data is loading
- [ ] Smooth visual transition from loading to loaded state
- [ ] Works consistently regardless of load time

## Technical Notes

The loading state is managed by the `useContactsLoader` hook. The fix should modify how the loading UI is rendered rather than the loading logic itself.

## Estimated Effort

~5K tokens (simple CSS/layout fix)

## Discovered During

User testing - 2026-01-19
