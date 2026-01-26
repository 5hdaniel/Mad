# Task TASK-1506: Add License Check at App Start

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-480
**Status**: Blocked (Waiting for TASK-1502, TASK-1505 User Gates)
**Execution**: Sequential (Phase 3, Step 1)

---

## ⚠️ MANDATORY WORKFLOW (6 Steps)

**DO NOT SKIP ANY STEP. Each agent step requires recording the Agent ID.**

```
Step 1: PLAN        → Plan Agent creates implementation plan
                      📋 Record: Plan Agent ID

Step 2: SR REVIEW   → SR Engineer reviews and approves plan
                      📋 Record: SR Engineer Agent ID

Step 3: USER REVIEW → User reviews and approves plan
                      ⏸️  GATE: Wait for user approval

Step 4: COMPACT     → Context reset before implementation
                      🔄 /compact or new session

Step 5: IMPLEMENT   → Engineer implements approved plan
                      📋 Record: Engineer Agent ID

Step 6: PM UPDATE   → PM updates sprint/backlog/metrics
```

**Reference:** `.claude/docs/ENGINEER-WORKFLOW.md`

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after Phase 2 complete)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1506-license-check-startup`

---

## Goal

Integrate license validation into the app startup flow to check license status when the app starts and block users with expired or invalid licenses.

## Non-Goals

- Do NOT implement auth callback integration (TASK-1507)
- Do NOT implement subscription payment flow
- Do NOT implement team license management
- Do NOT change existing auth providers

---

## Estimated Tokens

**Est. Tokens**: ~15K (service)
**Token Cap**: ~60K (4x estimate)

---

## Deliverables

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/App.tsx` | Modify | Add license gate after auth |
| `src/contexts/LicenseContext.tsx` | Modify | Update to use Supabase license service |
| `src/appCore/state/flows/useAuthFlow.ts` | Modify | Add license check after auth |
| `src/components/license/LicenseGate.tsx` | Create | Component to show license status |
| `src/components/license/TrialStatusBanner.tsx` | Create | Banner showing trial days remaining |
| `src/components/license/UpgradeScreen.tsx` | Create | Screen shown when license expired |
| `src/components/license/DeviceLimitScreen.tsx` | Create | Screen shown when device limit reached |

---

## Implementation Notes

### Step 1: Update LicenseContext

**IMPORTANT:** A `LicenseContext.tsx` already exists in `src/contexts/` with a different interface. This task UPDATES the existing context, not replaces it.

Current interface:
- `licenseType`, `hasAIAddon`, `organizationId` (computed from IPC)
- No `userId` prop, no `isValid` flag, no trial tracking

New interface needed:
- Add `userId` prop to `LicenseProvider`
- Add `isValid`, `blockReason`, `trialDaysRemaining` fields
- Add trial status tracking
- Keep backward-compatible computed flags (`canExport`, `canSubmit`, etc.)

Update `src/contexts/LicenseContext.tsx` to fetch from Supabase:

```typescript
/**
 * License Context
 * SPRINT-062: Updated to use Supabase license service
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LicenseStatus } from '../../shared/types/license';

interface LicenseContextValue {
  status: LicenseStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

export function LicenseProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateLicense = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call IPC to validate license
      const licenseStatus = await window.api.license.validate(userId);
      setStatus(licenseStatus);

      // If no license exists, create one
      if (licenseStatus.blockReason === 'no_license') {
        const newStatus = await window.api.license.create(userId);
        setStatus(newStatus);
      }
    } catch (err) {
      console.error('Failed to validate license:', err);
      setError('Failed to validate license');
      // Set a fallback status
      setStatus({
        isValid: false,
        licenseType: 'trial',
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: false,
        deviceCount: 0,
        deviceLimit: 1,
        aiEnabled: false,
        blockReason: 'no_license',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    validateLicense();
  }, [validateLicense]);

  return (
    <LicenseContext.Provider value={{ status, isLoading, error, refresh: validateLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within LicenseProvider');
  }
  return context;
}
```

### Step 2: Create License Gate Component

Create `src/components/license/LicenseGate.tsx`:

```typescript
/**
 * License Gate Component
 * Blocks access when license is invalid
 */

import React from 'react';
import { useLicense } from '../../contexts/LicenseContext';
import { UpgradeScreen } from './UpgradeScreen';
import { DeviceLimitScreen } from './DeviceLimitScreen';
import { LoadingScreen } from '../common/LoadingScreen';

interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { status, isLoading, error } = useLicense();

  // Show loading while checking license
  if (isLoading) {
    return <LoadingScreen message="Checking license..." />;
  }

  // Handle error
  if (error && !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">License Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if license is valid
  if (status && !status.isValid) {
    switch (status.blockReason) {
      case 'expired':
        return <UpgradeScreen reason="trial_expired" />;
      case 'limit_reached':
        return <UpgradeScreen reason="transaction_limit" />;
      default:
        return <UpgradeScreen reason="unknown" />;
    }
  }

  // License is valid, render children
  return <>{children}</>;
}
```

### Step 3: Create Upgrade Screen

