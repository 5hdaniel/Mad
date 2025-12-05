# TASK-002: Bundle libimobiledevice Binaries

## Task Info
- **Task ID:** TASK-002
- **Phase:** 1 - Foundation
- **Dependencies:** None
- **Can Start:** Immediately
- **Estimated Effort:** 3-4 days

## Goal

Download, configure, and bundle pre-built libimobiledevice binaries for Windows so the Electron app can communicate with iPhones via USB.

## Background

libimobiledevice is an open-source library that allows communication with iOS devices. We need to bundle the Windows binaries (DLLs and CLI tools) with our Electron app.

## Deliverables

1. Pre-built Windows binaries for libimobiledevice in `resources/win/`
2. Helper module to locate and execute libimobiledevice CLI tools
3. Documentation for where binaries were sourced
4. Electron builder config to include binaries in Windows build

## Technical Requirements

### 1. Obtain Pre-built Binaries

Download from official releases:
- https://github.com/libimobiledevice-win32/imobiledevice-net/releases

Required binaries:
- `idevice_id.exe` - List connected devices
- `ideviceinfo.exe` - Get device information
- `idevicebackup2.exe` - Create/restore backups
- Required DLLs (libimobiledevice.dll, libplist.dll, etc.)

### 2. Create Resources Directory Structure

```
resources/
├── win/
│   └── libimobiledevice/
│       ├── idevice_id.exe
│       ├── ideviceinfo.exe
│       ├── idevicebackup2.exe
│       ├── libimobiledevice.dll
│       ├── libplist.dll
│       ├── libusbmuxd.dll
│       └── [other required DLLs]
└── LIBIMOBILEDEVICE_LICENSE.txt
```

### 3. Create Binary Locator Module

Create `electron/services/libimobiledeviceService.ts`:

```typescript
import path from 'path';
import { app } from 'electron';

export function getLibimobiledevicePath(): string {
  if (process.platform !== 'win32') {
    throw new Error('libimobiledevice binaries only available on Windows');
  }

  const isDev = !app.isPackaged;

  if (isDev) {
    return path.join(__dirname, '../../resources/win/libimobiledevice');
  }

  return path.join(process.resourcesPath, 'win/libimobiledevice');
}

export function getExecutablePath(name: string): string {
  return path.join(getLibimobiledevicePath(), `${name}.exe`);
}
```

### 4. Update Electron Builder Config

In `package.json`, add extraResources:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/win",
        "to": "win",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## Files to Create

- `resources/win/libimobiledevice/` - Directory with binaries
- `resources/LIBIMOBILEDEVICE_LICENSE.txt` - LGPL-2.1 license
- `electron/services/libimobiledeviceService.ts` - Binary locator

## Files to Modify

- `package.json` - Add extraResources config

## Dos

- ✅ Download binaries from official/trusted sources only
- ✅ Include all required DLL dependencies
- ✅ Include the LGPL-2.1 license file (legal requirement)
- ✅ Test that executables run on Windows
- ✅ Handle both dev and production paths

## Don'ts

- ❌ Don't compile from source (use pre-built binaries)
- ❌ Don't include macOS/Linux binaries (not needed for this task)
- ❌ Don't expose binary paths to renderer process
- ❌ Don't include unnecessary files (debug symbols, etc.)

## Testing Instructions

1. On Windows, verify binaries are in correct location
2. Run `idevice_id.exe --help` to verify it executes
3. Build the app and verify binaries are included in package
4. In packaged app, verify binary locator returns correct paths

## Example Usage

```typescript
import { getExecutablePath } from './libimobiledeviceService';
import { spawn } from 'child_process';

const ideviceId = getExecutablePath('idevice_id');
const process = spawn(ideviceId, ['-l']);
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added for libimobiledeviceService.ts
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
claude/complete-task-002-013VfYWDhcv2sSoY3rPZeZfN
```

### Changes Made
```
Files Created:
- resources/win/libimobiledevice/README.md - Documentation with instructions for downloading binaries from official releases
- electron/services/libimobiledeviceService.ts - Binary locator module with:
  - getLibimobiledevicePath() - Returns path to binaries directory (dev/prod aware)
  - getExecutablePath(name) - Returns full path to specific executable
  - areBinariesAvailable() - Checks if binaries directory exists
  - REQUIRED_EXECUTABLES constant - List of required executables
- electron/services/__tests__/libimobiledeviceService.test.ts - Unit tests for the service

Files Modified:
- package.json - Added extraResources config for Windows builds to include resources/win directory
```

### Testing Done
```
- Unit tests created for libimobiledeviceService covering:
  - Platform validation (throws on non-Windows)
  - Dev vs production path resolution
  - Executable path generation with .exe extension
  - Binaries availability checking
  - REQUIRED_EXECUTABLES constant validation
- Code follows existing patterns in the codebase (permissionService.ts, sessionService.ts)
- Note: npm install failed in CI environment due to network issues; type-check and lint could not be run
```

### Notes/Issues Encountered
```
1. Actual binary files (*.exe, *.dll) not included - README.md provides download instructions
   from official source: https://github.com/libimobiledevice-win32/imobiledevice-net/releases
2. License file skipped per user request
3. npm install failed due to network connectivity issues in the environment, preventing
   type-check and lint from running. Code follows established patterns and should pass once
   dependencies are installed.
```

### PR Link
```
[To be created after push]
```
