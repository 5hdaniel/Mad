# TASK-011: Integration & End-to-End Testing

## Task Info
- **Task ID:** TASK-011
- **Phase:** 4 - Integration
- **Dependencies:** ALL previous tasks (TASK-001 through TASK-010)
- **Can Start:** After all other tasks are complete
- **Estimated Effort:** 5-7 days

## Goal

Integrate all components, create end-to-end tests, and ensure the complete iPhone sync flow works on Windows.

## Background

This is the final integration task. All individual components have been built:
- Windows build configuration (TASK-001)
- libimobiledevice binaries (TASK-002)
- Device detection (TASK-003)
- Message parsing (TASK-004)
- Contact parsing (TASK-005)
- Backup service (TASK-006)
- Encryption handling (TASK-007)
- Connection UI (TASK-008)
- Progress UI (TASK-009)
- Platform toggle (TASK-010)

Now we wire them all together and test the complete flow.

## Deliverables

1. Integrated sync flow from device detection to message display
2. End-to-end tests for critical paths
3. Error handling for edge cases
4. Documentation for Windows setup

## Technical Requirements

### 1. Create Main Sync Orchestrator

Create `electron/services/syncOrchestrator.ts`:

```typescript
import { EventEmitter } from 'events';
import { DeviceDetectionService } from './deviceDetectionService';
import { BackupService } from './backupService';
import { BackupDecryptionService } from './backupDecryptionService';
import { iOSMessagesParser } from './iosMessagesParser';
import { iOSContactsParser } from './iosContactsParser';
import log from 'electron-log';

export interface SyncResult {
  success: boolean;
  messages: iOSMessage[];
  contacts: iOSContact[];
  conversations: iOSConversation[];
  error: string | null;
}

export class SyncOrchestrator extends EventEmitter {
  private deviceService: DeviceDetectionService;
  private backupService: BackupService;
  private decryptionService: BackupDecryptionService;
  private messagesParser: iOSMessagesParser;
  private contactsParser: iOSContactsParser;

  constructor() {
    super();
    this.deviceService = new DeviceDetectionService();
    this.backupService = new BackupService();
    this.decryptionService = new BackupDecryptionService();
    this.messagesParser = new iOSMessagesParser();
    this.contactsParser = new iOSContactsParser();

    this.setupEventForwarding();
  }

  private setupEventForwarding(): void {
    // Forward progress events
    this.backupService.on('progress', (progress) => {
      this.emit('progress', progress);
    });

    this.deviceService.on('device-connected', (device) => {
      this.emit('device-connected', device);
    });

    this.deviceService.on('device-disconnected', (device) => {
      this.emit('device-disconnected', device);
    });
  }

  async sync(udid: string, password?: string): Promise<SyncResult> {
    try {
      log.info('Starting sync for device:', udid);

      // Step 1: Create backup
      this.emit('phase', 'backup');
      const backupResult = await this.backupService.startBackup({
        udid,
        password
      });

      if (!backupResult.success) {
        return this.errorResult(backupResult.error);
      }

      let backupPath = backupResult.backupPath;

      // Step 2: Decrypt if needed
      if (backupResult.isEncrypted && password) {
        this.emit('phase', 'decrypting');
        const decryptResult = await this.decryptionService.decryptBackup(
          backupPath,
          password
        );

        if (!decryptResult.success) {
          return this.errorResult(decryptResult.error);
        }

        backupPath = decryptResult.decryptedPath;
      }

      // Step 3: Parse contacts
      this.emit('phase', 'parsing-contacts');
      this.contactsParser.open(backupPath);
      const contacts = this.contactsParser.getAllContacts();

      // Step 4: Parse messages
      this.emit('phase', 'parsing-messages');
      this.messagesParser.open(backupPath);
      const conversations = this.messagesParser.getConversations();

      // Step 5: Resolve contact names in messages
      this.emit('phase', 'resolving');
      const resolvedConversations = this.resolveContactNames(
        conversations,
        contacts
      );

      // Step 6: Cleanup
      this.emit('phase', 'cleanup');
      this.messagesParser.close();
      this.contactsParser.close();
      await this.backupService.cleanupBackup(backupPath);

      log.info('Sync complete:', {
        conversations: resolvedConversations.length,
        contacts: contacts.length
      });

      return {
        success: true,
        messages: resolvedConversations.flatMap(c => c.messages),
        contacts,
        conversations: resolvedConversations,
        error: null
      };

    } catch (error) {
      log.error('Sync failed:', error);
      return this.errorResult(error.message);
    }
  }

  private resolveContactNames(
    conversations: iOSConversation[],
    contacts: iOSContact[]
  ): iOSConversation[] {
    // Use contact parser's lookup to resolve handles to names
    // ...
  }

  private errorResult(error: string): SyncResult {
    return {
      success: false,
      messages: [],
      contacts: [],
      conversations: [],
      error
    };
  }
}
```

### 2. Create Integration IPC Handlers

