# TASK-006: Backup Service

## Task Info
- **Task ID:** TASK-006
- **Phase:** 2 - Core Services
- **Dependencies:** TASK-002 (libimobiledevice binaries), TASK-003 (device detection)
- **Can Start:** After TASK-002 and TASK-003 are complete
- **Estimated Effort:** 5-6 days

## Goal

Create a service that initiates iPhone backups via `idevicebackup2` CLI, monitors progress, and provides the backup path for parsing.

## Background

This is the core service that extracts data from the iPhone. It uses the `idevicebackup2` CLI tool to create a backup, parses the progress output, and emits events that the UI can use to show progress.

## Deliverables

1. Backup service that wraps idevicebackup2
2. Progress parsing and event emission
3. Backup management (start, cancel, cleanup)
4. IPC handlers for renderer communication

## Technical Requirements

### 1. Create Backup Types

Create `electron/types/backup.ts`:

```typescript
export interface BackupProgress {
  phase: 'preparing' | 'transferring' | 'finishing';
  percentComplete: number;
  currentFile: string | null;
  filesTransferred: number;
  totalFiles: number | null;
  bytesTransferred: number;
  totalBytes: number | null;
}

export interface BackupResult {
  success: boolean;
  backupPath: string | null;
  error: string | null;
  duration: number;           // milliseconds
  deviceUdid: string;
}

export interface BackupOptions {
  udid: string;
  outputDir?: string;         // Default: app's userData folder
  includeApps?: boolean;      // Default: false (faster)
}
```

### 2. Create Backup Service

Create `electron/services/backupService.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import { getExecutablePath } from './libimobiledeviceService';

export class BackupService extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private isRunning: boolean = false;

  async startBackup(options: BackupOptions): Promise<BackupResult> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    const backupPath = options.outputDir || this.getDefaultBackupPath();
    const idevicebackup2 = getExecutablePath('idevicebackup2');

    return new Promise((resolve, reject) => {
      this.isRunning = true;
      const startTime = Date.now();

      // Command: idevicebackup2 -u <udid> backup <path>
      this.currentProcess = spawn(idevicebackup2, [
        '-u', options.udid,
        'backup',
        backupPath
      ]);

      this.currentProcess.stdout.on('data', (data) => {
        const progress = this.parseProgress(data.toString());
        if (progress) {
          this.emit('progress', progress);
        }
      });

      this.currentProcess.stderr.on('data', (data) => {
        log.error('Backup stderr:', data.toString());
      });

      this.currentProcess.on('close', (code) => {
        this.isRunning = false;
        this.currentProcess = null;

        resolve({
          success: code === 0,
          backupPath: code === 0 ? path.join(backupPath, options.udid) : null,
          error: code !== 0 ? `Backup failed with code ${code}` : null,
          duration: Date.now() - startTime,
          deviceUdid: options.udid
        });
      });
    });
  }

  cancelBackup(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.isRunning = false;
    }
  }

  private parseProgress(output: string): BackupProgress | null {
    // Parse idevicebackup2 output
    // Example outputs:
    // "Receiving files"
    // "file1.txt (1/100)"
    // Example: Look for patterns like percentages, file counts
  }

  private getDefaultBackupPath(): string {
    return path.join(app.getPath('userData'), 'Backups');
  }

  async cleanupBackup(backupPath: string): Promise<void> {
    // Delete backup folder after parsing is complete
  }
}
```

### 3. Create IPC Handlers

Create `electron/handlers/backupHandlers.ts`:

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { BackupService } from '../services/backupService';

export function registerBackupHandlers(mainWindow: BrowserWindow): void {
  const backupService = new BackupService();

  backupService.on('progress', (progress) => {
    mainWindow.webContents.send('backup:progress', progress);
  });

  ipcMain.handle('backup:start', async (_, options) => {
    return backupService.startBackup(options);
  });

  ipcMain.handle('backup:cancel', () => {
    backupService.cancelBackup();
  });

  ipcMain.handle('backup:cleanup', async (_, backupPath) => {
    return backupService.cleanupBackup(backupPath);
  });
}
```

### 4. Update Preload Script

Add to `electron/preload.ts`:

```typescript
backup: {
  start: (options: BackupOptions) => ipcRenderer.invoke('backup:start', options),
  cancel: () => ipcRenderer.invoke('backup:cancel'),
  cleanup: (path: string) => ipcRenderer.invoke('backup:cleanup', path),
  onProgress: (callback: (progress: BackupProgress) => void) => {
    ipcRenderer.on('backup:progress', (_, progress) => callback(progress));
  },
}
```

## Files to Create

- `electron/types/backup.ts`
- `electron/services/backupService.ts`
- `electron/handlers/backupHandlers.ts`
- `electron/services/__tests__/backupService.test.ts`

## Files to Modify

- `electron/preload.ts` - Add backup API
- `electron/main.ts` - Register backup handlers
- `src/types/electron.d.ts` - Add backup types

## Dos

- ✅ Handle process cleanup on app quit
- ✅ Parse progress output to provide user feedback
- ✅ Log all backup operations
- ✅ Allow cancellation mid-backup
- ✅ Create backup directory if it doesn't exist

## Don'ts

- ❌ Don't run multiple backups simultaneously
- ❌ Don't leave orphaned backup processes on app crash
- ❌ Don't store backups in user-visible locations
- ❌ Don't expose raw CLI output to renderer

## Testing Instructions

1. Mock idevicebackup2 CLI for unit tests
2. Test progress parsing with sample outputs
3. Test cancellation mid-backup
4. Test error handling (device disconnected, permission denied)
5. Integration test with real iPhone (manual)

## Sample idevicebackup2 Output to Parse

```
Backup started
Receiving files
  - Domain: HomeDomain
  - File: Library/SMS/sms.db (1/1523)
  - File: Library/SMS/Attachments/ab/abc123.jpg (2/1523)
Backup completed successfully
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added with good coverage
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