Create `src/components/license/UpgradeScreen.tsx`:

```typescript
/**
 * Upgrade Screen
 * Shown when user's license is expired or at limit
 */

import React from 'react';

type UpgradeReason = 'trial_expired' | 'transaction_limit' | 'unknown';

interface UpgradeScreenProps {
  reason: UpgradeReason;
}

const MESSAGES: Record<UpgradeReason, { title: string; description: string }> = {
  trial_expired: {
    title: 'Your Trial Has Expired',
    description: 'Your 14-day free trial has ended. Upgrade to continue using Magic Audit.',
  },
  transaction_limit: {
    title: 'Transaction Limit Reached',
    description: 'You\'ve reached the maximum of 5 transactions on the free trial. Upgrade for unlimited transactions.',
  },
  unknown: {
    title: 'License Required',
    description: 'A valid license is required to use Magic Audit.',
  },
};

export function UpgradeScreen({ reason }: UpgradeScreenProps) {
  const message = MESSAGES[reason];

  const handleUpgrade = () => {
    // Open upgrade page in browser
    window.electron.openExternal('https://magicaudit.com/pricing');
  };

  const handleLogout = () => {
    // Trigger logout
    window.api.auth.logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {message.title}
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          {message.description}
        </p>

        {/* Features list */}
        <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
          <p className="font-medium text-gray-900 mb-2">With a paid plan you get:</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
              Unlimited transactions
            </li>
            <li className="flex items-center">
              <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
              Up to 2 devices
            </li>
            <li className="flex items-center">
              <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
              Export audit packages
            </li>
            <li className="flex items-center">
              <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
              Priority support
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Upgrade Now
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
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

### Step 4: Create Device Limit Screen

Create `src/components/license/DeviceLimitScreen.tsx`:

```typescript
/**
 * Device Limit Screen
 * Shown when user tries to register too many devices
 */

import React, { useState, useEffect } from 'react';
import type { DeviceRegistration } from '../../../shared/types/license';

