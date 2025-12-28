# BACKLOG-104: Dashboard UI to Emphasize Auto-Detection

**Priority:** Medium
**Category:** ui
**Status:** Pending
**Created:** 2025-12-28

---

## Description

Update the Dashboard component to prominently showcase the AI auto-detection features built in SPRINT-006 and SPRINT-007. Currently the Dashboard focuses on manual actions (Start New Audit, Browse Transactions, Manage Contacts). It should highlight the AI-powered automatic transaction detection that runs in the background.

## Background

SPRINT-006 and SPRINT-007 implemented:
- AI-powered email analysis for transaction detection
- Thread-based detection with 97% cost reduction
- Automatic transaction suggestions with approve/reject workflow
- LLM settings and feedback loop

Users should understand that the app is actively working to detect transactions for them.

## Proposed Changes

1. **Add "AI Detection Status" section** to Dashboard
   - Show count of pending auto-detected transactions awaiting review
   - Display recent detection activity (e.g., "5 new transactions detected today")
   - Link to pending review queue

2. **Visual indicators**
   - Badge on "Browse Transactions" showing pending review count
   - Subtle animation or pulse indicating AI is active
   - "Last scan" timestamp

3. **Educational element**
   - Brief explanation of how auto-detection works
   - Value proposition messaging

## Files to Modify

- `src/components/Dashboard.tsx` - Main dashboard layout
- Potentially new components for status display

## Acceptance Criteria

- [ ] Dashboard shows pending auto-detected transaction count
- [ ] Users can navigate directly to pending review from Dashboard
- [ ] AI activity status is clearly visible
- [ ] Design is consistent with existing dashboard style
- [ ] No performance impact from additional data fetching

## Estimated Effort

- **Turns:** 6-10
- **Tokens:** ~35K-50K
- **Time:** ~1-2h
- **Adjustment:** 1.0x (ui category)

---

## Dependencies

- Requires API to fetch pending auto-detected transaction count
- May need IPC handler if not already available

## Notes

This is a UX enhancement to improve visibility of the AI features. Should not change core functionality, just surface existing capabilities more prominently.
