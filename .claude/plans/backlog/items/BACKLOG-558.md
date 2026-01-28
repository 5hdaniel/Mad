# BACKLOG-558: Refactor Sync Communications Button to Trigger Both Texts and Emails

**Created**: 2026-01-28
**Priority**: P2 (Medium)
**Type**: Enhancement
**Area**: Transaction UI / Communications

---

## Problem Statement

Currently the "Sync Communications" button on the Overview tab only syncs texts. This is misleading since "communications" implies both texts and emails. Users expect a unified sync option on the overview, with granular control available in individual tabs.

## Current Behavior

| Location | Button | Action |
|----------|--------|--------|
| Overview tab | "Sync Communications" | Syncs texts only |
| Email tab | "Sync Emails" | Syncs emails |
| Messages/Texts tab | (none) | No dedicated sync |

## Desired Behavior

| Location | Button | Action |
|----------|--------|--------|
| Overview tab | "Sync Communications" | Syncs BOTH texts and emails |
| Email tab | "Sync Emails" | Syncs emails only |
| Messages/Texts tab | "Sync Texts" | Syncs texts only |

## Acceptance Criteria

- [ ] "Sync Communications" button on Overview tab triggers both text sync and email sync
- [ ] New "Sync Texts" button added to Messages/Texts tab
- [ ] Email tab retains its existing "Sync Emails" button (no changes needed)
- [ ] Loading states handled correctly when both syncs are running
- [ ] Error handling displays appropriate messages for partial failures (e.g., texts succeeded but emails failed)
- [ ] Sync order: can run in parallel or sequential (implementation choice)

## Technical Considerations

1. **Parallel vs Sequential Sync**
   - Could run both syncs in parallel for speed
   - Sequential avoids potential race conditions
   - Consider using `Promise.allSettled()` to handle partial failures

2. **UI Feedback**
   - Button should show loading state while either sync is in progress
   - Consider showing which sync is currently running (e.g., "Syncing texts... Syncing emails...")

3. **Error Handling**
   - If one sync fails, should the other still run?
   - Recommendation: Yes, use `Promise.allSettled()` and report all errors

## Files Likely Involved

- Overview tab component (sync button handler)
- Messages/Texts tab component (add new sync button)
- Existing sync service functions (reuse for both)

## Notes

This improves UX by providing:
- A "sync all" option for users who want everything updated
- Granular control for users who only want to sync specific communication types
