# TASK-003: Device Detection Service

## Task Info
- **Task ID:** TASK-003
- **Phase:** 1 - Foundation
- **Dependencies:** None (can mock libimobiledevice for now)
- **Can Start:** Immediately
- **Estimated Effort:** 3-4 days

## Goal

Create a service that detects when an iPhone is connected/disconnected via USB and retrieves basic device information.

## Background

When users plug in their iPhone, the app needs to detect it automatically and show device info (name, iOS version, etc.). This service will poll for connected devices using libimobiledevice CLI tools.

## Deliverables

1. Device detection service with connect/disconnect events
2. IPC handlers for renderer to subscribe to device events
3. Preload API exposure for device events
4. TypeScript types for device information

## Technical Requirements

### 1. Create Device Types

Create `electron/types/device.ts`:

```typescript
export interface iOSDevice {
  udid: string;
  name: string;
  productType: string;      // e.g., "iPhone14,2"
  productVersion: string;   // e.g., "17.0"
  serialNumber: string;
  isConnected: boolean;
}

export interface DeviceEvent {
  type: 'connected' | 'disconnected';
  device: iOSDevice;
}
```

### 2. Create Device Detection Service

Create `electron/services/deviceDetectionService.ts`:

```typescript
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import log from 'electron-log';

export class DeviceDetectionService extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null;
  private connectedDevices: Map<string, iOSDevice> = new Map();

  start(intervalMs: number = 2000): void {
    // Poll for devices every intervalMs
    // Compare with previous state
    // Emit 'device-connected' or 'device-disconnected' events
  }

  stop(): void {
    // Clear polling interval
  }

  async listDevices(): Promise<string[]> {
    // Run idevice_id -l and parse output
  }

  async getDeviceInfo(udid: string): Promise<iOSDevice> {
    // Run ideviceinfo -u <udid> and parse output
  }
}
```

### 3. Create IPC Handlers

Create `electron/handlers/deviceHandlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { DeviceDetectionService } from '../services/deviceDetectionService';

export function registerDeviceHandlers(mainWindow: BrowserWindow): void {
  const deviceService = new DeviceDetectionService();

  deviceService.on('device-connected', (device) => {
    mainWindow.webContents.send('device:connected', device);
  });

  deviceService.on('device-disconnected', (device) => {
    mainWindow.webContents.send('device:disconnected', device);
  });

  ipcMain.handle('device:list', async () => {
    return deviceService.getConnectedDevices();
  });

  ipcMain.handle('device:start-detection', () => {
    deviceService.start();
  });

  ipcMain.handle('device:stop-detection', () => {
    deviceService.stop();
  });
}
```

### 4. Update Preload Script

Add to `electron/preload.ts`:

```typescript
// Add to contextBridge.exposeInMainWorld
device: {
  list: () => ipcRenderer.invoke('device:list'),
  startDetection: () => ipcRenderer.invoke('device:start-detection'),
  stopDetection: () => ipcRenderer.invoke('device:stop-detection'),
  onConnected: (callback: (device: iOSDevice) => void) => {
    ipcRenderer.on('device:connected', (_, device) => callback(device));
  },
  onDisconnected: (callback: (device: iOSDevice) => void) => {
    ipcRenderer.on('device:disconnected', (_, device) => callback(device));
  },
}
```

## Files to Create

- `electron/types/device.ts`
- `electron/services/deviceDetectionService.ts`
- `electron/handlers/deviceHandlers.ts`

## Files to Modify

- `electron/preload.ts` - Add device API
- `electron/main.ts` - Register device handlers
- `src/types/electron.d.ts` - Add device types to window.electron

## Dos

- ✅ Use EventEmitter pattern for device events
- ✅ Handle cases where libimobiledevice isn't available (dev on non-Windows)
- ✅ Log all device events with electron-log
- ✅ Clean up polling interval on app quit
- ✅ Parse ideviceinfo output reliably

## Don'ts

- ❌ Don't poll too frequently (2 seconds minimum)
- ❌ Don't expose child_process to renderer
- ❌ Don't crash if no devices connected
- ❌ Don't store sensitive device info in logs

## Testing Instructions

1. Without iPhone: Service should return empty list, no errors
2. Connect iPhone: Should emit 'device-connected' event
3. Disconnect iPhone: Should emit 'device-disconnected' event
4. Multiple connects/disconnects: Should handle gracefully

## Mock Mode for Development

For development without Windows/iPhone, add mock mode:

```typescript
const MOCK_MODE = process.env.MOCK_DEVICE === 'true';

if (MOCK_MODE) {
  // Return fake device data for UI development
}
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added for deviceDetectionService.ts
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
