# BACKLOG-569: Update Joyride Onboarding Tour

## Summary

Review and update the joyride onboarding tour to reflect recent UI changes.

## Background

Recent Sprint 66 UI changes have modified the transaction details layout:
- Edit Summary button now positioned next to Summary heading (not in header)
- Delete Transaction button moved to bottom center of Overview tab
- Emails/Messages tabs have new empty state design with centered buttons
- Other UX improvements throughout the contact management flow

The joyride onboarding tour needs to be updated to reflect these changes so new users see accurate UI guidance.

## Scope

1. **Transaction Details Tour**
   - Update step targeting Edit button (now "Edit Summary" next to Summary heading)
   - Update or remove step for Delete button (now at bottom of Overview tab)
   - Review all transaction detail steps for accuracy

2. **Empty States**
   - Consider adding tour steps for new empty state buttons
   - Update any references to old button placements

3. **General Review**
   - Walk through entire onboarding flow
   - Verify all target elements still exist
   - Update step text/descriptions as needed

## Acceptance Criteria

- [ ] All joyride steps target correct UI elements
- [ ] Step descriptions match current UI text
- [ ] Tour completes without errors on fresh account
- [ ] No orphaned steps (targeting non-existent elements)

## Technical Notes

Joyride configuration likely in:
- `src/components/onboarding/` or similar
- Look for `react-joyride` usage

## Priority

Medium - Not blocking but affects new user experience

## Category

UX
