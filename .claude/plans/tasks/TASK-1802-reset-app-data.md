# Task TASK-1802: Reset App Data Self-Healing Feature

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See TASK-1800 for full workflow description.

---

## Goal

Add a "Reset App Data" feature to the ErrorScreen that allows users to clear corrupted local state (Application Support folder, keychain) and restart the app fresh, providing self-service recovery without contacting support.

## Non-Goals

- Do NOT clear Supabase data (only local data)
- Do NOT implement partial reset (all-or-nothing)
- Do NOT automatically reset without explicit user confirmation
- Do NOT bypass the confirmation dialog for any reason
- Do NOT reset without logging the action to error_logs

## Deliverables

1. New file: `electron/services/resetService.ts` - Service to clear local data
2. New file: `electron/handlers/resetHandlers.ts` - IPC handlers for reset
3. Update: `src/appCore/state/machine/components/ErrorScreen.tsx` - Add reset button and dialog
4. Update: `electron/handlers/index.ts` - Register reset handlers
5. Update: `electron/preload.ts` - Expose reset API

## Acceptance Criteria

- [ ] ErrorScreen shows "Reset App Data" button (red/destructive style)
- [ ] Clicking button shows confirmation dialog listing what will be deleted
- [ ] Confirmation requires typing "RESET" to proceed (prevent accidental clicks)
- [ ] Reset clears: SQLite database, keychain tokens, app preferences
- [ ] Reset action is logged to error_logs before clearing
- [ ] App automatically quits and relaunches after reset
- [ ] On relaunch, app shows onboarding as if fresh install
- [ ] All CI checks pass

## Implementation Notes

### What Gets Reset

| Data | Location | How to Clear |
|------|----------|--------------|
| SQLite database | `~/Library/Application Support/Magic Audit/` | Delete directory |
| Keychain tokens | macOS Keychain | `keytar.deletePassword()` for each service |
| App preferences | electron-store | `store.clear()` |
| Cached credentials | Various | Covered by App Support deletion |

### ResetService Pattern

```typescript
// electron/services/resetService.ts
import { app, dialog } from 'electron';
import { rm } from 'fs/promises';
import path from 'path';
import keytar from 'keytar';
import Store from 'electron-store';
import { ErrorLoggingService } from './errorLoggingService';

const KEYCHAIN_SERVICES = [
  'magic-audit-microsoft',
  'magic-audit-google',
  'magic-audit-encryption-key',
];

export class ResetService {
  private static instance: ResetService;

  static getInstance(): ResetService {
    if (!ResetService.instance) {
      ResetService.instance = new ResetService();
    }
    return ResetService.instance;
  }

  async performReset(): Promise<{ success: boolean; error?: string }> {
    try {
      // Log the reset action BEFORE clearing (so we have a record)
      await this.logResetAction();

      // 1. Clear keychain entries
      await this.clearKeychain();

      // 2. Clear electron-store
      this.clearElectronStore();

      // 3. Clear Application Support directory
      await this.clearAppData();

      // 4. Relaunch app
      this.relaunchApp();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during reset',
      };
    }
  }

  private async logResetAction(): Promise<void> {
    try {
      const errorLogging = ErrorLoggingService.getInstance();
      await errorLogging.submitError({
        errorType: 'user_reset',
        errorMessage: 'User initiated app data reset',
        currentScreen: 'ErrorScreen',
      });
    } catch {
      // Don't block reset if logging fails
    }
  }

  private async clearKeychain(): Promise<void> {
    for (const service of KEYCHAIN_SERVICES) {
      try {
        // Get all accounts for this service and delete them
        const credentials = await keytar.findCredentials(service);
        for (const cred of credentials) {
          await keytar.deletePassword(service, cred.account);
        }
      } catch {
        // Ignore errors for individual keychain entries
      }
    }
  }

  private clearElectronStore(): void {
    const store = new Store();
    store.clear();
  }

  private async clearAppData(): Promise<void> {
    const userDataPath = app.getPath('userData');
    // Remove the entire userData directory
    await rm(userDataPath, { recursive: true, force: true });
  }

  private relaunchApp(): void {
    app.relaunch();
    app.exit(0);
  }
}
```

### IPC Handlers

```typescript
// electron/handlers/resetHandlers.ts
import { ipcMain } from 'electron';
import { ResetService } from '../services/resetService';

export function registerResetHandlers(): void {
  ipcMain.handle('app:reset', async () => {
    const service = ResetService.getInstance();
    return service.performReset();
  });
}
```

### Preload API

