# TASK-987: macOS Messages Import Triggers

**Sprint**: SPRINT-026
**Backlog**: BACKLOG-172 (continuation)
**Estimated**: ~20K tokens
**Priority**: High

---

## Objective

Add three triggers for the macOS Messages import feature:

1. **Manual button** - "Import Messages" in Settings for manual backup
2. **Auto-import on startup** - Updates messages every time app launches (macOS only)
3. **Onboarding integration** - Import during onboarding after FDA permission granted

## Implementation Steps

### 1. Manual Button in Settings

Add an "Import Messages" button in the Settings page (macOS only):
- Show import progress/status
- Display last import time and count
- Only visible on macOS platform

Location: `src/components/settings/` or existing settings component

### 2. Auto-Import on App Startup

In the app initialization flow (macOS only):
- Check if platform is macOS
- Check if Full Disk Access is granted
- Run import in background (non-blocking)
- Use lower priority / batch size to not slow startup

Location: App initialization or useEffect in App.tsx / AppShell

### 3. Onboarding Integration

After Full Disk Access permission is granted during onboarding:
- Automatically trigger message import
- Show progress to user ("Importing your messages...")
- Seamless transition to next onboarding step

Location: Onboarding flow components

## Files to Modify

| File | Change |
|------|--------|
| `src/components/settings/*.tsx` | Add Import Messages button |
| `src/App.tsx` or `src/hooks/useAppInit.ts` | Add startup import trigger |
| Onboarding components | Add post-FDA import step |
| Platform detection | Gate all triggers to macOS only |

## Acceptance Criteria

- [ ] Settings has "Import Messages" button (macOS only)
- [ ] Messages auto-import on app startup (macOS + FDA permission)
- [ ] Messages import during onboarding after FDA granted
- [ ] All triggers show appropriate progress/feedback
- [ ] No duplicate imports (deduplication already in service)
- [ ] Non-blocking - doesn't freeze UI

## Quality Gates

- [x] Type-check passes
- [x] Tests pass
- [x] No new lint errors

---

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `src/components/settings/MacOSMessagesImportSettings.tsx` | Settings UI for manual import button (macOS only) |
| `src/hooks/useMacOSMessagesImport.ts` | Hook for auto-import on startup |

### Files Modified

| File | Changes |
|------|---------|
| `src/window.d.ts` | Added types for `importMacOSMessages`, `getImportCount`, `onImportProgress` |
| `electron/types/ipc.ts` | Added messages import types to WindowApi interface |
| `src/components/Settings.tsx` | Added MacOSMessagesImportSettings component import and UI section |
| `src/appCore/BackgroundServices.tsx` | Added useMacOSMessagesImport hook for startup auto-import |
| `src/components/onboarding/steps/PermissionsStep.tsx` | Added import trigger after FDA permission granted with progress UI |
| `src/components/__tests__/Settings.test.tsx` | Updated to wrap Settings in PlatformProvider |
| `tests/setup.js` | Added messages import mocks |

### Implementation Details

1. **Manual Button in Settings**
   - Created `MacOSMessagesImportSettings` component
   - Shows only on macOS (via `usePlatform` hook)
   - Displays import progress bar and result count
   - Button disabled during import

2. **Auto-Import on Startup**
   - Created `useMacOSMessagesImport` hook
   - Integrates with `BackgroundServices.tsx`
   - Runs 2s after app fully loaded
   - Gates on: macOS + hasPermissions + isDatabaseInitialized + !isOnboarding
   - Non-blocking background operation

3. **Onboarding Integration**
   - Updated `PermissionsStep.tsx`
   - After permissions detected, triggers import before `PERMISSION_GRANTED` action
   - Shows "Importing Your Messages" progress UI
   - Shows "Messages Imported!" result before continuing
   - Falls back gracefully on errors (continues to next step)

### Deviations

None - implemented as specified.

### Engineer Checklist

- [x] Branch created from develop
- [x] Implementation complete
- [x] Type-check passes
- [x] Tests pass
- [x] No new lint errors
- [x] Task file updated with Implementation Summary
