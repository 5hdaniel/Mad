# BACKLOG-464: Dashboard "Reconnect" Button Does Nothing

## Summary

When email connection expires, a popup/notification appears on the Dashboard with a "Reconnect" button. That button does nothing when clicked.

**Note:** The "Connect" button in Settings page WORKS fine - this is only about the Dashboard popup button.

## Category

Bug / UX

## Priority

P1 - High (Confusing UX, but workaround exists via Settings)

## Description

### Problem

1. User's email connection expires
2. Dashboard shows a popup/notification about expired connection
3. Popup has a button to reconnect
4. **Button does nothing when clicked**
5. User has to manually go to Settings to reconnect

### Expected Behavior

The dashboard popup button should either:
1. **Option A:** Trigger OAuth popup directly (same as Settings), OR
2. **Option B:** Navigate to Settings and auto-scroll to Email Connection section

Option B is simpler to implement.

### How to Reproduce

1. Have an expired email connection
2. See the dashboard notification/popup about expired connection
3. Click the reconnect button
4. Observe: nothing happens

## Acceptance Criteria

- [ ] Dashboard popup button navigates to Settings OR triggers OAuth
- [ ] If navigating to Settings, auto-scroll to Email Connection section
- [ ] User can successfully reconnect from the popup flow

## Estimated Effort

~10K tokens (simple navigation fix)

## Related Items

- BACKLOG-458: Email connection status mismatch
- PR #568: Added more UI but button still doesn't work
