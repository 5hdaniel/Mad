# BACKLOG-177: Clean Up Dashboard Import Status Display

**Created**: 2026-01-05
**Priority**: Medium
**Category**: ui
**Status**: Pending

---

## Description

The Dashboard shows redundant loading/placeholder elements under the import status. Should consolidate to a single status element and show proper completion states.

## Current Issues

1. Multiple loading placeholders appear when they shouldn't
2. This skeleton loader persists after import completes:
```html
<div class="ai-status-card-loading">
  <div class="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
  <div class="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
  <div class="h-3 w-48 bg-gray-200 rounded animate-pulse"></div>
</div>
```

## Desired Behavior

1. **Single import status element** - not multiple placeholders
2. **When import is done**, show one of:
   - "You're all caught up" (no new transactions)
   - "X new transactions found" (with action to review)
3. **Remove unnecessary loading skeleton** after import completes
4. These completion states are already built - just need proper display logic

## Acceptance Criteria

- [ ] Only one import status element shown at a time
- [ ] Loading skeleton removed when import completes
- [ ] Proper completion message displayed ("All caught up" or "X new found")
- [ ] Clean transition from loading -> complete state

## Technical Notes

- Check `data-testid="ai-status-card-loading"` usage
- Ensure state properly transitions from loading to complete
- May need to review Dashboard component conditional rendering

## Estimated Tokens

~15,000

## Related Items

- Dashboard component
- AI Detection Status section
- BACKLOG-104: Dashboard UI to Emphasize Auto-Detection (Completed)

---
