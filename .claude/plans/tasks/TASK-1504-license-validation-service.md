# Task TASK-1504: Implement License Validation Service

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-478
**Status**: Blocked (Waiting for TASK-1503)
**Execution**: Sequential (Phase 2, Step 2)

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

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1503 merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1504-license-service`

---

## Goal

Create a service layer in the Electron app for validating user licenses against Supabase, including device registration and offline grace period support.

## Non-Goals

- Do NOT implement app startup integration (TASK-1506)
- Do NOT implement auth callback integration (TASK-1507)
- Do NOT create UI components
- Do NOT modify existing auth flows yet

---

## Estimated Tokens

**Est. Tokens**: ~30K (service)
**Token Cap**: ~120K (4x estimate)

---

## Deliverables

### Files to Create

| File | Action | Description |
|------|--------|-------------|
| `electron/services/licenseService.ts` | Create | License validation logic |
| `electron/services/deviceService.ts` | Create | Device registration logic |
| `electron/license-handlers.ts` | Modify | IPC handlers for license operations |
| `electron/services/__tests__/licenseService.test.ts` | Create | Unit tests |
| `electron/services/__tests__/deviceService.test.ts` | Create | Unit tests |

---

## Implementation Notes

### Step 1: License Service

Create `electron/services/licenseService.ts`:

```typescript
/**
 * License Validation Service
 * SPRINT-062: Auth Flow + Licensing System
 *
 * Validates user licenses against Supabase and manages offline caching.
 */

// Use existing supabaseService pattern from codebase
// NOTE: The codebase uses supabaseService.ts (singleton pattern with getClient() method)
// Adapt the import based on existing patterns in electron/services/
import supabaseService from './supabaseService';
import { store } from './store';
import type { UserLicense, LicenseStatus, LicenseType, TrialStatus } from '../../shared/types/license';

// Offline grace period (24 hours in milliseconds)
const OFFLINE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// Cache key for storing license status locally
const LICENSE_CACHE_KEY = 'license_cache';

interface LicenseCache {
  status: LicenseStatus;
  userId: string;
  cachedAt: number; // Unix timestamp
}

/**
 * Validate a user's license status
 */
export async function validateLicense(userId: string): Promise<LicenseStatus> {
  try {
    // Try to fetch from Supabase
    const status = await fetchLicenseFromSupabase(userId);

    // Cache the result for offline use
    cacheLicenseStatus(userId, status);

    return status;
  } catch (error) {
    console.error('Failed to validate license from Supabase:', error);

    // Check for cached license (offline mode)
    const cached = getCachedLicense(userId);
    if (cached) {
      return cached;
    }

    // No cache available
    return {
      isValid: false,
      licenseType: 'trial',
      transactionCount: 0,
      transactionLimit: 5,
      canCreateTransaction: false,
      deviceCount: 0,
      deviceLimit: 1,
      aiEnabled: false,
      blockReason: 'no_license',
    };
  }
}

/**
 * Fetch license status from Supabase
 */
async function fetchLicenseFromSupabase(userId: string): Promise<LicenseStatus> {
  // Fetch user license
  const { data: license, error } = await supabaseService.getClient()
    .from('user_licenses')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "No rows returned" which is OK (new user)
    throw error;
  }

  // No license found - user needs one created
  if (!license) {
    return {
      isValid: true, // Valid because we'll create a trial
      licenseType: 'trial',
      transactionCount: 0,
      transactionLimit: 5,
      canCreateTransaction: true,
      deviceCount: 0,
      deviceLimit: 1,
      aiEnabled: false,
      blockReason: 'no_license',
    };
  }

  // Count active devices
  const { count: deviceCount } = await supabaseService.getClient()
    .from('device_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  // Calculate license status
  return calculateLicenseStatus(license, deviceCount || 0);
}

/**
 * Calculate license status from database record
 */
