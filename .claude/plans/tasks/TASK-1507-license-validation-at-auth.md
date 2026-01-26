# Task TASK-1507: Add License Validation at Auth

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-484
**Status**: Blocked (Waiting for TASK-1506)
**Execution**: Sequential (Phase 3, Step 2)

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1506 merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1507-license-at-auth`

---

## Goal

Integrate license validation immediately after successful authentication via deep link callback. This ensures users are validated and devices registered as part of the auth flow, not as a separate step.

## Non-Goals

- Do NOT modify the license service (TASK-1504)
- Do NOT modify the license UI components (TASK-1506)
- Do NOT implement payment/subscription flow
- Do NOT change existing auth UI beyond adding browser launch

---

## Estimated Tokens

**Est. Tokens**: ~15K (service)
**Token Cap**: ~60K (4x estimate)

---

## Deliverables

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `electron/main.ts` | Modify | Handle auth callback with license validation |
| `src/appCore/state/flows/useAuthFlow.ts` | Modify | Handle deep link auth tokens |
| `src/components/auth/LoginScreen.tsx` | Modify | Add "Login in Browser" button |
| `electron/preload.ts` | Modify | Add method to open browser for auth |

---

## Implementation Notes

### Step 1: Update Auth Callback Handler in Main Process

Update `electron/main.ts` to validate license after receiving auth tokens:

```typescript
import { validateLicense, createUserLicense } from './services/licenseService';
import { registerDevice } from './services/deviceService';
import { supabaseAdmin } from './services/supabaseAdmin';

/**
 * Handle auth callback from deep link
 */
async function handleAuthCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);

    if (parsed.host === 'callback' || parsed.pathname === '//callback') {
      const accessToken = parsed.searchParams.get('access_token');
      const refreshToken = parsed.searchParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        sendToRenderer('auth:error', { error: 'Missing tokens in callback' });
        return;
      }

      // Step 1: Verify tokens and get user
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

      if (authError || !user) {
        sendToRenderer('auth:error', { error: 'Invalid authentication token' });
        return;
      }

      // Step 2: Validate license
      let licenseStatus = await validateLicense(user.id);

      // Step 3: Create license if needed
      if (licenseStatus.blockReason === 'no_license') {
        licenseStatus = await createUserLicense(user.id);
      }

      // Step 4: Check if license is valid
      if (!licenseStatus.isValid) {
        sendToRenderer('auth:license-blocked', {
          accessToken,
          refreshToken,
          userId: user.id,
          blockReason: licenseStatus.blockReason,
          licenseStatus,
        });
        return;
      }

      // Step 5: Register device
      const deviceResult = await registerDevice(user.id);

      if (!deviceResult.success && deviceResult.error === 'device_limit_reached') {
        sendToRenderer('auth:device-limit', {
          accessToken,
          refreshToken,
          userId: user.id,
          licenseStatus,
        });
        return;
      }

      // Step 6: Success - send all data to renderer
      sendToRenderer('auth:success', {
        accessToken,
        refreshToken,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0],
        },
        licenseStatus,
        device: deviceResult.device,
      });

      // Focus window
      focusMainWindow();
    }
  } catch (error) {
    console.error('Auth callback error:', error);
    sendToRenderer('auth:error', { error: 'Authentication failed. Please try again.' });
  }
}

function sendToRenderer(channel: string, data: any): void {
  mainWindow?.webContents.send(channel, data);
}

function focusMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}
```

### Step 2: Update Preload to Expose Auth Methods

**IMPORTANT:** The preload script uses bridge modules organized in `electron/preload/`. DO NOT add methods directly to `electron/preload.ts`. Instead, update the appropriate bridge modules.

Current structure:
- `electron/preload.ts` - imports and exposes bridges via `contextBridge`
- `electron/preload/authBridge.ts` - auth-related IPC methods
- `electron/preload/eventBridge.ts` - event listeners from main process

Add new methods to the appropriate bridge files:

In `electron/preload/authBridge.ts`:

```typescript
import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Existing methods...

  // Auth methods
  auth: {
    // Open browser for authentication
    openAuthInBrowser: () => {
      // Get the auth URL (production or local)
      const authUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/auth/desktop'
        : 'https://app.magicaudit.com/auth/desktop';
      shell.openExternal(authUrl);
    },

    // Listen for auth success
    onAuthSuccess: (callback: (data: AuthSuccessData) => void) => {
      const handler = (_event: any, data: AuthSuccessData) => callback(data);
      ipcRenderer.on('auth:success', handler);
      return () => ipcRenderer.removeListener('auth:success', handler);
    },

    // Listen for auth error
    onAuthError: (callback: (data: { error: string }) => void) => {
      const handler = (_event: any, data: { error: string }) => callback(data);
      ipcRenderer.on('auth:error', handler);
      return () => ipcRenderer.removeListener('auth:error', handler);
    },

    // Listen for license blocked
    onLicenseBlocked: (callback: (data: LicenseBlockedData) => void) => {
      const handler = (_event: any, data: LicenseBlockedData) => callback(data);
      ipcRenderer.on('auth:license-blocked', handler);
      return () => ipcRenderer.removeListener('auth:license-blocked', handler);
    },

    // Listen for device limit
    onDeviceLimit: (callback: (data: DeviceLimitData) => void) => {
      const handler = (_event: any, data: DeviceLimitData) => callback(data);
      ipcRenderer.on('auth:device-limit', handler);
      return () => ipcRenderer.removeListener('auth:device-limit', handler);
    },
  },
});

// Types for auth data
interface AuthSuccessData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  licenseStatus: LicenseStatus;
  device?: DeviceRegistration;
}

interface LicenseBlockedData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  blockReason: string;
  licenseStatus: LicenseStatus;
}

interface DeviceLimitData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  licenseStatus: LicenseStatus;
}
```

### Step 3: Update useAuthFlow Hook

Update `src/appCore/state/flows/useAuthFlow.ts`:

```typescript
import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLicense } from '../../contexts/LicenseContext';

interface AuthFlowState {
  status: 'idle' | 'waiting' | 'success' | 'error' | 'license_blocked' | 'device_limit';
  error?: string;
}

