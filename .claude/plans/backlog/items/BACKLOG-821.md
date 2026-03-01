# BACKLOG-821: Remove Accessibility Permission — Use Direct System Settings URL

**Type:** Improvement
**Area:** Electron (macOS)
**Priority:** Low
**Status:** Pending

## Problem

During onboarding, the app requests **Accessibility permission** so it can use AppleScript to programmatically navigate System Settings (clicking menu items to reach Privacy & Security > Full Disk Access). This is confusing because:

1. The Accessibility permission doesn't actually help grant Full Disk Access — the user still has to manually toggle FDA
2. Users see an extra permission prompt that seems unrelated to the app's purpose
3. A 2.5.1 beta tester noted Keepr was auto-added to Accessibility settings, which was unexpected

## Current Behavior

1. App uses AppleScript (`tell application "System Events" > click menu item...`) to navigate System Settings
2. This triggers macOS Accessibility permission prompt
3. If granted, it clicks through menus to reach the FDA panel
4. If denied, it falls back to opening System Settings via URL scheme anyway

**Files involved:**
- `electron/handlers/permissionHandlers.ts` (lines ~208-244) — AppleScript automation
- `electron/services/macOSPermissionHelper.ts` — `runAppleScript()` helper

## Proposed Change

Remove the AppleScript UI automation entirely. Open System Settings directly via URL scheme:

```typescript
shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles");
```

This is already the fallback path — just make it the primary (and only) path.

## Benefits

- One fewer permission prompt during onboarding
- No confusing Accessibility entry in System Settings
- Simpler, more reliable code (no AppleScript parsing/execution)
- FDA is the only required permission — cleaner user experience

## Files to Modify

- `electron/handlers/permissionHandlers.ts` — Remove AppleScript automation, use URL scheme directly
- `electron/services/macOSPermissionHelper.ts` — Remove `runAppleScript()` if no longer used elsewhere
- `src/components/onboarding/steps/PermissionsStep.tsx` — Redesign onboarding UI: remove Accessibility references, replace the current 1-step-at-a-time wizard (with Next button) with a single screen showing all permission steps at once. Users go back and forth between System Settings and the app, so showing everything on one screen lets them keep the app side-by-side with Settings. Include a "Open System Settings" button and a checklist of what to do (e.g., find Keepr in FDA list, toggle it on), with auto-detection updating the checklist as permissions are granted.
- `src/components/onboarding/flows/macosFlow.ts` — Remove Accessibility from the onboarding flow if it's a separate step