export function DeviceLimitScreen() {
  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const userId = await window.api.auth.getUserId();
      const deviceList = await window.api.device.list(userId);
      setDevices(deviceList);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (deviceId: string) => {
    try {
      setDeactivating(deviceId);
      const userId = await window.api.auth.getUserId();
      await window.api.device.deactivate(userId, deviceId);
      await loadDevices();

      // Try to register current device again
      const result = await window.api.device.register(userId);
      if (result.success) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to deactivate device:', error);
    } finally {
      setDeactivating(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Device Limit Reached</h1>
          <p className="text-gray-600">
            You can only use Magic Audit on 1 device with your current plan.
            Deactivate another device to use this one.
          </p>
        </div>

        {/* Device List */}
        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : (
            devices
              .filter(d => d.is_active)
              .map(device => (
                <div
                  key={device.device_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {device.device_name || 'Unknown Device'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {device.platform === 'macos' ? 'macOS' : 'Windows'} - Last seen{' '}
                      {new Date(device.last_seen_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeactivate(device.device_id)}
                    disabled={deactivating === device.device_id}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {deactivating === device.device_id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))
          )}
        </div>

        {/* Upgrade option */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-gray-500 mb-3">
            Need more devices? Upgrade your plan.
          </p>
          <button
            onClick={() => window.electron.openExternal('https://magicaudit.com/pricing')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Create Trial Status Banner

Create `src/components/license/TrialStatusBanner.tsx`:

```typescript
/**
 * Trial Status Banner
 * Shows trial days remaining at top of app
 */

import React from 'react';
import { useLicense } from '../../contexts/LicenseContext';

export function TrialStatusBanner() {
  const { status } = useLicense();

  // Only show for trial users
  if (!status || status.licenseType !== 'trial' || !status.trialDaysRemaining) {
    return null;
  }

  const daysRemaining = status.trialDaysRemaining;
  const isUrgent = daysRemaining <= 3;

  return (
    <div
      className={`px-4 py-2 text-center text-sm ${
        isUrgent
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-blue-50 text-blue-800'
      }`}
    >
      <span>
        {daysRemaining === 1
          ? 'Your trial ends tomorrow!'
          : `${daysRemaining} days left in your free trial.`}
      </span>
      <button
        onClick={() => window.electron.openExternal('https://magicaudit.com/pricing')}
        className="ml-2 underline hover:no-underline"
      >
        Upgrade now
      </button>
    </div>
  );
}
```

### Step 6: Update App.tsx

**IMPORTANT:** Current `App.tsx` is only 43 lines and follows a clean compositional pattern. DO NOT break this pattern.

Current structure:
```typescript
function App() {
  const app = useAppStateMachine();
  return (
    <NotificationProvider>
      <LicenseProvider>
        <AppShell app={app}>
          <AppRouter app={app} />
          <BackgroundServices app={app} />
          <AppModals app={app} />
        </AppShell>
      </LicenseProvider>
    </NotificationProvider>
  );
}
```

The `LicenseProvider` is ALREADY in place. To add the license gate:

1. The `useAppStateMachine` hook provides user info via `app.state.user`
2. Pass `userId` to the updated `LicenseProvider`
3. Add `LicenseGate` inside `LicenseProvider` but outside `AppShell`
4. Add `TrialStatusBanner` inside `AppShell` (at the top)

Updated structure:

```typescript
function App() {
  const app = useAppStateMachine();

  return (
    <NotificationProvider>
      <LicenseProvider userId={app.state.user?.id || null}>
        <LicenseGate>
          <AppShell app={app}>
            <TrialStatusBanner />
            <AppRouter app={app} />
            <BackgroundServices app={app} />
            <AppModals app={app} />
          </AppShell>
        </LicenseGate>
      </LicenseProvider>
    </NotificationProvider>
  );
}
```

**Note:** This keeps App.tsx under 70 lines while adding the license gate functionality.

### Step 7: Update IPC Types

Ensure `window.api` types include license methods:

```typescript
// In src/types/electron.d.ts or similar
interface Window {
  api: {
    license: {
      validate: (userId: string) => Promise<LicenseStatus>;
      create: (userId: string) => Promise<LicenseStatus>;
      incrementTransactionCount: (userId: string) => Promise<number>;
    };
    device: {
      register: (userId: string) => Promise<DeviceRegistrationResult>;
      list: (userId: string) => Promise<DeviceRegistration[]>;
      deactivate: (userId: string, deviceId: string) => Promise<void>;
    };
    // ... other API methods
  };
}
```

---

## Testing Requirements

### Manual Testing

1. **Valid License Flow**:
   - Log in as user with valid trial
   - Verify app shows main content
   - Verify trial banner shows days remaining

2. **Expired Trial Flow**:
   - Modify trial_expires_at in Supabase to past date
   - Log in
   - Verify upgrade screen appears
   - Verify cannot access main app

3. **Transaction Limit Flow**:
   - Set transaction_count = 5 in Supabase
   - Log in
   - Verify cannot create new transaction
   - Verify appropriate message shown

4. **Device Limit Flow**:
   - Register device for user
   - Try to access from different device (or simulate)
   - Verify device limit screen appears

---

## Acceptance Criteria

- [ ] License validated on every app start (after auth)
- [ ] Expired trial blocks access with upgrade prompt
- [ ] Transaction limit warning shown when approaching limit
- [ ] Device limit shows device management screen
- [ ] New users get trial license created automatically
- [ ] Trial status banner shows for trial users
- [ ] Upgrade buttons link to pricing page
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Integration Notes

- **Depends on**: TASK-1502 (auth flow working), TASK-1505 (license service working)
- **Next Task**: TASK-1507 (integrate license check into auth callback)
- **Note**: LicenseProvider needs user ID from auth context

---

## Do / Don't

### Do:
- Show clear messaging for each block reason
- Provide upgrade path in all blocked states
- Show trial days remaining prominently
- Handle loading states gracefully
- Keep license context in sync with Supabase

### Don't:
- Don't crash if license check fails (show retry option)
- Don't block offline users immediately (grace period)
- Don't show upgrade prompts to paid users
- Don't store sensitive license data in localStorage

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Unclear how App.tsx is structured for adding license gate
- Auth context interface is different than expected
- Device management UI requirements are unclear
- Upgrade URL is different

---

## PR Preparation

**Title**: `feat: add license check at app startup`

**Labels**: `sprint-062`, `licensing`, `ui`

**PR Body Template**:
```markdown
## Summary
- Add LicenseGate component that blocks invalid licenses
- Update LicenseContext to use Supabase license service
- Create UpgradeScreen for expired/limited licenses
- Create DeviceLimitScreen for device management
- Add TrialStatusBanner for trial users

## Test Plan
- [ ] Valid trial user sees main app with trial banner
- [ ] Expired trial user sees upgrade screen
- [ ] Transaction limit shows appropriate message
- [ ] Device limit shows device management

## Dependencies
- TASK-1504 must be merged (license service)
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | ☐ Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | ☐ Pending |
| 3. User Review | (No agent) | N/A | N/A | ☐ Pending |
| 4. Compact | (Context reset) | N/A | N/A | ☐ Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | ☐ Pending |
| 6. PM Update | PM Agent | ___________ | ___K | ☐ Pending |

### Step 1: Plan Output

*Plan Agent writes implementation plan here after Step 1*

```
[Plan to be written here]
```

### Step 2: SR Review Notes

*SR Engineer writes review notes here after Step 2*

```
[SR Review notes to be written here]
```

### Step 3: User Review

- [ ] User reviewed plan
- [ ] User approved plan
- Date: _______________

---

## Implementation Summary

*To be completed by Engineer after Step 5*

### Files Changed
- [ ] List actual files modified

### Approach Taken
- [ ] Describe implementation decisions

### Testing Done
- [ ] List manual tests performed
- [ ] Note any edge cases discovered

### Notes for SR Review
- [ ] Any concerns or areas needing extra review

### Final Metrics

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Plan tokens | ~5K | ___K | ___% |
| SR Review tokens | ~5K | ___K | ___% |
| Implement tokens | ~15K | ___K | ___% |
| **Total** | ~25K | ___K | ___% |
