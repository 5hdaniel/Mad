# BACKLOG-291: Enhanced Error Diagnostics Report

## Category
UX, Support, Debugging

## Priority
Medium

## Status
Pending

## Description

The current error report shown by ErrorBoundary is minimal. It only includes:
- Timestamp
- Error message
- Stack trace
- Component stack

Users and support need more diagnostic information to debug issues effectively. The error report should include:

1. **Console logs** - Recent console.log/error/warn entries
2. **Main process logs** - Electron main process log entries (from VS Code terminal)
3. **System diagnostics** - App version, platform, OS version, memory usage
4. **Recent user actions** - What screens/actions led to the error
5. **Network status** - Online/offline, connection issues
6. **Auth state** - Is user logged in, which providers connected

## Current Error Report

```
=== MAGIC AUDIT ERROR REPORT ===

TIMESTAMP: 2026-01-16T23:44:45.278Z

ERROR:
Cannot read properties of undefined (reading 'system')

STACK TRACE:
TypeError: Cannot read properties of undefined (reading 'system')
    at LoadingOrchestrator.tsx:43:16
    ...

COMPONENT STACK:
    at LoadingOrchestrator (...)
    at AppStateProvider (...)
    ...
```

## Proposed Enhanced Report

```
=== MAGIC AUDIT ERROR REPORT ===

TIMESTAMP: 2026-01-16T23:44:45.278Z
APP VERSION: 1.1.0
PLATFORM: darwin (macOS 14.2.1)
NODE: v20.11.0
ELECTRON: v35.7.5

ERROR:
Cannot read properties of undefined (reading 'system')

STACK TRACE:
TypeError: Cannot read properties of undefined (reading 'system')
    at LoadingOrchestrator.tsx:43:16
    ...

COMPONENT STACK:
    at LoadingOrchestrator (...)
    at AppStateProvider (...)
    ...

RECENT CONSOLE LOGS (last 50 entries):
[13:14:53.966] [DeviceHandlers] Registering device detection handlers
[13:14:53.969] [BackupHandlers] Registering backup handlers
[13:14:54.504] [DatabaseService] Initializing database
...

RECENT USER ACTIONS:
1. App launched
2. Google login initiated
3. Google login completed
4. Transaction scan started
5. Error occurred in LoadingOrchestrator

SYSTEM STATE:
- Auth: Logged in (userId: 22db6971...)
- Email providers: Google (connected)
- Database: Initialized
- Network: Online
- Last sync: 2026-01-16T21:15:06Z

=== END REPORT ===
```

## Implementation Requirements

### 1. Console Log Capture

Create a ring buffer to capture recent console logs:

```typescript
// src/utils/consoleCapture.ts
const logBuffer: LogEntry[] = [];
const MAX_LOGS = 100;

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

export function initConsoleCapture() {
  ['log', 'error', 'warn'].forEach(method => {
    console[method] = (...args) => {
      logBuffer.push({
        timestamp: new Date().toISOString(),
        level: method,
        message: args.map(a => String(a)).join(' '),
      });
      if (logBuffer.length > MAX_LOGS) logBuffer.shift();
      originalConsole[method](...args);
    };
  });
}

export function getRecentLogs(): LogEntry[] {
  return [...logBuffer];
}
```

### 2. Main Process Log Forwarding

Forward main process logs to renderer via IPC for inclusion in reports:

```typescript
// In main process
ipcMain.handle('system:get-main-process-logs', () => {
  return mainProcessLogBuffer;  // Similar ring buffer in main
});
```

### 3. System Diagnostics Enhancement

Expand `system:get-diagnostics` to include more info:

```typescript
{
  appVersion: '1.1.0',
  platform: 'darwin',
  osVersion: '14.2.1',
  nodeVersion: 'v20.11.0',
  electronVersion: 'v35.7.5',
  memoryUsage: process.memoryUsage(),
  uptime: process.uptime(),
  dbInitialized: true,
  authState: { loggedIn: true, userId: '...', providers: ['google'] },
  networkOnline: true,
  lastSyncTime: '2026-01-16T21:15:06Z',
}
```

### 4. User Action Tracking

Track recent navigation/actions for debugging:

```typescript
// src/utils/actionTracker.ts
const actionBuffer: string[] = [];
const MAX_ACTIONS = 20;

export function trackAction(action: string) {
  actionBuffer.push(`${new Date().toISOString()} - ${action}`);
  if (actionBuffer.length > MAX_ACTIONS) actionBuffer.shift();
}

export function getRecentActions(): string[] {
  return [...actionBuffer];
}
```

### 5. ErrorBoundary Enhancement

Update ErrorBoundary to collect and display all diagnostic info:

```typescript
// In ErrorBoundary.tsx getDiagnosticsReport()
const report = `
=== MAGIC AUDIT ERROR REPORT ===

${await getSystemDiagnostics()}

ERROR:
${error.message}

STACK TRACE:
${error.stack}

COMPONENT STACK:
${componentStack}

RECENT CONSOLE LOGS:
${getRecentLogs().map(l => `[${l.timestamp}] ${l.level}: ${l.message}`).join('\n')}

RECENT USER ACTIONS:
${getRecentActions().join('\n')}

=== END REPORT ===
`;
```

## Acceptance Criteria

- [ ] Console logs captured in ring buffer (last 100 entries)
- [ ] Main process logs accessible from renderer
- [ ] System diagnostics include app version, platform, OS version
- [ ] User actions tracked (navigation, key events)
- [ ] Error report includes all diagnostic sections
- [ ] "Copy Report" button copies full enhanced report
- [ ] Report is formatted for easy reading and parsing
- [ ] No PII in reports (mask user IDs, emails)

## Files Likely Involved

- `src/components/ErrorBoundary.tsx` - Main error UI
- New: `src/utils/consoleCapture.ts` - Console log capture
- New: `src/utils/actionTracker.ts` - User action tracking
- `electron/system-handlers.ts` - Enhanced diagnostics IPC
- `electron/services/systemService.ts` - Diagnostics service

## Related

- BACKLOG-023 (Detailed Sync Progress) - Error diagnostics for sync
- BACKLOG-289 (Unified Notification System) - Error notifications

## Created
2026-01-16

## Reported By
User (error debugging session)
