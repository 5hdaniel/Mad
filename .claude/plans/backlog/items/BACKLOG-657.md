# BACKLOG-657: Message Import Cap Warning & Default Filters

**Status:** In Progress
**Priority:** High
**Category:** feature
**Sprint:** -
**PR:** #801

---

## Summary

When message import filters (date range + count cap) result in more messages being available than the cap allows, the user should be warned **before** importing. This applies to both the Settings UI (manual import) and the auto-sync on login (SyncStatusIndicator on Dashboard).

Additionally, sensible defaults (6 months / 250K messages) must be applied server-side when no preferences have been saved yet, so that the first auto-sync on login doesn't import unlimited messages.

---

## Requirements

### R1: Default Filters (Server-Side)
- When no message import preferences exist in Supabase, the handler MUST default to:
  - `lookbackMonths: 6`
  - `maxMessages: 250000`
- The UI defaults MUST match (React state initializers)
- Rationale: First-time users should not accidentally import millions of messages

### R2: Pre-Import Cap Warning (Settings UI)
- When the user changes filter dropdowns, a count query runs against the macOS Messages DB
- If `availableCount > maxMessages`, an amber warning appears BEFORE the user clicks "Import":
  > "This time period contains **X** messages, which exceeds the **Y** limit. Only the most recent Y will be imported."
- An "Import all X messages" button allows a one-time override (temporarily removes cap, re-imports, then restores cap)

### R3: Post-Import Cap Warning (Settings UI)
- After import completes, if `wasCapped === true`, an amber box confirms:
  > "**Z** additional messages were available for this time period but excluded by the message limit."
- A "Re-import all X messages" button allows override (force re-import without cap)

### R4: Sync Cap Warning (Dashboard — SyncStatusIndicator)
- When auto-sync on login triggers message import and the cap is exceeded:
  - The `SyncOrchestratorService` captures `wasCapped` from the import result
  - Returns a warning string attached to the `SyncItem`
  - `SyncStatusIndicator` shows an amber banner after sync completes:
    > "X messages excluded by import limit. Adjust in Settings."
  - An **"Adjust Limits"** button opens the Settings modal

### R5: Import Result Metadata
- `MacOSImportResult` includes:
  - `totalAvailable?: number` — messages matching the date filter (before cap)
  - `wasCapped?: boolean` — true when maxMessages cap truncated results
- `getAvailableMessageCount()` returns the raw count (NOT capped) so the UI can compare

---

## Error Messages

### Settings UI — Pre-Import Warning
```
This time period contains {availableCount} messages, which exceeds the
{maxMessages} limit. Only the most recent {maxMessages} will be imported.

[Import all {availableCount} messages]
```

### Settings UI — Post-Import Warning
```
{excluded} additional messages were available for this time period but
excluded by the message limit.

[Re-import all {totalAvailable} messages]
```

### Dashboard — Sync Warning (SyncStatusIndicator)
```
⚠ {excluded} messages excluded by import limit. Adjust in Settings.

[Adjust Limits]
```

---

## Test Cases

### T1: Default Filters Applied Server-Side
- **Setup:** New user, no Supabase preferences saved
- **Action:** App starts, auto-sync triggers message import
- **Expected:** Import uses 6-month lookback and 250K cap (check handler logs)
- **Verify:** `importFilters` in log contains `{ lookbackMonths: 6, maxMessages: 250000 }`

### T2: Default Filters in Settings UI
- **Setup:** Open Settings > macOS Messages section
- **Action:** Observe initial dropdown values
- **Expected:** "Last 6 months" and "250,000" are pre-selected

### T3: Pre-Import Info Text Appears in Filter Section
- **Setup:** macOS with Messages DB containing >10K messages in last 3 months
- **Action:** Set filter to "Last 3 months" + "10,000" cap
- **Expected:** Amber text in filter section: "This time period contains X messages, which exceeds the Y limit."
- **Verify:** Text appears WITHOUT clicking Import, updates live as filters change

### T4: Pre-Import Info Disappears When Cap Not Exceeded
- **Setup:** Same as T3
- **Action:** Change cap to "Unlimited" or "500,000" (above actual count)
- **Expected:** Amber info text disappears

### T5: Import Blocked by Confirmation Prompt
- **Setup:** Cap exceeded (e.g., 3 months + 10K, DB has 681K)
- **Action:** Click "Import Messages"
- **Expected:** Import does NOT start. Instead, a 3-option prompt appears:
  1. "Import most recent 10,000 only" (blue)
  2. "Import all 681,375 messages" (amber)
  3. "Cancel" (gray)
