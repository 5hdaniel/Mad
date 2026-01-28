# BACKLOG-541: Scan Lookback Period default should be 3 months

**Type:** Enhancement
**Priority:** P3 (default value tweak)
**Status:** Pending
**Sprint:** SPRINT-062 (deferred)
**Created:** 2026-01-27
**Related:** BACKLOG-539, BACKLOG-540 (Settings bundle)

---

## Problem Statement

The Scan Lookback Period setting currently defaults to an undesirable value (possibly 1 month or unlimited). The sensible default should be 3 months for the following reasons:

1. **3 months covers most active transactions** - Real estate transactions typically close within 30-90 days
2. **Not too much historical data** - Unlimited would scan years of emails, causing performance issues
3. **Not too little** - 1 month might miss ongoing transactions
4. **User expectation alignment** - 3 months is a common default for email scanning tools

## Proposed Solution

Change the default value for `scanLookbackPeriod` to 3 months (90 days or equivalent value).

**Implementation:**
1. Find where the default is set (likely in settings initialization or schema)
2. Change default from current value to 3 months
3. For existing users: consider whether to migrate or leave their current setting

## Acceptance Criteria

- [ ] New installations default to 3 months lookback period
- [ ] Settings UI shows "3 months" as the selected default
- [ ] Existing users retain their current setting (no forced migration)

## Technical Notes

This enhancement is part of a Settings bundle:
- BACKLOG-539: Lookback Period not persistent
- BACKLOG-540: Add Save button to Settings modal
- BACKLOG-541: Default lookback period should be 3 months (this)

**Recommendation:** Implement alongside BACKLOG-539 fix since the persistence fix may involve touching the default value anyway.

**Migration consideration:** If existing users have a bad default (e.g., unlimited), consider a one-time migration to 3 months only if they've never explicitly changed the setting.

## Effort Estimate

~5K tokens (simple default value change)

---

## Discovery Context

Found during SPRINT-062 testing. This is a minor UX improvement - the current default is not ideal but does not break functionality. Deferred as P3.
