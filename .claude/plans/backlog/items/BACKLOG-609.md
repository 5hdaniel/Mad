# BACKLOG-609: Add manual Check for Updates button

## Summary
Add a "Check for Updates" button in settings so users can manually trigger update checks instead of only checking on app launch.

## Current Behavior
- Auto-updater only checks for updates on app launch (`autoUpdater.checkForUpdatesAndNotify()`)
- Users have no way to manually check for updates
- If they leave the app open for days, they won't know about new versions

## Proposed Solution

### 1. Add IPC handler in main process
```typescript
ipcMain.handle('check-for-updates', async () => {
  const result = await autoUpdater.checkForUpdates();
  return { checking: true, currentVersion: app.getVersion() };
});
```

### 2. Expose in preload bridge
Add `checkForUpdates()` to `updateBridge`:
```typescript
checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
```

### 3. Add button in Settings
Add a "Check for Updates" button in the Settings/About section that:
- Shows current version
- Triggers manual check
- Shows "Checking..." state while checking
- Shows "You're up to date!" or triggers the existing UpdateNotification flow

## Files to Modify
- `electron/main.ts` - Add IPC handler
- `electron/preload/outlookBridge.ts` - Add to updateBridge
- `src/window.d.ts` - Update types
- `src/components/settings/` or `src/pages/Settings.tsx` - Add UI button

## Estimation
~5K tokens - Straightforward addition to existing auto-update infrastructure

## Priority
Low - Nice to have, not critical since auto-check on launch works

## Related
- Auto-update system already implemented
- `UpdateNotification.tsx` handles the UI for available updates
