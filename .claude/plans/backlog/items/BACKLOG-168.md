# BACKLOG-168: Dismissible Empty State Messages

## Summary

Add a dismiss button to empty state messages in the application, allowing users to hide informational messages like "All Caught Up - No transactions awaiting review. We'll notify you when new ones are detected."

## Problem

Currently, empty state messages are always displayed when there is no data to show. While these messages provide helpful context, some users may prefer to dismiss them after reading, especially power users who understand the application well.

Examples of empty state messages that should be dismissible:
- "All Caught Up - No transactions awaiting review. We'll notify you when new ones are detected."
- Other similar informational messages in empty state areas

## Proposed Solution

1. Add a dismiss/close button (e.g., "X" icon) to empty state message components
2. Persist the dismissed state so it remains hidden across sessions
3. Consider a "Don't show again" checkbox option for permanent dismissal
4. Optionally provide a way to restore dismissed messages (e.g., in Settings)

## Technical Considerations

### Storage Options
- **User preferences**: Store dismissed message IDs in user settings/preferences
- **Local storage**: Persist dismissed state locally per message type
- **Session-only**: Dismiss for current session only (simpler but less persistent)

### Implementation Approach
1. Create a reusable `DismissibleEmptyState` component wrapper
2. Track dismissed message IDs in user preferences or local storage
3. Add restore option in Settings screen if implementing persistent dismissal

## Acceptance Criteria

- [ ] Empty state messages display a dismiss button (e.g., "X" icon or "Dismiss" text)
- [ ] Clicking dismiss hides the message
- [ ] Dismissed state persists across app restarts (recommended)
- [ ] Messages reappear when relevant (e.g., after new data arrives and is cleared again) OR stay permanently dismissed (design decision needed)
- [ ] Accessible dismiss button with proper ARIA labels
- [ ] Consistent styling with existing UI patterns

## Priority

**Low** - Quality of life improvement, not blocking any workflows

## Category

`ui`

## Estimation

| Factor | Estimate |
|--------|----------|
| Tokens | ~20K |
| Token Cap | 80K |
| Complexity | Low-Medium |

## Open Questions

1. Should dismissed state be:
   - Per-session only?
   - Persistent but reset when new data arrives?
   - Permanent with restore option in Settings?

2. Which specific empty state messages should be dismissible? (Need to audit all empty states in the app)

## Related

- Dashboard empty states
- Transaction list empty states
- Any other empty state components in the application

---

*Created: 2026-01-05*
*Status: Pending*