Create `electron/handlers/syncHandlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { SyncOrchestrator } from '../services/syncOrchestrator';

export function registerSyncHandlers(mainWindow: BrowserWindow): void {
  const orchestrator = new SyncOrchestrator();

  // Forward all events to renderer
  ['progress', 'phase', 'device-connected', 'device-disconnected'].forEach(event => {
    orchestrator.on(event, (data) => {
      mainWindow.webContents.send(`sync:${event}`, data);
    });
  });

  ipcMain.handle('sync:start', async (_, { udid, password }) => {
    return orchestrator.sync(udid, password);
  });

  ipcMain.handle('sync:cancel', () => {
    orchestrator.cancel();
  });
}
```

### 3. Create Windows-Specific Entry Point

Update the main sync UI to use the orchestrator on Windows:

```typescript
// In the main app component or sync page
import { usePlatform } from '../contexts/PlatformContext';
import { useIPhoneSync } from '../hooks/useIPhoneSync';

const SyncPage: React.FC = () => {
  const { isWindows, isMacOS } = usePlatform();

  if (isMacOS) {
    // Use existing macOS local database flow
    return <MacOSMessagesView />;
  }

  if (isWindows) {
    // Use iPhone USB sync flow
    return <WindowsIPhoneSyncView />;
  }

  return <UnsupportedPlatformView />;
};
```

### 4. End-to-End Tests

Create `electron/services/__tests__/syncOrchestrator.e2e.test.ts`:

```typescript
import { SyncOrchestrator } from '../syncOrchestrator';

describe('SyncOrchestrator E2E', () => {
  // Note: These tests require a connected iPhone or mock setup

  describe('with mock device', () => {
    it('should complete full sync flow', async () => {
      const orchestrator = new SyncOrchestrator();
      const phases: string[] = [];

      orchestrator.on('phase', (phase) => phases.push(phase));

      const result = await orchestrator.sync('mock-udid');

      expect(result.success).toBe(true);
      expect(phases).toEqual([
        'backup',
        'parsing-contacts',
        'parsing-messages',
        'resolving',
        'cleanup'
      ]);
    });

    it('should handle device disconnection', async () => {
      // Test error handling when device disconnects mid-sync
    });

    it('should handle encrypted backup', async () => {
      // Test with password-protected backup
    });
  });
});
```

### 5. Create Windows Setup Documentation

Create `docs/WINDOWS_SETUP.md`:

```markdown
# Magic Audit - Windows Setup Guide

## Requirements

- Windows 10 or later
- iTunes installed (for Apple device drivers)
- USB cable for iPhone

## First-Time Setup

1. Install iTunes from Microsoft Store or apple.com
2. Connect your iPhone via USB
3. On your iPhone, tap "Trust" when prompted
4. Enter your iPhone passcode
5. Launch Magic Audit and click "Sync from iPhone"

## Troubleshooting

### iPhone not detected
- Ensure iTunes is installed
- Try a different USB port
- Restart both devices

### "Trust This Computer" not appearing
- Disconnect and reconnect iPhone
- Restart iPhone
- Reset Location & Privacy settings on iPhone

### Backup password required
This means you previously enabled "Encrypt iPhone backup" in iTunes.
Enter the password you set at that time.
```

## Files to Create

- `electron/services/syncOrchestrator.ts`
- `electron/handlers/syncHandlers.ts`
- `electron/services/__tests__/syncOrchestrator.e2e.test.ts`
- `docs/WINDOWS_SETUP.md`

## Files to Modify

- `electron/main.ts` - Register sync handlers
- `electron/preload.ts` - Add sync API
- `src/App.tsx` - Add platform-aware routing
- `src/types/electron.d.ts` - Add sync types

## Integration Checklist

Verify all these work together:

- [ ] Device detection triggers UI update
- [ ] Backup progress shows in UI
- [ ] Encrypted backup prompts for password
- [ ] Wrong password shows error and allows retry
- [ ] Messages appear after sync completes
- [ ] Contact names are resolved in messages
- [ ] Cancel works mid-sync
- [ ] Device disconnection handled gracefully
- [ ] Cleanup removes temporary backup files

## Testing Matrix

Test on these configurations:

| OS | iTunes | iPhone | iOS | Encrypted |
|----|--------|--------|-----|-----------|
| Win 10 | MS Store | Any | 15+ | No |
| Win 10 | MS Store | Any | 15+ | Yes |
| Win 11 | MS Store | Any | 17+ | No |
| Win 11 | Apple.com | Any | 17+ | Yes |

## Dos

- ✅ Test full flow on real Windows machine with real iPhone
- ✅ Handle all error cases gracefully
- ✅ Log all sync operations for debugging
- ✅ Clean up temporary files on success AND failure
- ✅ Verify all previous task components work together

## Don'ts

- ❌ Don't skip real device testing
- ❌ Don't leave debug code in production
- ❌ Don't assume happy path only
- ❌ Don't forget to test cancellation

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log throughout
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] E2E tests pass
- [ ] Manual testing complete on Windows
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
[DESCRIBE WHAT TESTING YOU PERFORMED - include Windows version, iPhone model, iOS version]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
