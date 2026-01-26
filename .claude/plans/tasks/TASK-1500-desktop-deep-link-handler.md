# Task TASK-1500: Desktop Deep Link Handler

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-482
**Status**: Ready
**Execution**: Sequential (Phase 1, Step 1)

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow`
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1500-deep-link-handler`

---

## Goal

Implement `magicaudit://` URL scheme handling so the desktop app can receive authentication callbacks from the browser via deep links.

## Non-Goals

- Do NOT implement the browser auth landing page (TASK-1501)
- Do NOT implement license validation (TASK-1504)
- Do NOT modify login UI to use browser auth yet
- Do NOT handle token storage in Supabase session

---

## Estimated Tokens

**Est. Tokens**: ~25K (infrastructure)
**Token Cap**: ~100K (4x estimate)

---

## Deliverables

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `electron/main.ts` | Modify | Add `open-url` and `second-instance` handlers |
| `package.json` | Modify | Register `magicaudit://` URL scheme in build.mac and build.win |
| `build/entitlements.mac.plist` | No change needed | Custom URL schemes work without additional entitlements |
| `electron/preload.ts` | Modify | Expose `auth:callback` listener to renderer |
| `src/hooks/useDeepLinkAuth.ts` | Create | React hook to listen for auth callbacks |

---

## Implementation Notes

### Step 1: Register URL Scheme (macOS + Windows)

**IMPORTANT:** This project uses `package.json` for electron-builder config, NOT a separate `electron-builder.yml` file.

In `package.json`, add protocol registration under the `build` key:

```json
{
  "build": {
    "mac": {
      // ... existing config
      "protocols": [
        {
          "name": "Magic Audit",
          "schemes": ["magicaudit"]
        }
      ]
    },
    "win": {
      // ... existing config
      "protocols": [
        {
          "name": "Magic Audit",
          "schemes": ["magicaudit"]
        }
      ]
    }
  }
}
```