function calculateLicenseStatus(license: UserLicense, deviceCount: number): LicenseStatus {
  const licenseType = license.license_type as LicenseType;
  const trialStatus = license.trial_status as TrialStatus | null;

  // Check trial expiry
  let isExpired = false;
  let trialDaysRemaining: number | undefined;

  if (licenseType === 'trial' && license.trial_expires_at) {
    const expiresAt = new Date(license.trial_expires_at);
    const now = new Date();
    isExpired = expiresAt < now;

    if (!isExpired) {
      const msRemaining = expiresAt.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    }
  }

  // Check transaction limit
  const atTransactionLimit = license.transaction_count >= license.transaction_limit;

  // Determine device limit based on license type
  const deviceLimit = licenseType === 'trial' ? 1 : licenseType === 'individual' ? 2 : 10;

  // Determine validity
  let isValid = true;
  let blockReason: LicenseStatus['blockReason'];

  if (licenseType === 'trial' && isExpired) {
    isValid = false;
    blockReason = 'expired';
  } else if (licenseType === 'trial' && atTransactionLimit) {
    // Not blocked, but can't create more transactions
  }

  return {
    isValid,
    licenseType,
    trialStatus: trialStatus || undefined,
    trialDaysRemaining,
    transactionCount: license.transaction_count,
    transactionLimit: license.transaction_limit,
    canCreateTransaction: !atTransactionLimit,
    deviceCount,
    deviceLimit,
    aiEnabled: license.ai_detection_enabled,
    blockReason,
  };
}

/**
 * Create a trial license for a new user
 */
export async function createUserLicense(userId: string): Promise<LicenseStatus> {
  const { data, error } = await supabaseService.getClient()
    .rpc('create_trial_license', { p_user_id: userId });

  if (error) {
    throw new Error(`Failed to create license: ${error.message}`);
  }

  // Re-validate to get full status
  return validateLicense(userId);
}

/**
 * Increment transaction count (call when user creates a transaction)
 */
export async function incrementTransactionCount(userId: string): Promise<number> {
  const { data, error } = await supabaseService.getClient()
    .rpc('increment_transaction_count', { p_user_id: userId });

  if (error) {
    throw new Error(`Failed to increment transaction count: ${error.message}`);
  }

  return data as number;
}

/**
 * Cache license status for offline use
 */
function cacheLicenseStatus(userId: string, status: LicenseStatus): void {
  try {
    const cache: LicenseCache = {
      status,
      userId,
      cachedAt: Date.now(),
    };
    store.set(LICENSE_CACHE_KEY, cache);
  } catch (error) {
    console.error('Failed to cache license status:', error);
  }
}

/**
 * Get cached license status (for offline mode)
 */
function getCachedLicense(userId: string): LicenseStatus | null {
  try {
    const cache = store.get(LICENSE_CACHE_KEY) as LicenseCache | undefined;

    if (!cache || cache.userId !== userId) {
      return null;
    }

    // Check if cache is within grace period
    const age = Date.now() - cache.cachedAt;
    if (age > OFFLINE_GRACE_PERIOD_MS) {
      // Cache expired
      return {
        ...cache.status,
        isValid: false,
        blockReason: 'expired',
      };
    }

    // Return cached status
    return cache.status;
  } catch (error) {
    console.error('Failed to read license cache:', error);
    return null;
  }
}

/**
 * Clear license cache (call on logout)
 */
