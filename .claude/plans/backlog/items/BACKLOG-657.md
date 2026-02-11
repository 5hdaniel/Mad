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

### T3: Pre-Import Warning Appears
- **Setup:** macOS with Messages DB containing >10K messages in last 3 months
- **Action:** Set filter to "Last 3 months" + "10,000" cap
- **Expected:** Amber warning appears showing actual count vs cap, with "Import all" button
- **Verify:** Warning appears WITHOUT clicking Import

### T4: Pre-Import Warning Disappears When Cap Not Exceeded
- **Setup:** Same as T3
- **Action:** Change cap to "Unlimited" or "500,000" (above actual count)
- **Expected:** Amber warning disappears

### T5: "Import All" Override (Pre-Import)
- **Setup:** Pre-import warning is showing
- **Action:** Click "Import all X messages"
- **Expected:** Import runs without cap, all messages imported, cap preference restored after

### T6: Post-Import Warning Shows
- **Setup:** Filters set to trigger cap (e.g., 3 months + 10K)
- **Action:** Click "Import Messages"
- **Expected:** After import, green success message includes amber sub-box showing excluded count

### T7: "Re-import All" Override (Post-Import)
- **Setup:** Post-import warning is showing
- **Action:** Click "Re-import all X messages"
- **Expected:** Force re-import runs without cap, cap restored after

### T8: Auto-Sync Cap Warning on Dashboard
- **Setup:** User with filter prefs (e.g., 6 months / 250K), Messages DB has >250K in 6 months
- **Action:** Login / app restart triggers auto-sync
- **Expected:** After sync completes, SyncStatusIndicator shows amber banner with warning text and "Adjust Limits" button
- **Verify:** Banner persists until dismissed (does not auto-dismiss with the green "Sync Complete")

### T9: "Adjust Limits" Opens Settings
- **Setup:** Dashboard showing cap warning banner
- **Action:** Click "Adjust Limits" button
- **Expected:** Settings modal opens (user can scroll to macOS Messages section)

### T10: No Warning When Cap Not Exceeded
- **Setup:** Filter set to "All time" + "Unlimited", or actual count < cap
- **Action:** Import messages (manual or auto-sync)
- **Expected:** No amber warnings anywhere, normal success/completion messages

### T11: Saved Preferences Override Defaults
- **Setup:** User previously set filters to "12 months" / "500,000" in Settings
- **Action:** App restart, auto-sync triggers
- **Expected:** Import uses 12/500K (not defaults), verify via handler logs

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