Also add runtime protocol registration in `electron/main.ts` (for development mode where packaged config isn't applied):

```typescript
// Register protocol handler at runtime (development + fallback)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('magicaudit', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('magicaudit');
}
```

### Step 2: Add macOS Entitlements (IF NEEDED)

The current `build/entitlements.mac.plist` has basic entitlements. Associated domains are ONLY needed if implementing Universal Links (HTTPS -> app). For custom URL schemes (`magicaudit://`), no additional entitlements are required.

**Only add if Universal Links are desired later:**

```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:app.magicaudit.com</string>
</array>
```

**Note:** For this sprint, the custom `magicaudit://` scheme works without this entitlement. Universal Links would be a future enhancement.

### Step 3: Handle Deep Link in Main Process

In `electron/main.ts`:

```typescript
// Handle deep links on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Handle deep links on Windows (via second instance)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Windows: deep link URL is in command line args
    const url = commandLine.find(arg => arg.startsWith('magicaudit://'));
    if (url) {
      handleAuthCallback(url);
    }

    // Focus main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function handleAuthCallback(url: string): void {
  try {
    const parsed = new URL(url);
    // Expected: magicaudit://callback?access_token=...&refresh_token=...

    if (parsed.pathname === '//callback' || parsed.host === 'callback') {
      const accessToken = parsed.searchParams.get('access_token');
      const refreshToken = parsed.searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        // Send to renderer
        mainWindow?.webContents.send('auth:callback', {
          accessToken,
          refreshToken
        });

        // Focus window
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      } else {
        console.error('Deep link missing tokens:', url);
        mainWindow?.webContents.send('auth:callback-error', {
          error: 'Missing tokens in callback URL'
        });
      }
    }
  } catch (error) {
    console.error('Failed to parse deep link URL:', error);
    mainWindow?.webContents.send('auth:callback-error', {
      error: 'Invalid callback URL'
    });
  }
}

// Handle deep link when app is cold started
app.on('ready', () => {
  // On macOS, if app was launched via URL, process.argv won't have it
  // It will come through 'open-url' event

  // On Windows, check command line args
  const url = process.argv.find(arg => arg.startsWith('magicaudit://'));
  if (url) {
    // Defer until window is ready
    app.once('browser-window-created', () => {
      setTimeout(() => handleAuthCallback(url), 100);
    });
  }
});
```

### Step 4: Expose to Renderer via Preload

In `electron/preload.ts`:

```typescript
// Add to contextBridge.exposeInMainWorld
contextBridge.exposeInMainWorld('electron', {
  // ... existing API

  // Auth callback listener
  onAuthCallback: (callback: (data: { accessToken: string; refreshToken: string }) => void) => {
    ipcRenderer.on('auth:callback', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('auth:callback');
  },

  onAuthCallbackError: (callback: (data: { error: string }) => void) => {
    ipcRenderer.on('auth:callback-error', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('auth:callback-error');
  }
});
```

### Step 5: React Hook for Renderer

Create `src/hooks/useDeepLinkAuth.ts`:

```typescript
import { useEffect, useCallback } from 'react';

interface AuthCallbackData {
  accessToken: string;
  refreshToken: string;
}

interface AuthCallbackError {
  error: string;
}

export function useDeepLinkAuth(
  onSuccess: (data: AuthCallbackData) => void,
  onError?: (error: AuthCallbackError) => void
): void {
  const handleSuccess = useCallback(onSuccess, [onSuccess]);
  const handleError = useCallback(onError || (() => {}), [onError]);

  useEffect(() => {
    const unsubscribeSuccess = window.electron?.onAuthCallback?.(handleSuccess);
    const unsubscribeError = window.electron?.onAuthCallbackError?.(handleError);

    return () => {
      unsubscribeSuccess?.();
      unsubscribeError?.();
    };
  }, [handleSuccess, handleError]);
}
```

### Step 6: Update TypeScript Types

In `src/types/electron.d.ts` or similar:

```typescript
interface ElectronAPI {
  // ... existing types
  onAuthCallback: (callback: (data: { accessToken: string; refreshToken: string }) => void) => () => void;
  onAuthCallbackError: (callback: (data: { error: string }) => void) => () => void;
}
```

---

## Testing Requirements

### Manual Testing

1. **macOS Deep Link Test (App Running)**:
   ```bash
   open "magicaudit://callback?access_token=test123&refresh_token=test456"
   ```
   Expected: App receives tokens, logs show callback handled

2. **macOS Deep Link Test (App Not Running)**:
   - Quit the app completely
   - Run: `open "magicaudit://callback?access_token=test123&refresh_token=test456"`
   - Expected: App launches AND receives tokens

3. **Windows Deep Link Test** (if Windows available):
   - Similar tests using `start magicaudit://callback?...`

4. **Error Handling Test**:
   ```bash
   open "magicaudit://callback"  # Missing tokens
   ```
   Expected: Error event sent to renderer

### Automated Tests

Create `electron/main.test.ts` (or add to existing):

```typescript
describe('handleAuthCallback', () => {
  it('parses valid callback URL', () => {
    // Test URL parsing
  });

  it('handles missing tokens gracefully', () => {
    // Test error case
  });

  it('handles invalid URL gracefully', () => {
    // Test malformed URL
  });
});
```

---

## Acceptance Criteria

- [ ] `magicaudit://` URL scheme registered in electron-builder config
- [ ] macOS `open-url` handler implemented and working
- [ ] Windows `second-instance` handler implemented
- [ ] Callback sends tokens to renderer via IPC
- [ ] App opens when `magicaudit://callback?access_token=test&refresh_token=test` is triggered
- [ ] Works when app is already running
- [ ] Works when app is NOT running (cold start)
- [ ] Error cases handled gracefully (missing tokens, invalid URL)
- [ ] TypeScript types updated for new IPC channels
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Integration Notes

- **Next Task**: TASK-1501 (Browser Auth Landing Page) will create the web page that redirects to this deep link
- **Later**: TASK-1507 will use the `useDeepLinkAuth` hook to handle tokens and validate license

---

## Do / Don't

### Do:
- Register URL scheme for both macOS and Windows
- Handle both "app running" and "cold start" scenarios
- Send errors to renderer (don't silently fail)
- Use defensive parsing for URL parameters
- Focus the main window after receiving callback

### Don't:
- Don't implement token storage or session management (that's TASK-1507)
- Don't modify the login UI (that's a separate task)
- Don't add license validation here
- Don't assume the callback URL format will never change (be flexible)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Windows deep link testing reveals platform-specific issues
- Electron single instance lock conflicts with existing code
- Preload script has existing patterns that conflict with this approach
- URL scheme name `magicaudit` conflicts with anything else

---

## PR Preparation

**Title**: `feat: implement desktop deep link handler for browser auth`

**Labels**: `sprint-062`, `auth`, `electron`

**PR Body Template**:
```markdown
## Summary
- Register `magicaudit://` URL scheme in electron-builder
- Handle deep links on macOS via `open-url` event
- Handle deep links on Windows via `second-instance` event
- Expose auth callback to renderer via IPC
- Add React hook for consuming auth callbacks

## Test Plan
- [ ] macOS: `open "magicaudit://callback?access_token=test&refresh_token=test"`
- [ ] macOS cold start: quit app, then trigger deep link
- [ ] Error case: `open "magicaudit://callback"` (missing tokens)
- [ ] CI passes

## Dependencies
None - this is the first task in Phase 1
```

---

## Implementation Summary

*To be completed by Engineer after implementation*

### Files Changed
- [ ] List actual files modified

### Approach Taken
- [ ] Describe implementation decisions

### Testing Done
- [ ] List manual tests performed
- [ ] Note any edge cases discovered

### Notes for SR Review
- [ ] Any concerns or areas needing extra review