- **Verify:** No progress bar appears until user picks an option

### T6: Force Re-import Also Blocked by Prompt
- **Setup:** Same as T5
- **Action:** Click "Force Re-import"
- **Expected:** Same 3-option prompt, but buttons say "Re-import most recent..." and "Re-import all..."
- **Verify:** Prompt correctly tracks that this is a force re-import

### T7: Prompt — Choose "Import Most Recent N Only"
- **Setup:** Prompt showing after clicking Import
- **Action:** Click "Import most recent 10,000 only"
- **Expected:** Import starts with cap applied, only 10K messages imported, prompt dismissed

### T8: Prompt — Choose "Import All X Messages"
- **Setup:** Prompt showing after clicking Import
- **Action:** Click "Import all 681,375 messages"
- **Expected:** Import starts without cap (override), all messages imported, cap preference restored after

### T9: Prompt — Choose "Cancel"
- **Setup:** Prompt showing after clicking Import
- **Action:** Click "Cancel"
- **Expected:** Prompt dismissed, no import started, buttons return to normal state

### T10: Force Re-import Override
- **Setup:** Prompt showing after clicking Force Re-import
- **Action:** Click "Re-import all X messages"
- **Expected:** Force re-import runs (deletes existing + imports all), cap restored after

### T11: Prompt Dismissed When Filters Change
- **Setup:** Prompt is showing
- **Action:** Change a filter dropdown (e.g., switch from 3 months to 6 months)
- **Expected:** Prompt disappears, stale result cleared

### T12: No Prompt When Cap Not Exceeded
- **Setup:** Filter set to "All time" + "Unlimited", or actual count < cap
- **Action:** Click "Import Messages" or "Force Re-import"
- **Expected:** Import starts immediately, no prompt shown

### T13: Auto-Sync Cap Warning on Dashboard
- **Setup:** User with filter prefs (e.g., 6 months / 250K), Messages DB has >250K in 6 months
- **Action:** Login / app restart triggers auto-sync
- **Expected:** After sync completes, SyncStatusIndicator shows amber banner:
  > "X messages excluded by import limit. Adjust in Settings."
- **Verify:** "Adjust Limits" button present, banner persists until dismissed

### T14: "Adjust Limits" Opens Settings
- **Setup:** Dashboard showing cap warning banner from auto-sync
- **Action:** Click "Adjust Limits" button
- **Expected:** Settings modal opens (user can scroll to macOS Messages section)

### T15: Auto-Sync No Warning When Cap Not Exceeded
- **Setup:** Filters set to "All time" + "Unlimited", or message count < cap
- **Action:** Login triggers auto-sync
- **Expected:** Normal green "Sync Complete" — no amber warning

### T16: Saved Preferences Override Defaults
- **Setup:** User previously set filters to "12 months" / "500,000" in Settings
- **Action:** App restart, auto-sync triggers
- **Expected:** Import uses 12/500K (not defaults), verify via handler logs

### T17: Stale Result Cleared on Filter Change
- **Setup:** Previous import completed (green success message showing)
- **Action:** Change either filter dropdown
- **Expected:** Green success message disappears (result is stale for new filters)

---

## Files Modified

| File | Change |
|------|--------|
| `electron/handlers/messageImportHandlers.ts` | Default filters (6mo/250K) when no prefs |
| `electron/services/macOSMessagesImportService.ts` | `wasCapped`, `totalAvailable` on result; raw count from `getAvailableMessageCount` |
| `electron/preload/messageBridge.ts` | `getImportCount` accepts filters param |
| `electron/types/ipc.ts` | Updated type signatures |
| `src/window.d.ts` | Updated type signatures |
| `src/components/settings/MacOSMessagesImportSettings.tsx` | Default state (6/250K), pre/post-import warnings, "Import All" buttons |
| `src/services/SyncOrchestratorService.ts` | `warning` on SyncItem, SyncFunction returns optional warning |
| `src/components/dashboard/SyncStatusIndicator.tsx` | Amber warning banner with "Adjust Limits" button |
| `src/components/Dashboard.tsx` | Thread `onOpenSettings` prop |
| `src/appCore/AppRouter.tsx` | Pass `openSettings` to Dashboard |
