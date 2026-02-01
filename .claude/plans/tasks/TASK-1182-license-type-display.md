# Task TASK-1182: Display License Type on Account Screen

**Backlog Item:** BACKLOG-465
**Sprint:** SPRINT-054
**Status:** Ready
**Estimated Tokens:** ~5K
**Priority:** P2

---

## Objective

Display the user's license type (Individual, Team, Enterprise) and AI add-on status on the account/subscription section of the UI.

---

## Context

The license schema (BACKLOG-426) and LicenseContext (TASK-1162) are already implemented. Users can see "Subscription" in the UI but can't see their actual license type. This task adds that display.

---

## Requirements

1. Find where subscription/account info is displayed
2. Add license type display using LicenseContext
3. Show AI add-on badge if enabled

---

## Implementation Steps

### Step 1: Locate the Account/Subscription UI

Check these locations:
- `src/components/Settings.tsx` - About section shows version info
- User dropdown/menu component
- Dashboard header

### Step 2: Add License Type Display

```tsx
import { useLicense } from '@/contexts/LicenseContext';

const { licenseType, hasAIAddon } = useLicense();

// Display format examples:
// "Individual License"
// "Team License"
// "Team License + AI Detection"
```

### Step 3: Style Appropriately

Match existing UI patterns for labels/badges.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Profile.tsx` | Add license type display in Subscription section |

---

## Acceptance Criteria

- [x] License type displayed (Individual/Team/Enterprise)
- [x] AI add-on shown if enabled
- [x] Matches existing UI styling
- [x] Works with LicenseContext

---

## Testing

1. Test with `license_type = 'individual'`
2. Test with `license_type = 'team'`
3. Test with AI add-on enabled/disabled

---

## Implementation Summary

### Changes Made

1. **Profile.tsx** - Added license type display in the Subscription section:
   - Imported `useLicense` hook from `@/contexts/LicenseContext`
   - Added `formatLicenseType()` helper function to format license type for display
   - Added a new row within the Subscription info box showing:
     - "License" label on the left
     - License type (Individual/Team/Enterprise) on the right
     - Purple "+ AI" badge if `hasAIAddon` is true
   - Shows "Loading..." while license data is being fetched
   - Styled to match existing UI patterns with consistent colors and spacing

### Display Format

The license type is displayed within the existing Subscription section, separated by a divider line:
- **Individual license**: Shows "Individual"
- **Team license**: Shows "Team"
- **Enterprise license**: Shows "Enterprise"
- **With AI add-on**: Shows "+ AI" badge in purple

### Technical Notes

- Uses the existing `LicenseContext` and `useLicense()` hook (TASK-1162)
- Handles loading state gracefully
- No new dependencies added
- Type-check and lint pass (pre-existing unrelated lint error)
- LicenseGate tests pass (22/22)

---

## Engineer Metrics

| Metric | Value |
|--------|-------|
| Start Time | 2026-01-24 |
| End Time | 2026-01-24 |
| Total Tokens | ~4K (estimated) |
| Turns | ~10 |
| Branch | feature/TASK-1182-license-type-display |
| PR | TBD |
