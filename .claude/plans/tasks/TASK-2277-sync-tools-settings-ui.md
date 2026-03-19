# Task TASK-2277: Sync Tools Settings UI (Install/Repair Button + Status)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add a "Sync Tools" section to the Settings page (Windows only) that displays Apple Mobile Device Support driver status (installed/not installed/error), provides an "Install Sync Tools" button for one-click installation, shows installation progress, and reports failures with detailed reasons. This addresses Support Ticket #25 where the user had no way to discover or fix missing drivers.

## Non-Goals

- Do NOT modify the driver installation logic in `appleDriverService.ts` (instrumented in TASK-2272)
- Do NOT redesign the Settings page layout (only add a new section)
- Do NOT add macOS-specific sync tool management (macOS uses libimobiledevice bundled with the app)
- Do NOT add new npm dependencies

## Deliverables

1. New file: `src/components/settings/SyncToolsSettings.tsx` -- New Settings section component
2. Update: `src/components/Settings.tsx` -- Import and render SyncToolsSettings (Windows only)
3. New test: `src/components/settings/__tests__/SyncToolsSettings.test.tsx`

## File Boundaries

### Files to modify (owned by this task):

- `src/components/settings/SyncToolsSettings.tsx` (NEW)
- `src/components/Settings.tsx`
- `src/components/settings/__tests__/SyncToolsSettings.test.tsx` (NEW)

### Files this task must NOT modify:

- `electron/services/appleDriverService.ts` -- Owned by TASK-2272
- `electron/services/deviceDetectionService.ts` -- Owned by TASK-2271
- Other Settings sub-components -- Not in scope

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## SR Engineer Note: Correct API References

**Use the EXISTING IPC bridge — all channels already exist:**
- `window.api.drivers.checkApple()` — maps to `drivers:check-apple` handler
- `window.api.drivers.installApple()` — maps to `drivers:install-apple` handler
- `window.api.drivers.hasBundled()` — maps to `drivers:has-bundled` handler

**DO NOT reference** `window.api?.system?.checkAppleDrivers?.()` — that does NOT exist.
**DO NOT reference** `window.api.drivers.openITunesStore()` — verify it exists before using.

Also: Reuse the existing `AppleDriverStatus` interface from `appleDriverService.ts` rather than creating a duplicate type.

## Acceptance Criteria

