# TASK-2152: Show iPhone Sync Button on macOS When Import Source Is iPhone Sync

**Backlog:** BACKLOG-928 (renumbered from BACKLOG-924 to fix duplicate ID)
**Sprint:** SPRINT-125
**Type:** Bug Fix
**Priority:** High
**Status:** Testing
**Estimated Tokens:** ~15K
**Branch:** `fix/backlog-924-iphone-sync-macos`
**PR Target:** `develop`

---

## Problem

When a macOS user sets their Import Source to "iPhone Sync" in Settings, no sync button appears on the Dashboard. The user has explicitly opted into iPhone-based sync, but the UI provides no way to trigger it.

## Root Cause

`AppRouter.tsx` line 133 gates the sync button with:

```ts
const showIPhoneSyncButton = isWindows && selectedPhoneType === "iphone";
```

This condition only considers Windows users. macOS users who choose "iPhone Sync" as their import source (via `ImportSourceSettings.tsx`) are excluded because the `isWindows` check fails and the `importSource` preference is not consulted.

## Fix Requirements

### 1. Surface `importSource` preference in `useAppStateMachine.ts`

Read the `importSource` user preference (already persisted by `settingsService.ts` with type `ImportSource = "macos-native" | "iphone-sync"`) and expose it through the state machine return value so `AppRouter.tsx` can use it.

### 2. Update `AppRouter.tsx` line 133 condition

Change from:
```ts
const showIPhoneSyncButton = isWindows && selectedPhoneType === "iphone";
```

To:
```ts
const showIPhoneSyncButton =
  (isWindows && selectedPhoneType === "iphone") ||
  (isMacOS && importSource === "iphone-sync");
```

This shows the sync button when:
- Windows user selected iPhone phone type (existing behavior), OR
- macOS user selected "iPhone Sync" as import source (new behavior)

### 3. Update `Dashboard.tsx` comment on `onSyncPhone` prop

Update the JSDoc comment from `// Only available for Windows + iPhone users` to reflect the new condition (also macOS + iphone-sync users).

### 4. Optionally update `platform.ts` platformFeatures

Consider adding an `iPhoneSyncFromBackup` feature entry that includes `["macos", "windows", "linux"]` to `platformFeatures`, since iPhone sync is now available on macOS too. This is optional -- only if it improves clarity.

## Files to Modify

| File | Change |
|------|--------|
| `src/appCore/state/useAppStateMachine.ts` | Expose `importSource` preference |
| `src/appCore/AppRouter.tsx` | Update `showIPhoneSyncButton` condition |
| `src/components/Dashboard.tsx` | Update `onSyncPhone` prop comment |
| `src/utils/platform.ts` | (Optional) Add iPhoneSyncFromBackup feature |

## Acceptance Criteria

- [ ] macOS users with Import Source set to "iPhone Sync" see the sync button on Dashboard
- [ ] Windows + iPhone users still see the sync button (existing behavior unchanged)
- [ ] macOS users with Import Source set to "macOS Native" do NOT see the iPhone sync button
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] All existing tests pass (`npm test`)
- [ ] No lint errors (`npm run lint`)

## Testing Notes

- The `importSource` preference is set via Settings > Import Source radio buttons
- `settingsService.ts` defines the type: `ImportSource = "macos-native" | "iphone-sync"`
- Verify the sync button appears/disappears when toggling import source in Settings

---

## Agent Tracking

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | Pending |

## Actual Effort

_To be filled after completion._

## Implementation Summary

### Changes Made

1. **`src/appCore/state/types.ts`** -- Added `importSource: ImportSource` to the `AppStateMachine` interface, allowing the import source preference to flow through the state machine.

2. **`src/appCore/state/useAppStateMachine.ts`** -- Added a `useState`/`useEffect` pair that loads the `importSource` preference from `window.api.preferences.get()` for macOS users when `currentUser.id` is available. Passes `importSource` through to `constructStateProps`.

3. **`src/appCore/state/returnHelpers.ts`** -- Updated `constructStateProps` to accept and return the `importSource` parameter as part of the state machine output.

4. **`src/appCore/AppRouter.tsx`** -- Updated the `showIPhoneSyncButton` condition from `isWindows && selectedPhoneType === "iphone"` to also include `(isMacOS && importSource === "iphone-sync")`. Destructured `isMacOS` and `importSource` from the app state.

5. **`src/components/Dashboard.tsx`** -- Updated comments on `onSyncPhone` prop and the Sync iPhone Card to reflect the expanded platform support.

6. **`src/utils/platform.ts`** -- Updated comment on `iPhoneUSBSync` to note macOS availability when iphone-sync import source is selected. Did NOT add "macos" to the static platform list since this is a dynamic preference-based feature.

### Deviations

- The optional `platform.ts` change (adding macOS to `iPhoneUSBSync` platforms array) was not done because `platformFeatures` is a static feature map, and adding macOS there would break existing tests and misrepresent the feature as always available on macOS. The dynamic behavior is correctly handled by the `AppRouter.tsx` condition.

### Quality Gates

- [x] TypeScript compiles without errors
- [x] All relevant tests pass (159/159)
- [x] Lint passes
- [x] Pre-existing test failures in `transaction-handlers.integration.test.ts` are unrelated

### Issues/Blockers

None
