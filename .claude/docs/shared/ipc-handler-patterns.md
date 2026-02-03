# IPC Handler Patterns

This document defines best practices for IPC (Inter-Process Communication) handlers in Magic Audit's Electron architecture.

---

## Overview

Magic Audit uses Electron's IPC for communication between:
- **Main process**: Node.js backend with database access
- **Preload scripts**: Bridge between main and renderer
- **Renderer process**: React frontend

---

## Core Principle: Sync Functions Own Their IPC Listeners

**CRITICAL**: IPC progress/status listeners MUST be set up inside the service layer, not in React components.

### Why This Matters

| Anti-Pattern | Problem |
|--------------|---------|
| Component sets up IPC listener | Multiple components = duplicate listeners |
| Component forgets cleanup | Memory leaks, stale handlers |
| Listener scattered across codebase | Hard to track, debug, maintain |

### Correct Pattern

```typescript
// In SyncOrchestratorService.ts
registerSyncFunction('messages', async (userId, onProgress) => {
  // 1. IPC listener setup INSIDE the sync function
  const cleanup = window.api.messages.onImportProgress((data) => {
    onProgress(data.percent);
  });

  try {
    // 2. Call the main process API
    const result = await window.api.messages.importMacOSMessages(userId);
    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }
    onProgress(100);
  } finally {
    // 3. Cleanup INSIDE the sync function - guaranteed
    cleanup();
  }
});
```

### Benefits

1. **Single listener per operation** - No duplicates
2. **Guaranteed cleanup** - `finally` block always runs
3. **Centralized logic** - One place to debug
4. **Consumer simplicity** - React just calls `requestSync()`

---

## IPC Handler Registration

### Main Process (electron/handlers/)

```typescript
// In electron/handlers/messages-handlers.ts
export function registerMessageHandlers(): void {
  ipcMain.handle('messages:import', async (event, userId: string) => {
    // Long-running operation
    for (let i = 0; i < messages.length; i++) {
      await processMessage(messages[i]);

      // Send progress to renderer
      event.sender.send('messages:import-progress', {
        percent: Math.round((i / messages.length) * 100)
      });
    }
    return { success: true, messagesImported: messages.length };
  });
}
```

### Preload Script (electron/preload.ts)

```typescript
contextBridge.exposeInMainWorld('api', {
  messages: {
    importMacOSMessages: (userId: string) =>
      ipcRenderer.invoke('messages:import', userId),

    // Progress listener - returns cleanup function
    onImportProgress: (callback: (data: { percent: number }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { percent: number }) => {
        callback(data);
      };
      ipcRenderer.on('messages:import-progress', handler);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('messages:import-progress', handler);
      };
    }
  }
});
```

---

## Type Safety

### Preload API Types (src/preload.d.ts)

```typescript
interface MessagesAPI {
  importMacOSMessages: (userId: string) => Promise<{
    success: boolean;
    messagesImported?: number;
    error?: string;
  }>;
  onImportProgress: (callback: (data: { percent: number }) => void) => () => void;
}

interface Window {
  api: {
    messages: MessagesAPI;
    // ... other APIs
  };
}
```

---

## Common Patterns

### Optional IPC Listener (API might not exist)

```typescript
// Some APIs may not have progress events
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = window.api.contacts as any;
const cleanup = api?.onImportProgress
  ? api.onImportProgress((data: { percent: number }) => {
      onProgress(data.percent);
    })
  : () => {};  // No-op cleanup if API doesn't exist

try {
  await window.api.contacts.getAll(userId);
} finally {
  cleanup();
}
```

### Platform-Specific Registration

```typescript
import { isMacOS } from '../utils/platform';

// Only register macOS-specific sync functions on macOS
if (isMacOS()) {
  syncOrchestrator.registerSyncFunction('contacts', contactsSync);
  syncOrchestrator.registerSyncFunction('messages', messagesSync);
}

// Cross-platform APIs always registered
syncOrchestrator.registerSyncFunction('emails', emailsSync);
```

---

## Anti-Patterns to Avoid

### 1. IPC Listener in React Component

```typescript
// BAD: Don't do this!
function SyncButton() {
  useEffect(() => {
    const cleanup = window.api.messages.onImportProgress((data) => {
      setProgress(data.percent);
    });
    return cleanup;
  }, []);

  return <button onClick={() => window.api.messages.importMacOSMessages(userId)}>
    Sync
  </button>;
}
```

**Problem**: Every component instance adds a listener. Multiple render = multiple listeners.

### 2. Forgetting Cleanup

```typescript
// BAD: No cleanup!
window.api.messages.onImportProgress((data) => {
  updateProgress(data.percent);
});
```

**Problem**: Listener accumulates on each call, causing memory leak.

### 3. Cleanup Outside Try/Finally

```typescript
// BAD: Cleanup might not run if error occurs before cleanup line
const cleanup = window.api.messages.onImportProgress(handler);
await window.api.messages.importMacOSMessages(userId);
cleanup();  // Never reached if importMacOSMessages throws
```

**Problem**: If the async call throws, cleanup is skipped.

---

## Testing IPC Handlers

### Mocking in Tests

```typescript
// In test setup
const mockOnProgress = vi.fn().mockReturnValue(vi.fn());  // Returns cleanup fn

window.api = {
  messages: {
    importMacOSMessages: vi.fn().mockResolvedValue({ success: true }),
    onImportProgress: mockOnProgress
  }
} as unknown as typeof window.api;

// Simulate progress events
test('tracks progress during sync', async () => {
  const progressCallback = mockOnProgress.mock.calls[0][0];

  // Simulate IPC progress events
  progressCallback({ percent: 25 });
  progressCallback({ percent: 50 });
  progressCallback({ percent: 75 });

  expect(getProgress()).toBe(75);
});
```

---

## Related Documentation

- `src/services/SyncOrchestratorService.ts` - Reference implementation
- `electron/preload.ts` - Preload API definitions
- `.claude/docs/shared/effect-safety-patterns.md` - React effect patterns
