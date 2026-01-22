# BACKLOG-155: Dashboard Unnecessary Vertical Scroll

## Summary

The dashboard page allows vertical scrolling even when the content height is smaller than the viewport height. This creates a poor UX with unnecessary scroll bounce/movement.

## Expected Behavior

When dashboard content fits within the viewport, there should be no vertical scrollbar and no ability to scroll up/down.

## Actual Behavior

Users can scroll up and down on the dashboard even when all content is visible without scrolling.

## Potential Causes

1. **Container height issues** - Parent container may have `overflow-y: auto` or `scroll` when it should be `hidden` or `auto` with proper height constraints
2. **Flex/grid layout gaps** - Flexbox or grid containers might be creating extra space
3. **Body/html overflow** - Global styles may be forcing scroll behavior
4. **Electron-specific** - Chromium in Electron may handle overflow differently
5. **Content pushing beyond viewport** - Hidden elements or margins creating extra height

## Investigation Steps

1. Check dashboard container CSS for overflow properties
2. Inspect computed height of dashboard vs viewport
3. Look for hidden elements adding to document height
4. Check AppShell/layout wrapper overflow settings
5. Test with DevTools to identify which element is causing scroll

## Files to Investigate

- `src/components/Dashboard/` - Dashboard components
- `src/components/AppShell.tsx` - Main layout wrapper
- `src/App.tsx` - Root component styles
- `src/index.css` or global styles - Body/html overflow rules

## Priority

Low - Cosmetic issue, doesn't block functionality

## Status

- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tested across screen sizes