```typescript
// Add to electron/preload.ts
app: {
  // ... existing app methods
  reset: () => ipcRenderer.invoke('app:reset'),
},
```

### ErrorScreen Reset Dialog

```tsx
// Add to ErrorScreen.tsx
import { useState } from 'react';

// Inside ErrorScreen component:
const [showResetDialog, setShowResetDialog] = useState(false);
const [resetConfirmation, setResetConfirmation] = useState('');
const [isResetting, setIsResetting] = useState(false);

const handleReset = async () => {
  if (resetConfirmation !== 'RESET') return;

  setIsResetting(true);
  try {
    await window.api.app.reset();
    // App will quit and relaunch, so this won't execute
  } catch (e) {
    setIsResetting(false);
    // Show error - but this is unlikely since reset is destructive
  }
};

// In the JSX:
<button
  onClick={() => setShowResetDialog(true)}
  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
  type="button"
>
  Reset App Data
</button>

{showResetDialog && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h2 className="text-xl font-bold text-red-600 mb-4">Reset App Data</h2>
      <p className="text-gray-600 mb-4">
        This will permanently delete all local data:
      </p>
      <ul className="list-disc list-inside text-gray-600 mb-4">
        <li>All imported transactions</li>
        <li>All imported messages and emails</li>
        <li>Email account connections</li>
        <li>App preferences and settings</li>
      </ul>
      <p className="text-gray-600 mb-4">
        Your Supabase account and cloud data will NOT be affected.
      </p>
      <p className="text-gray-800 font-medium mb-2">
        Type RESET to confirm:
      </p>
      <input
        type="text"
        value={resetConfirmation}
        onChange={(e) => setResetConfirmation(e.target.value.toUpperCase())}
        className="w-full border rounded px-3 py-2 mb-4"
        placeholder="RESET"
        disabled={isResetting}
      />
      <div className="flex justify-end space-x-2">
        <button
          onClick={() => {
            setShowResetDialog(false);
            setResetConfirmation('');
          }}
          className="px-4 py-2 border rounded"
          disabled={isResetting}
        >
          Cancel
        </button>
        <button
          onClick={handleReset}
          disabled={resetConfirmation !== 'RESET' || isResetting}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          {isResetting ? 'Resetting...' : 'Confirm Reset'}
        </button>
      </div>
    </div>
  </div>
)}
```

## Integration Notes

- Imports from: `electron/services/errorLoggingService.ts` (for logging reset)
- Exports to: `electron/handlers/index.ts`, `electron/preload.ts`
- Used by: ErrorScreen component
- Depends on: TASK-1800 (uses error logging service)

## Do / Don't

### Do:
- Log the reset action to Supabase BEFORE clearing data
- Require explicit confirmation (type RESET)
- List exactly what will be deleted
- Clarify that cloud data is preserved
- Make the button visually distinct (red/destructive)
- Handle errors gracefully during reset

### Don't:
- Allow reset without confirmation dialog
- Clear Supabase data
- Leave partial state (all-or-nothing)
- Skip the error logging step
- Make this easily triggerable by accident

## When to Stop and Ask

- If keychain service names are different from documented
- If electron-store pattern differs
- If userData path handling is unclear
- If relaunch behavior is problematic

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `resetService.test.ts`: Test each clearing method (mocked)
  - Test confirmation dialog requires "RESET"
  - Test button disabled until confirmation matches

### Coverage

- Coverage impact: Must not decrease
- ResetService should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Reset dialog flow (open, type RESET, confirm)
  - Cancel dialog resets confirmation text
  - Button disabled without proper confirmation

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks
- [x] Build step

## PR Preparation

- **Title**: `feat(error-screen): add Reset App Data self-healing feature (BACKLOG-616/617)`
- **Labels**: `critical`, `feature`, `onboarding`
- **Base Branch**: `main`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +8K |
| Files to modify | 3 files | +6K |
| Code volume | ~250 lines | +4K |
| Test complexity | Medium | +4K |

**Confidence:** Medium

**Risk factors:**
- Keychain clearing cross-platform behavior
- App relaunch timing

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/services/resetService.ts
- [ ] electron/handlers/resetHandlers.ts

Files updated:
- [ ] src/appCore/state/machine/components/ErrorScreen.tsx
- [ ] electron/handlers/index.ts
- [ ] electron/preload.ts

Features implemented:
- [ ] Reset confirmation dialog
- [ ] Keychain clearing
- [ ] electron-store clearing
- [ ] App data directory removal
- [ ] App relaunch

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
