# BACKLOG-610: Update notification must be visible on ALL screens (including pre-login)

**Category:** bug
**Priority:** critical
**Status:** pending
**Created:** 2026-02-02

## Problem

When the app checks for updates (5 seconds after window load), the notification appears in the bottom-right corner. However, the notification can be obscured or not shown on certain screens:

1. **Login screen** - User hasn't authenticated yet
2. **T&C screen** - Modal may overlay the notification
3. **Onboarding screens** - May not have notification component mounted

This is critical because:
- Users stuck on ANY screen due to bugs cannot see that a fix is available
- If login or T&C has a bug, users are completely blocked from updating
- The notification appears briefly and may disappear or never render
- This blocks users from updating to fixed versions

## Observed Behavior

1. User opens app v2.0.2
2. Login or T&C screen is displayed (blocking due to bug)
3. 5 seconds later, update notification for v2.0.3 should appear
4. Notification is either hidden behind modal OR not rendered at all
5. User cannot see or click the update notification

## Expected Behavior

User should be able to see and interact with the update notification on **ANY** screen:
- Login screen (pre-auth)
- T&C acceptance screen
- Onboarding steps (phone type, permissions, etc.)
- Dashboard
- Settings
- Any modal or overlay

## Proposed Solutions

### Option 1: Global Update Banner (Recommended)
- Create a top-level `<UpdateNotification />` component in App.tsx
- Renders ABOVE all other content (highest z-index)
- Always mounted, regardless of auth state or current screen
- Shows banner when update is available with "Update Now" button
- Persists until user dismisses or updates

### Option 2: Electron Native Notification
- Use OS-level notification instead of in-app UI
- Always visible regardless of app state
- Less control over appearance/behavior
- May be ignored by users who dismiss system notifications

### Option 3: Blocking Update Modal
- When critical update available, show modal that blocks app usage
- Forces user to update before continuing
- Good for security fixes, but aggressive UX

### Option 4: Combination Approach
- Global banner for normal updates (Option 1)
- Blocking modal for critical/security updates (Option 3)
- Best of both worlds

## Implementation Notes

Current update check location: `electron/main.ts:627-630`
```typescript
setTimeout(() => {
  autoUpdater.checkForUpdatesAndNotify();
}, UPDATE_CHECK_DELAY); // 5 seconds
```

The notification is sent to renderer via:
- `update-available` event
- `update-downloaded` event

## Acceptance Criteria

- [ ] Update notification is visible when T&C modal is showing
- [ ] User can interact with update notification
- [ ] Update flow works correctly from T&C screen
- [ ] No regression in normal update flow (when T&C not showing)

## Related

- v2.0.2 → v2.0.3 update (T&C crash fix)
- BACKLOG-609: Manual "Check for Updates" button
