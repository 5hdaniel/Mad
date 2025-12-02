# TASK-008: iPhone Connection UI

## Task Info
- **Task ID:** TASK-008
- **Phase:** 3 - UI/UX
- **Dependencies:** None (can use mock data)
- **Can Start:** Immediately
- **Estimated Effort:** 3-4 days

## Goal

Create React components for the iPhone connection flow: detecting device, showing device info, and prompting for password if needed.

## Background

When running on Windows, users will connect their iPhone via USB instead of accessing local macOS databases. This task creates the UI components for that connection flow.

## Deliverables

1. iPhone connection status component
2. Device info display component
3. Backup password prompt modal
4. "Trust This Computer" guidance component
5. Integration with device detection events

## Technical Requirements

### 1. Create Connection Status Component

Create `src/components/iphone/ConnectionStatus.tsx`:

```typescript
import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  device: iOSDevice | null;
  onSyncClick: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  device,
  onSyncClick
}) => {
  if (!isConnected) {
    return (
      <div className="connection-status disconnected">
        <PhoneIcon className="icon-large text-gray-400" />
        <h3>Connect Your iPhone</h3>
        <p>Connect your iPhone using a USB cable to sync messages and contacts.</p>
        <TrustComputerHint />
      </div>
    );
  }

  return (
    <div className="connection-status connected">
      <PhoneIcon className="icon-large text-green-500" />
      <h3>{device?.name || 'iPhone'}</h3>
      <p className="text-sm text-gray-500">iOS {device?.productVersion}</p>
      <button onClick={onSyncClick} className="btn-primary">
        Sync Messages & Contacts
      </button>
    </div>
  );
};
```

### 2. Create Trust Computer Hint Component

Create `src/components/iphone/TrustComputerHint.tsx`:

```typescript
import React from 'react';

export const TrustComputerHint: React.FC = () => {
  return (
    <div className="trust-hint">
      <InfoIcon className="icon-small" />
      <div>
        <p className="font-medium">First time connecting?</p>
        <ol className="text-sm text-gray-600">
          <li>1. Unlock your iPhone</li>
          <li>2. Tap "Trust" when prompted</li>
          <li>3. Enter your iPhone passcode</li>
        </ol>
      </div>
    </div>
  );
};
```

### 3. Create Device Info Component

Create `src/components/iphone/DeviceInfo.tsx`:

```typescript
import React from 'react';

interface DeviceInfoProps {
  device: iOSDevice;
}

export const DeviceInfo: React.FC<DeviceInfoProps> = ({ device }) => {
  return (
    <div className="device-info">
      <div className="device-info-row">
        <span className="label">Device Name</span>
        <span className="value">{device.name}</span>
      </div>
      <div className="device-info-row">
        <span className="label">iOS Version</span>
        <span className="value">{device.productVersion}</span>
      </div>
      <div className="device-info-row">
        <span className="label">Model</span>
        <span className="value">{formatProductType(device.productType)}</span>
      </div>
    </div>
  );
};

function formatProductType(productType: string): string {
  // Map product types to friendly names
  const models: Record<string, string> = {
    'iPhone14,2': 'iPhone 13 Pro',
    'iPhone15,2': 'iPhone 14 Pro',
    // ... add more mappings
  };
  return models[productType] || productType;
}
```

### 4. Create Password Prompt Modal

Create `src/components/iphone/BackupPasswordModal.tsx`:

```typescript
import React, { useState } from 'react';

interface BackupPasswordModalProps {
  isOpen: boolean;
  deviceName: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string;
}

export const BackupPasswordModal: React.FC<BackupPasswordModalProps> = ({
  isOpen,
  deviceName,
  onSubmit,
  onCancel,
  error
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Backup Password Required</h2>
        <p>
          Your iPhone backup is encrypted. Enter the password you set
          in iTunes/Finder to continue.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Backup password"
          className="input-field"
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <div className="modal-actions">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(password)}
            className="btn-primary"
            disabled={!password}
          >
            Continue
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          This is the password you set when enabling "Encrypt iPhone backup"
          in iTunes or Finder. It's different from your iPhone passcode.
        </p>
      </div>
    </div>
  );
};
```

### 5. Create iPhone Sync Hook

Create `src/hooks/useIPhoneSync.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseIPhoneSyncReturn {
  isConnected: boolean;
  device: iOSDevice | null;
  syncStatus: 'idle' | 'syncing' | 'complete' | 'error';
  progress: BackupProgress | null;
  error: string | null;
  needsPassword: boolean;
  startSync: () => void;
  submitPassword: (password: string) => void;
  cancelSync: () => void;
}

export function useIPhoneSync(): UseIPhoneSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<iOSDevice | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    // Start device detection
    window.electron.device.startDetection();

    // Subscribe to device events
    window.electron.device.onConnected((device) => {
      setIsConnected(true);
      setDevice(device);
    });

    window.electron.device.onDisconnected(() => {
      setIsConnected(false);
      setDevice(null);
    });

    // Subscribe to backup progress
    window.electron.backup.onProgress((progress) => {
      setProgress(progress);
    });

    return () => {
      window.electron.device.stopDetection();
    };
  }, []);

  const startSync = useCallback(async () => {
    if (!device) return;

    setSyncStatus('syncing');
    setError(null);

    const result = await window.electron.backup.start({ udid: device.udid });

    if (result.error === 'PASSWORD_REQUIRED') {
      setNeedsPassword(true);
      return;
    }

    if (result.success) {
      setSyncStatus('complete');
    } else {
      setSyncStatus('error');
      setError(result.error);
    }
  }, [device]);

  // ... rest of implementation

  return {
    isConnected,
    device,
    syncStatus,
    progress,
    error,
    needsPassword,
    startSync,
    submitPassword,
    cancelSync
  };
}
```

## Files to Create

- `src/components/iphone/ConnectionStatus.tsx`
- `src/components/iphone/TrustComputerHint.tsx`
- `src/components/iphone/DeviceInfo.tsx`
- `src/components/iphone/BackupPasswordModal.tsx`
- `src/components/iphone/index.ts` (exports)
- `src/hooks/useIPhoneSync.ts`

## Files to Modify

- `src/types/electron.d.ts` - Add device and backup types if not already present

## Styling Requirements

Follow existing Tailwind CSS patterns in the codebase. Match the existing design system:
- Use existing color variables
- Match button styles with existing buttons
- Use existing modal patterns if available

## Dos

- ✅ Follow existing component patterns in the codebase
- ✅ Use TypeScript with proper types
- ✅ Make components work with mock data for development
- ✅ Handle loading and error states
- ✅ Make password field secure (type="password")
- ✅ Add keyboard support (Enter to submit, Escape to cancel)

## Don'ts

- ❌ Don't store password in component state longer than needed
- ❌ Don't show raw technical errors to users
- ❌ Don't assume device is always connected
- ❌ Don't forget to handle the "no device" state

## Testing Instructions

1. Test with mock device data
2. Test connection/disconnection flow
3. Test password modal open/close/submit
4. Test keyboard navigation
5. Test error display

## Mock Data for Development

```typescript
const mockDevice: iOSDevice = {
  udid: 'abc123',
  name: "Daniel's iPhone",
  productType: 'iPhone14,2',
  productVersion: '17.0',
  serialNumber: 'XYZ789',
  isConnected: true
};
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Components tested with mock data
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added for components
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
