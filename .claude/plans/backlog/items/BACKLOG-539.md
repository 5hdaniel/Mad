# BACKLOG-539: Scan Lookback Period setting not persistent

**Type:** Bug
**Priority:** P2 (functional bug - settings don't persist)
**Status:** Pending
**Sprint:** SPRINT-062 (deferred)
**Created:** 2026-01-27
**Related:** BACKLOG-540, BACKLOG-541 (Settings bundle)

---

## Problem Statement

The "Scan Lookback Period - How far back to search emails and messages" setting in the Settings modal does not persist after changes.

**Steps to Reproduce:**
1. Open Settings modal
2. Change the Scan Lookback Period value
3. Click "Done" to close the modal
4. Reopen Settings modal
5. **Observed:** The value has reverted to the previous/default value
6. **Expected:** The changed value should be saved and displayed

## Root Cause Analysis

**Investigation Needed:**
- Check if `lookbackPeriod` state is being saved to user preferences
- Verify the settings save handler includes this field
- Check if the value is read from preferences on modal open

**Likely Areas:**
- `src/components/Settings/` - Settings modal component
- User preferences storage mechanism

## Acceptance Criteria

- [ ] Scan Lookback Period changes persist after closing Settings modal
- [ ] Value survives app restart
- [ ] Value is correctly applied to email/message scanning

## Technical Notes

This bug is part of a Settings bundle:
- BACKLOG-539: Lookback Period not persistent (this)
- BACKLOG-540: Add Save button to Settings modal
- BACKLOG-541: Default lookback period should be 3 months

**Recommendation:** Fix all three together as they affect the same component.

## Effort Estimate

~15K tokens (debugging + fix + test)

---

## Discovery Context

Found during SPRINT-062 testing after main license flow was working. Deferred as P2 to avoid scope creep - license functionality takes priority.
