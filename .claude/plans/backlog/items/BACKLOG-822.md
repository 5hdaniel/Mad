# BACKLOG-822: Add Notification Permission Step to Joyride Tour

**Type:** Feature
**Area:** UI
**Priority:** Medium
**Status:** Pending

## Problem

When Keepr first launches, macOS shows a notification permission prompt ("Keepr" Notifications — Notifications may include alerts, sounds, and icon badges). Users often dismiss or ignore this. Without notifications enabled, they miss important alerts like sync completion.

## Proposed Change

Add a step to the dashboard joyride tour (in `tourSteps.ts`) that:

1. **Triggers a test notification** via Electron's `Notification` API — this causes macOS to show the system notification permission banner
2. **Displays a tour tooltip** guiding the user through the 4-step process:
   - Step 1: The notification banner appears at top-right of screen
   - Step 2: Hover over the banner to reveal the "Options" button
   - Step 3: Click "Options" to open the dropdown (Allow / Don't Allow)
   - Step 4: Select "Allow"

### Tour Step Placement

Insert after the sync-status step (which already mentions "Enable notifications in Settings to be alerted when syncing finishes") — this is the natural place to actually enable them.

### Implementation Notes

- Use `new Notification('Keepr', { body: 'Notifications help you stay updated on sync progress and audit alerts.' })` via IPC to trigger the macOS permission prompt
- The tour tooltip should explain: "You should see a notification at the top of your screen. Hover over it, click Options, and select Allow to enable notifications."
- If notifications are already enabled, skip this step (check via `Notification.permission` or Electron's `systemPreferences`)
- Consider adding a "Test Notification" button in the tooltip as fallback if the auto-trigger timing doesn't align

## Reference Screenshots

Located in `docs/` folder:
- `1.Notifications.png` — Initial notification banner
- `2.onHover.png` — Hover reveals "Options" button
- `3.dropDownOpen.png` — Dropdown open with Allow/Don't Allow
- `4.Allow selected .png` — "Allow" highlighted

## Files to Modify

- `src/config/tourSteps.ts` — Add notification permission step to `getDashboardTourSteps()`
- `electron/handlers/` — Add IPC handler to trigger a test notification if one doesn't exist
- Possibly `src/components/` — Tour callback to fire the notification at the right step