export function clearLicenseCache(): void {
  try {
    store.delete(LICENSE_CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear license cache:', error);
  }
}

/**
 * Check if user can perform an action based on license
 */
export function canPerformAction(
  status: LicenseStatus,
  action: 'create_transaction' | 'use_ai' | 'export'
): boolean {
  if (!status.isValid) {
    return false;
  }

  switch (action) {
    case 'create_transaction':
      return status.canCreateTransaction;
    case 'use_ai':
      return status.aiEnabled;
    case 'export':
      return status.licenseType !== 'trial';
    default:
      return true;
  }
}
```

### Step 2: Device Service

Create `electron/services/deviceService.ts`:

```typescript
/**
 * Device Registration Service
 * SPRINT-062: Auth Flow + Licensing System
 *
 * Manages device registration and tracking.
 */

// Use existing supabaseService pattern from codebase
import supabaseService from './supabaseService';
import { machineIdSync } from 'node-machine-id';
import { hostname, platform } from 'os';
import type { DeviceRegistration, DeviceRegistrationResult, DevicePlatform } from '../../shared/types/license';

/**
 * Get unique device identifier
 */
export function getDeviceId(): string {
  try {
    return machineIdSync(true); // true = return original format
  } catch (error) {
    console.error('Failed to get machine ID, using fallback:', error);
    // Fallback to hostname-based ID (less reliable but works)
    return `${hostname()}-${platform()}-fallback`;
  }
}

/**
 * Get device name (for display in device management)
 */
export function getDeviceName(): string {
  return hostname();
}

/**
 * Get device platform
 */
export function getDevicePlatform(): DevicePlatform {
  const p = platform();
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return 'macos'; // Fallback
}

/**
 * Register current device for a user
 */
export async function registerDevice(userId: string): Promise<DeviceRegistrationResult> {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const devicePlatform = getDevicePlatform();

  try {
    // Try to upsert device registration
    const { data, error } = await supabaseService.getClient()
      .from('device_registrations')
      .upsert(
        {
          user_id: userId,
          device_id: deviceId,
          device_name: deviceName,
          platform: devicePlatform,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,device_id',
        }
      )
      .select()
      .single();

    if (error) {
      // Check if it's a device limit error
      if (error.message.includes('Device limit reached')) {
        return {
          success: false,
          error: 'device_limit_reached',
        };
      }
      throw error;
    }

    return {
      success: true,
      device: data as DeviceRegistration,
    };
  } catch (error: any) {
    console.error('Failed to register device:', error);

    if (error.message?.includes('Device limit')) {
      return {
        success: false,
        error: 'device_limit_reached',
      };
    }

    return {
      success: false,
      error: 'unknown',
    };
  }
}

/**
 * Update device last seen timestamp (heartbeat)
 */
export async function updateDeviceHeartbeat(userId: string): Promise<void> {
  const deviceId = getDeviceId();

  try {
    await supabaseService.getClient()
      .from('device_registrations')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch (error) {
    console.error('Failed to update device heartbeat:', error);
  }
}

/**
 * Get all devices for a user
 */
export async function getUserDevices(userId: string): Promise<DeviceRegistration[]> {
  const { data, error } = await supabaseService.getClient()
    .from('device_registrations')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get devices: ${error.message}`);
  }

  return data as DeviceRegistration[];
}

/**
 * Deactivate a device (for device management UI)
 */
export async function deactivateDevice(userId: string, deviceId: string): Promise<void> {
  const { error } = await supabaseService.getClient()
    .from('device_registrations')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('device_id', deviceId);

  if (error) {
    throw new Error(`Failed to deactivate device: ${error.message}`);
  }
}

/**
 * Delete a device registration
 */
export async function deleteDevice(userId: string, deviceId: string): Promise<void> {
  const { error } = await supabaseService.getClient()
    .from('device_registrations')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId);

  if (error) {
    throw new Error(`Failed to delete device: ${error.message}`);
  }
}

/**
 * Check if current device is registered
 */
export async function isDeviceRegistered(userId: string): Promise<boolean> {
  const deviceId = getDeviceId();

  const { data, error } = await supabaseService.getClient()
    .from('device_registrations')
    .select('id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to check device registration:', error);
  }

  return !!data;
}
```

### Step 3: IPC Handlers

Update `electron/license-handlers.ts` (or create if doesn't exist):

```typescript
/**
 * License IPC Handlers
 * SPRINT-062: Auth Flow + Licensing System
 */

import { ipcMain } from 'electron';
import {
  validateLicense,
  createUserLicense,
  incrementTransactionCount,
  clearLicenseCache,
  canPerformAction,
} from './services/licenseService';
import {
  registerDevice,
  getUserDevices,
  deactivateDevice,
  getDeviceId,
} from './services/deviceService';
import type { LicenseStatus } from '../shared/types/license';

export function setupLicenseHandlers(): void {
  // Validate license
  ipcMain.handle('license:validate', async (_event, userId: string): Promise<LicenseStatus> => {
    return validateLicense(userId);
  });

  // Create trial license
  ipcMain.handle('license:create', async (_event, userId: string): Promise<LicenseStatus> => {
    return createUserLicense(userId);
  });

  // Increment transaction count
  ipcMain.handle('license:incrementTransactionCount', async (_event, userId: string): Promise<number> => {
    return incrementTransactionCount(userId);
  });

  // Check if action allowed
  ipcMain.handle('license:canPerformAction', async (
    _event,
    status: LicenseStatus,
    action: 'create_transaction' | 'use_ai' | 'export'
  ): Promise<boolean> => {
    return canPerformAction(status, action);
  });

  // Clear cache (on logout)
  ipcMain.handle('license:clearCache', async (): Promise<void> => {
    clearLicenseCache();
  });

  // Register device
  ipcMain.handle('device:register', async (_event, userId: string) => {
    return registerDevice(userId);
  });

  // Get user devices
  ipcMain.handle('device:list', async (_event, userId: string) => {
    return getUserDevices(userId);
  });

  // Deactivate device
  ipcMain.handle('device:deactivate', async (_event, userId: string, deviceId: string) => {
    return deactivateDevice(userId, deviceId);
  });

  // Get current device ID
  ipcMain.handle('device:getCurrentId', async () => {
    return getDeviceId();
  });
}
```

### Step 4: Update Main Process

In `electron/main.ts`, add:

```typescript
import { setupLicenseHandlers } from './license-handlers';

// In app.whenReady() or similar initialization
setupLicenseHandlers();
```

### Step 5: Add node-machine-id Dependency

```bash
npm install node-machine-id
npm install @types/node-machine-id --save-dev
```

---

## Testing Requirements

### Unit Tests

Create `electron/services/__tests__/licenseService.test.ts`:

```typescript
import { canPerformAction } from '../licenseService';
import type { LicenseStatus } from '../../../shared/types/license';

describe('canPerformAction', () => {
  const baseStatus: LicenseStatus = {
    isValid: true,
    licenseType: 'trial',
    transactionCount: 0,
    transactionLimit: 5,
    canCreateTransaction: true,
    deviceCount: 1,
    deviceLimit: 1,
    aiEnabled: false,
  };

  it('returns false when license is invalid', () => {
    const status = { ...baseStatus, isValid: false };
    expect(canPerformAction(status, 'create_transaction')).toBe(false);
  });

  it('allows transaction creation when under limit', () => {
    expect(canPerformAction(baseStatus, 'create_transaction')).toBe(true);
  });

  it('blocks transaction creation when at limit', () => {
    const status = { ...baseStatus, canCreateTransaction: false };
    expect(canPerformAction(status, 'create_transaction')).toBe(false);
  });

  it('blocks AI for trial users', () => {
    expect(canPerformAction(baseStatus, 'use_ai')).toBe(false);
  });

  it('allows AI when enabled', () => {
    const status = { ...baseStatus, aiEnabled: true };
    expect(canPerformAction(status, 'use_ai')).toBe(true);
  });

  it('blocks export for trial users', () => {
    expect(canPerformAction(baseStatus, 'export')).toBe(false);
  });

  it('allows export for paid users', () => {
    const status = { ...baseStatus, licenseType: 'individual' };
    expect(canPerformAction(status, 'export')).toBe(true);
  });
});
```

### Integration Tests

Test against actual Supabase (in development):

```typescript
// Manual integration test steps
// 1. Create test user in Supabase
// 2. Call validateLicense - should return no_license
// 3. Call createUserLicense - should create trial
// 4. Call validateLicense - should return valid trial
// 5. Call incrementTransactionCount 5 times
// 6. Call validateLicense - canCreateTransaction should be false
```

---

## Acceptance Criteria

- [ ] `validateLicense()` returns correct status for all license types
- [ ] `createUserLicense()` creates trial license for new users
- [ ] `incrementTransactionCount()` updates Supabase correctly
- [ ] `registerDevice()` registers device and respects limits
- [ ] Offline grace period works (24-hour window)
- [ ] License cache is cleared on logout
- [ ] IPC handlers work from renderer
- [ ] node-machine-id dependency added
- [ ] Unit tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Integration Notes

- **Depends on**: TASK-1503 (schema must exist)
- **Next Task**: TASK-1505 (user gate to test service)
- **Used by**: TASK-1506, TASK-1507 for app integration

---

## Do / Don't

### Do:
- Use Supabase RPC functions where available (create_trial_license, etc.)
- Cache license status for offline resilience
- Handle network errors gracefully
- Use defensive coding for device ID generation
- Log errors but don't crash on failures

### Don't:
- Don't expose Supabase admin key to renderer (use IPC)
- Don't skip offline handling
- Don't block app forever on network issues (use grace period)
- Don't call Supabase on every action (use cached status)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Supabase admin client setup is unclear
- Device ID generation has issues on certain platforms
- Offline grace period should be different (currently 24 hours)
- License caching strategy needs adjustment

---

## PR Preparation

**Title**: `feat: implement license validation and device registration services`

**Labels**: `sprint-062`, `service`, `licensing`

**PR Body Template**:
```markdown
## Summary
- Create `licenseService.ts` for license validation against Supabase
- Create `deviceService.ts` for device registration management
- Add IPC handlers for renderer access
- Implement offline grace period (24 hours)
- Add unit tests

## Test Plan
- [ ] Unit tests pass: `npm test`
- [ ] Manual test: validate license for new user
- [ ] Manual test: create trial license
- [ ] Manual test: register device
- [ ] Manual test: offline mode (disconnect network)

## Dependencies
- TASK-1503 must be merged (Supabase schema)
- Adds `node-machine-id` dependency
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
| Implement tokens | ~30K | ___K | ___% |
| **Total** | ~40K | ___K | ___% |