- [ ] New `SyncToolsSettings` component rendered in Settings page (Windows platform only)
- [ ] Component shows driver status: "Installed (v{version})", "Not Installed", or "Error: {message}"
- [ ] Shows service status: "Running" or "Stopped" with appropriate color coding
- [ ] "Install Sync Tools" button visible when drivers are not installed
- [ ] "Repair Installation" button visible when drivers installed but service stopped
- [ ] Installation progress shown (downloading/extracting/complete phases)
- [ ] Installation errors shown with user-friendly messages (using patterns from TASK-2276)
- [ ] Component does NOT render on macOS/Linux (platform check)
- [ ] Settings tab list includes "Sync" tab on Windows
- [ ] Unit tests for component rendering states
- [ ] Follows existing Settings section patterns (matches GeneralSettings, SecuritySettings layout)
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```tsx
// src/components/settings/SyncToolsSettings.tsx

import React, { useState, useEffect, useCallback } from "react";
import logger from "../../utils/logger";

interface DriverStatusInfo {
  isInstalled: boolean;
  version: string | null;
  serviceRunning: boolean;
  error: string | null;
}

interface InstallProgress {
  phase: "idle" | "downloading" | "extracting" | "installing" | "complete" | "error";
  percent: number;
  error?: string;
}

export function SyncToolsSettings() {
  const [driverStatus, setDriverStatus] = useState<DriverStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installProgress, setInstallProgress] = useState<InstallProgress>({ phase: "idle", percent: 0 });

  // Check driver status on mount
  useEffect(() => {
    async function checkDrivers() {
      try {
        // Call IPC to check driver status
        const status = await window.api?.system?.checkAppleDrivers?.();
        setDriverStatus(status ?? null);
      } catch (err) {
        logger.error("[SyncTools] Failed to check drivers:", err);
        setDriverStatus({ isInstalled: false, version: null, serviceRunning: false, error: "Failed to check driver status" });
      } finally {
        setLoading(false);
      }
    }
    checkDrivers();
  }, []);

  const handleInstall = useCallback(async () => {
    setInstallProgress({ phase: "downloading", percent: 0 });
    try {
      const result = await window.api?.system?.installAppleDrivers?.((progress: { phase: string; percent: number }) => {
        setInstallProgress({ phase: progress.phase as InstallProgress["phase"], percent: progress.percent });
      });

      if (result?.success) {
        setInstallProgress({ phase: "complete", percent: 100 });
        // Refresh status
        const status = await window.api?.system?.checkAppleDrivers?.();
        setDriverStatus(status ?? null);
      } else {
        setInstallProgress({
          phase: "error",
          percent: 0,
          error: result?.error ?? "Installation failed. Please try installing iTunes from the Microsoft Store.",
        });
      }
    } catch (err) {
      setInstallProgress({
        phase: "error",
        percent: 0,
        error: err instanceof Error ? err.message : "Installation failed",
      });
    }
  }, []);

  return (
    <div id="settings-sync" className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Sync Tools</h3>
      <p className="text-sm text-gray-600">
        iPhone sync requires Apple Mobile Device Support to communicate with your device.
      </p>

      {/* Driver Status */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Apple Mobile Device Support</span>
          {loading ? (
            <span className="text-sm text-gray-500">Checking...</span>
          ) : driverStatus?.isInstalled ? (
            <span className="text-sm text-green-600">
              Installed {driverStatus.version ? `(v${driverStatus.version})` : ""}
            </span>
          ) : (
            <span className="text-sm text-red-600">Not Installed</span>
          )}
        </div>

        {driverStatus?.isInstalled && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Service Status</span>
            <span className={`text-sm ${driverStatus.serviceRunning ? "text-green-600" : "text-amber-600"}`}>
              {driverStatus.serviceRunning ? "Running" : "Stopped"}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {!driverStatus?.isInstalled && installProgress.phase === "idle" && (
          <button
            onClick={handleInstall}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            Install Sync Tools
          </button>
        )}

        {driverStatus?.isInstalled && !driverStatus.serviceRunning && (
          <button
            onClick={handleInstall}
            className="w-full px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700"
          >
            Repair Installation
          </button>
        )}

        {/* Progress bar */}
        {installProgress.phase !== "idle" && installProgress.phase !== "error" && installProgress.phase !== "complete" && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500 capitalize">{installProgress.phase}... {installProgress.percent}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${installProgress.percent}%` }} />
            </div>
          </div>
        )}

        {/* Error display */}
        {installProgress.phase === "error" && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {installProgress.error}
          </div>
        )}

        {/* Success display */}
        {installProgress.phase === "complete" && (
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
            Sync tools installed successfully. You can now sync your iPhone.
          </div>
        )}
      </div>
    </div>
  );
}
```

### Update Settings.tsx:

```tsx
// Add to imports:
import { SyncToolsSettings } from "./settings/SyncToolsSettings";

// Add tab (conditionally for Windows):
// In SETTINGS_TABS array, add before "settings-about":
// Platform detection via user agent or a window.api call

