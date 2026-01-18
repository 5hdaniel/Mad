# BACKLOG-174: Redesign "Start New Audit" Flow to Emphasize Automated Detection

**Created**: 2026-01-05
**Priority**: High
**Category**: ui
**Status**: Pending

---

## Description

When user clicks "Start New Audit", redirect to a screen that emphasizes the automated transaction extraction workflow rather than manual transaction creation.

## Current Behavior

Clicking "Start New Audit" opens manual transaction creation form directly.

## Desired Behavior

1. Show list of **pending/AI-detected transactions** awaiting review
2. Provide button to view **active transactions**
3. Offer manual creation as a secondary option ("Transaction not here? Add manually")

## Rationale

The automated transaction extraction is a key differentiator of Magic Audit. The current flow leads users to manual creation first, which undermines the product's core value proposition and trains users to bypass the automated workflow.

## Acceptance Criteria

- [ ] "Start New Audit" button opens pending transactions view
- [ ] Pending transactions list is prominently displayed
- [ ] "View Active Transactions" button is available
- [ ] "Add Manually" button is available as secondary option
- [ ] Clear visual hierarchy emphasizing automated detection

## Technical Notes

- May need to modify Dashboard component or create new routing
- Consider reusing existing PendingTransactionsSection component
- Ensure proper state management for navigation flow

## Estimated Tokens

~30,000

## Related Items

- BACKLOG-104: Dashboard UI to Emphasize Auto-Detection (Completed)
- BACKLOG-008: Redesign New Transaction Flow (file missing, may be related)

---

## Notes

This is a UX improvement to align user behavior with the product's core value proposition of automated transaction detection.
