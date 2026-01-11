# BACKLOG-188: Scan Lookback Period Setting Not Persisting

**Created**: 2026-01-10
**Priority**: Medium
**Category**: bug
**Status**: Pending

---

## Description

The "Scan Lookback Period" setting in Settings doesn't persist when changed. User reported changing from 9 months to 3 months and the value didn't save.

## Current Behavior

- User changes lookback period from 9 months to 3 months
- Setting appears to change in UI
- After some action (unclear if immediate or after restart), value resets to 9 months

## Expected Behavior

- Lookback period should persist after changing
- Value should survive app restart
- Value should be stored in Supabase user_preferences

## Technical Notes

### Code Flow

1. `Settings.tsx` calls `handleScanLookbackChange(months)`
2. Handler calls `window.api.preferences.update(userId, { scan: { lookbackMonths: months } })`
3. `preference-handlers.ts` deep-merges with existing preferences
4. `supabaseService.syncPreferences()` upserts to Supabase

### Possible Causes

1. **Silent failure** - Update might be failing but error is caught silently (`console.debug`)
2. **Load issue** - Preferences might not be loading correctly on mount
3. **Deep merge issue** - The `scan` object might not be merging correctly
4. **Supabase sync** - Data might not be reaching Supabase

### Investigation Steps

1. Check DevTools Console for errors when changing setting
2. Check if value persists on same page (without navigation)
3. Check if value persists after page navigation
4. Check if value persists after app restart
5. Check Supabase database directly for stored value

## Acceptance Criteria

- [ ] Lookback period persists after changing
- [ ] Value survives app restart
- [ ] Value can be verified in Supabase

## Estimated Tokens

~10,000 (bug investigation + fix)

---

## Notes

Reported during SPRINT-029 session. Settings use Supabase for persistence.