// In the render, after other settings sections and before About:
{isWindows && (
  <SyncToolsSettings />
)}
```

### IPC Bridge Considerations

The component needs IPC calls to:
1. `window.api.system.checkAppleDrivers()` -- May already exist; check handlers
2. `window.api.system.installAppleDrivers(onProgress)` -- May need a new IPC channel

**If IPC channels don't exist:** Create minimal IPC handler registration. Check `electron/handlers/` for existing device/system handlers.

### Important Details

- Platform detection: Use `window.api?.system?.getPlatform?.()` or check `navigator.platform` -- do NOT hardcode
- Follow the existing Settings section pattern (see `GeneralSettings.tsx`, `SecuritySettings.tsx`)
- The tab should be "Sync" in the tab bar, rendering `SyncToolsSettings`
- All text colors must be explicit (per memory: always set text-gray-900, bg-white on inputs)
- Driver install requires admin privileges (UAC prompt) -- the button should indicate this

## Integration Notes

- Depends on: TASK-2272 (Apple driver diagnostics types and `getDriverDiagnostics()`)
- Imports from: IPC bridge (existing or new channels)
- The component is self-contained in the Settings hierarchy

## Do / Don't

### Do:

- Follow existing Settings section layout patterns exactly
- Add platform check -- only render on Windows
- Show loading state while checking driver status
- Provide clear installation failure messages
- Set explicit text colors on all elements

### Don't:

- Don't show this section on macOS/Linux
- Don't block the Settings page while checking status
- Don't attempt to install without user clicking the button
- Don't modify other Settings sections

## When to Stop and Ask

- If the IPC bridge for checkAppleDrivers doesn't exist and needs new handler registration
- If Settings.tsx structure has changed significantly
- If the platform detection approach is unclear
- If TASK-2272 hasn't been merged yet (need driver diagnostics types)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Component renders "Not Installed" when drivers missing
  - Component renders "Installed (v{version})" when drivers present
  - Component renders "Stopped" service status in amber
  - Install button appears when not installed
  - Repair button appears when installed but service stopped
  - Component does NOT render on non-Windows platform (mock platform detection)
  - Progress bar appears during installation

### Coverage

- Coverage impact: New component should have >70% coverage

### CI Requirements

- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(settings): add Sync Tools section for Apple driver management`
- **Labels**: `ui`, `settings`, `windows`, `diagnostics`
- **Base branch**: `int/observability-i`
- **Depends on**: TASK-2272 (driver diagnostics)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (component, test) | +10K |
| Files to modify | 1 file (Settings.tsx) | +3K |
| Code volume | ~150 lines component + ~100 lines test | +7K |
| Test complexity | Medium (React Testing Library, state mocking) | +5K |
| IPC bridge work | May need new handler -- adds uncertainty | +3K |

**Confidence:** Medium

**Risk factors:**
- IPC bridge may need new channels if checkAppleDrivers isn't exposed to renderer
- Platform detection approach needs verification
- Settings.tsx integration point needs to match current layout

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-03-19*

### Agent ID

```
Engineer Agent ID: agent-a38f8322
```

### What was done

1. **Created `src/components/settings/SyncToolsSettings.tsx`** -- New Settings section component that:
   - Uses the existing IPC bridge (`window.api.drivers.checkApple()`, `window.api.drivers.installApple()`)
   - Shows driver status: "Installed (v{version})", "Not Installed", "Error: {message}"
   - Shows service status: "Running" (green) or "Stopped" (amber) when drivers installed
   - "Install Sync Tools" button when not installed
   - "Repair Installation" button when installed but service stopped
   - Installation progress with spinner and progress bar
   - Success/error display with user-friendly messages
   - Follows existing Settings section patterns (bg-gray-50 cards, explicit text colors, border-gray-200)

2. **Updated `src/components/Settings.tsx`** -- Added "Sync" tab conditionally for Windows only using `window.api.system.platform === "win32"`. Renders SyncToolsSettings between SecuritySettings and DataPrivacySettings.

3. **Created `src/components/settings/__tests__/SyncToolsSettings.test.tsx`** -- 19 unit tests covering:
   - Loading state, not installed, installed with version, installed without version
   - Service status running/stopped with correct color classes
   - Error status display
   - Install/Repair button visibility logic
   - Installation progress indicator
   - Success/error messages after install
   - IPC call verification
   - Service status row hidden when not installed

### Deviations

- Task spec referenced `window.api?.system?.checkAppleDrivers?.()` which does NOT exist. Used the correct `window.api.drivers.checkApple()` as noted in SR Engineer guidance.
- Used simpler `phase` state (idle/downloading/installing/complete/error) instead of percent-based progress since `drivers:install-apple` is a single IPC invoke with no streaming progress callback.
- Did not add a separate platform-check "does not render" test since the platform gate is in Settings.tsx (parent), not in SyncToolsSettings itself.

### Issues/Blockers

None

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | Auto-captured |

**Variance:** PM Est ~25K vs Actual -- auto-captured

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** int/observability-i

- [ ] PR merge verified: shows `MERGED`