export function useAuthFlow() {
  const [state, setState] = useState<AuthFlowState>({ status: 'idle' });
  const { setSession, setUser } = useAuth();
  const { refresh: refreshLicense } = useLicense();

  // Handle auth success
  const handleAuthSuccess = useCallback(async (data: AuthSuccessData) => {
    try {
      // Set the Supabase session
      await window.api.supabase.setSession(data.accessToken, data.refreshToken);

      // Update auth context
      setSession({ access_token: data.accessToken, refresh_token: data.refreshToken });
      setUser(data.user);

      // Refresh license context
      await refreshLicense();

      setState({ status: 'success' });
    } catch (error) {
      console.error('Failed to complete auth:', error);
      setState({ status: 'error', error: 'Failed to complete authentication' });
    }
  }, [setSession, setUser, refreshLicense]);

  // Handle auth error
  const handleAuthError = useCallback((data: { error: string }) => {
    setState({ status: 'error', error: data.error });
  }, []);

  // Handle license blocked
  const handleLicenseBlocked = useCallback((data: LicenseBlockedData) => {
    // Still set the session so user can see the upgrade screen
    window.api.supabase.setSession(data.accessToken, data.refreshToken);
    setUser({ id: data.userId });
    setState({ status: 'license_blocked' });
  }, [setUser]);

  // Handle device limit
  const handleDeviceLimit = useCallback((data: DeviceLimitData) => {
    // Set session for device management
    window.api.supabase.setSession(data.accessToken, data.refreshToken);
    setUser({ id: data.userId });
    setState({ status: 'device_limit' });
  }, [setUser]);

  // Set up listeners
  useEffect(() => {
    const unsubSuccess = window.electron.auth.onAuthSuccess(handleAuthSuccess);
    const unsubError = window.electron.auth.onAuthError(handleAuthError);
    const unsubBlocked = window.electron.auth.onLicenseBlocked(handleLicenseBlocked);
    const unsubDevice = window.electron.auth.onDeviceLimit(handleDeviceLimit);

    return () => {
      unsubSuccess();
      unsubError();
      unsubBlocked();
      unsubDevice();
    };
  }, [handleAuthSuccess, handleAuthError, handleLicenseBlocked, handleDeviceLimit]);

  // Start auth flow
  const startAuth = useCallback(() => {
    setState({ status: 'waiting' });
    window.electron.auth.openAuthInBrowser();
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    startAuth,
    reset,
  };
}
```

### Step 4: Update Login Screen

Update `src/components/auth/LoginScreen.tsx`:

```typescript
import React from 'react';
import { useAuthFlow } from '../../appCore/state/flows/useAuthFlow';

export function LoginScreen() {
  const { state, startAuth, reset } = useAuthFlow();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Magic Audit</h1>
          <p className="text-gray-600 mt-2">Real estate transaction auditing made simple</p>
        </div>

        {/* Status-based content */}
        {state.status === 'idle' && (
          <>
            <button
              onClick={startAuth}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center"
            >
              <BrowserIcon className="w-5 h-5 mr-2" />
              Sign In with Browser
            </button>
            <p className="text-center text-sm text-gray-500 mt-4">
              Your browser will open for secure sign-in
            </p>
          </>
        )}

        {state.status === 'waiting' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Waiting for sign-in...</p>
            <p className="text-sm text-gray-500 mt-2">Complete sign-in in your browser</p>
            <button
              onClick={reset}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {state.status === 'error' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ErrorIcon className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-red-600 mb-4">{state.error}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}

        {state.status === 'success' && (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-gray-600">Signed in successfully!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
```

---

## Testing Requirements

### Manual Testing

1. **Full Flow - New User**:
   - Clear any existing session
   - Click "Sign In with Browser"
   - Complete OAuth in browser
   - Verify app receives callback
   - Verify license created
   - Verify device registered
   - Verify app shows main content

2. **Full Flow - Expired License**:
   - Set trial_expires_at to past in Supabase
   - Sign in
   - Verify upgrade screen shows (not main app)

3. **Full Flow - Device Limit**:
   - Register device for user
   - Try to sign in from different device
   - Verify device limit screen shows

4. **Error Handling**:
   - Cancel OAuth in browser
   - Verify app shows error state
   - Verify can retry

---

## Acceptance Criteria

- [ ] "Sign In with Browser" button opens browser
- [ ] Auth callback validates license before completing
- [ ] New users get trial license created
- [ ] Devices are registered at auth time
- [ ] Expired licenses show upgrade screen
- [ ] Device limits show management screen
- [ ] Error states handled gracefully
- [ ] Waiting state shows appropriate UI
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Integration Notes

- **Depends on**: TASK-1506 (license gate components must exist)
- **Next Task**: TASK-1508 (user manual test of full flow)
- **Note**: This ties together all previous work in the sprint

---

## Do / Don't

### Do:
- Validate license in main process before sending to renderer
- Handle all callback scenarios (success, blocked, device limit, error)
- Keep token handling secure (don't log tokens)
- Show clear feedback while waiting for browser

### Don't:
- Don't skip license validation
- Don't let invalid licenses through to main app
- Don't store tokens in renderer beyond memory
- Don't block forever if browser auth is cancelled

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Auth context interface differs from expected
- Supabase session management is different
- Login screen already has different auth flow
- Unclear how to integrate with existing state machine

---

## PR Preparation

**Title**: `feat: integrate license validation into auth callback flow`

**Labels**: `sprint-062`, `auth`, `licensing`

**PR Body Template**:
```markdown
## Summary
- Update auth callback in main.ts to validate license
- Add IPC channels for auth states (success, blocked, device limit)
- Update useAuthFlow hook to handle license states
- Update LoginScreen to use browser-based auth

## Test Plan
- [ ] New user: sign in -> license created -> app opens
- [ ] Expired user: sign in -> upgrade screen shown
- [ ] Device limit: sign in -> device management shown
- [ ] Error: cancel OAuth -> error shown -> can retry

## Dependencies
- TASK-1506 must be merged (license gate components)
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
