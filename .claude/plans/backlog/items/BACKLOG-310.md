# BACKLOG-310: Remove Debug Console Logs from NotificationContext

## Type
DX / Cleanup

## Priority
Low

## Status
Pending

## Summary

Remove or guard the debug console logs in `NotificationContext.tsx` that spam the browser inspector with repeated messages.

## Current Behavior

Console shows repeated messages:
```
🔔 Notifications available in console: __notify.success('msg'), __notify.error('msg'), ...
🔔 Notifications available in console: __notify.success('msg'), __notify.error('msg'), ...
🔔 Notifications available in console: __notify.success('msg'), __notify.error('msg'), ...
🔔 Notifications available in console: __notify.success('msg'), __notify.error('msg'), ...
```

This appears on line 175 of `NotificationContext.tsx` and logs every time the context re-renders.

## Expected Behavior

Either:
1. Remove the debug log entirely
2. Guard with `if (__DEV__)` or similar
3. Log only once using a ref to track if already logged

## Affected Files

- `src/contexts/NotificationContext.tsx` (line ~175)

## Acceptance Criteria

- [ ] Console not spammed with notification helper messages
- [ ] (Optional) Debug helper still available in development if useful

## Estimated Effort

~3K tokens (simple cleanup)

## Discovered During

User testing - 2026-01-18
