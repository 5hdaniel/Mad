# TASK-006: Backup Service

## Task Info
- **Task ID:** TASK-006
- **Phase:** 2 - Core Services
- **Dependencies:** TASK-002 (libimobiledevice binaries), TASK-003 (device detection)
- **Can Start:** After TASK-002 and TASK-003 are complete
- **Estimated Effort:** 6-8 days

## Goal

Create a service that extracts **only messages and contacts** from iPhone via `idevicebackup2` CLI, using the smallest possible backup size.

## Background

This is the core service that extracts data from the iPhone. The critical challenge is that a full iPhone backup can be **50-150 GB** and take **30-90 minutes**, but we only need **~1-2 GB** of data (messages and contacts).

## ⚠️ CRITICAL: Backup Size Optimization

**DO NOT implement a full backup.** Users will abandon the app if the first sync takes 60+ minutes.

### What We Need vs. Full Backup

```
Full iPhone Backup:
┌─────────────────────────────────────────────────────────────┐
│  CameraRollDomain  │  AppDomain  │  MediaDomain  │  HomeDomain  │
│     (Photos)       │   (Apps)    │   (Music)     │  (Messages)  │
│      80 GB         │    20 GB    │     5 GB      │     2 GB     │
└─────────────────────────────────────────────────────────────┘
Total: 100+ GB, 60+ minutes

What We Actually Need:
┌─────────────────────────────────────────────────────────────┐
│        ❌           │      ❌      │       ❌       │      ✅      │
│                    │             │               │  HomeDomain  │
│                    │             │               │  (Messages,  │
│                    │             │               │   Contacts)  │
│                    │             │               │     2 GB     │
└─────────────────────────────────────────────────────────────┘
Total: ~2 GB, 3-10 minutes
```

### Research Required (MUST DO FIRST)

Before implementing, investigate these approaches in order of priority:

#### Priority 1: Domain Filtering
```bash
# Check if idevicebackup2 supports domain filtering
idevicebackup2 --help

# Look for flags like:
--domain <name>        # Whitelist: only backup specific domain
--exclude <name>       # Blacklist: exclude specific domain
--include <name>       # Include specific domain
```

**Domains to research:**
- `HomeDomain` - Contains Messages (sms.db) and Contacts (AddressBook.sqlitedb)
- `CameraRollDomain` - Photos/Videos (EXCLUDE - huge)
- `AppDomain` - App data (EXCLUDE - large)
- `MediaDomain` - Music/Podcasts (EXCLUDE)

#### Priority 2: Check libimobiledevice Source
If CLI doesn't support domain filtering, check:
- https://github.com/libimobiledevice/libimobiledevice/blob/master/tools/idevicebackup2.c
- Look for domain-related code that could be exposed

#### Priority 3: Alternative Tools
Research if other tools solve this:
- `pymobiledevice3` (Python) - may have better domain support
- `idevicebackup2` forks with additional features

### Document Your Findings

Create `docs/BACKUP_RESEARCH.md` with:
1. What domain filtering options exist
2. Which approach you chose and why
3. Expected backup size and time
4. Any limitations discovered

## Deliverables

1. **Research document** on domain filtering options
2. Backup service that uses **minimal backup size**
3. Progress parsing and event emission
4. Incremental backup support (for subsequent syncs)
5. Backup management (start, cancel, cleanup)
6. IPC handlers for renderer communication

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
  estimatedTimeRemaining: number | null;  // seconds
}

export interface BackupResult {
  success: boolean;
  backupPath: string | null;
  error: string | null;
  duration: number;           // milliseconds
  deviceUdid: string;
  isIncremental: boolean;     // Was this a delta backup?
  backupSize: number;         // bytes
}

export interface BackupOptions {
  udid: string;
  outputDir?: string;         // Default: app's userData folder
  forceFullBackup?: boolean;  // Default: false (prefer incremental)
}

export interface BackupCapabilities {
  supportsDomainFiltering: boolean;
  supportsIncremental: boolean;
  availableDomains: string[];
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

  /**
   * Check what backup capabilities are available
   * Run this first to determine the best backup strategy
   */
  async checkCapabilities(): Promise<BackupCapabilities> {
    // Run idevicebackup2 --help and parse output
    // Look for domain-related flags
    // Return what's supported
  }

  /**
   * Start a minimal backup (messages + contacts only)
   */
  async startBackup(options: BackupOptions): Promise<BackupResult> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    const capabilities = await this.checkCapabilities();
    const backupPath = options.outputDir || this.getDefaultBackupPath();
    const idevicebackup2 = getExecutablePath('idevicebackup2');

    // Build command based on capabilities
    const args = this.buildBackupArgs(options, capabilities);

    return new Promise((resolve, reject) => {
      this.isRunning = true;
      const startTime = Date.now();

      log.info('Starting backup with args:', args);

      this.currentProcess = spawn(idevicebackup2, args);

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

        const backupSize = this.calculateBackupSize(
          path.join(backupPath, options.udid)
        );

        resolve({
          success: code === 0,
          backupPath: code === 0 ? path.join(backupPath, options.udid) : null,
          error: code !== 0 ? `Backup failed with code ${code}` : null,
          duration: Date.now() - startTime,
          deviceUdid: options.udid,
          isIncremental: this.wasIncrementalBackup(backupPath, options.udid),
          backupSize
        });
      });
    });
  }

  /**
   * Build backup command arguments based on capabilities
   */
  private buildBackupArgs(
    options: BackupOptions,
    capabilities: BackupCapabilities
  ): string[] {
    const args = ['-u', options.udid];

    // If domain filtering is supported, only backup what we need
    if (capabilities.supportsDomainFiltering) {
      // Option A: Whitelist approach
      args.push('--domain', 'HomeDomain');
      // OR Option B: Blacklist approach
      // args.push('--exclude', 'CameraRollDomain');
      // args.push('--exclude', 'AppDomain');
      // args.push('--exclude', 'MediaDomain');
    }

    args.push('backup');
    args.push(this.getDefaultBackupPath());

    return args;
  }

  /**
   * Check if a previous backup exists (for incremental)
   */
  private wasIncrementalBackup(backupPath: string, udid: string): boolean {
    // idevicebackup2 automatically does incremental if backup exists
    // Check if this was a fresh or incremental backup
  }

  cancelBackup(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.isRunning = false;
    }
  }

  private parseProgress(output: string): BackupProgress | null {
    // Parse idevicebackup2 output
    // Look for patterns like:
    // "Receiving files"
    // "file1.txt (1/100)"
    // Percentages, file counts, etc.
  }

  private getDefaultBackupPath(): string {
    return path.join(app.getPath('userData'), 'Backups');
  }

  private calculateBackupSize(backupPath: string): number {
    // Calculate total size of backup directory
  }

  /**
   * Keep backup for incremental syncs, but clean old versions
   */
  async cleanupOldBackups(keepCount: number = 1): Promise<void> {
    // Keep most recent backup for incremental
    // Delete older backups to save space
  }

  /**
   * Full cleanup - delete all backups for a device
   */
  async deleteBackup(backupPath: string): Promise<void> {
    // Securely delete backup folder
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

  ipcMain.handle('backup:capabilities', async () => {
    return backupService.checkCapabilities();
  });

  ipcMain.handle('backup:start', async (_, options) => {
    return backupService.startBackup(options);
  });

  ipcMain.handle('backup:cancel', () => {
    backupService.cancelBackup();
  });

  ipcMain.handle('backup:cleanup', async (_, backupPath) => {
    return backupService.deleteBackup(backupPath);
  });
}
```

### 4. Update Preload Script

Add to `electron/preload.ts`:

```typescript
backup: {
  getCapabilities: () => ipcRenderer.invoke('backup:capabilities'),
  start: (options: BackupOptions) => ipcRenderer.invoke('backup:start', options),
  cancel: () => ipcRenderer.invoke('backup:cancel'),
  cleanup: (path: string) => ipcRenderer.invoke('backup:cleanup', path),
  onProgress: (callback: (progress: BackupProgress) => void) => {
    ipcRenderer.on('backup:progress', (_, progress) => callback(progress));
  },
}
```

## Files to Create

- `docs/BACKUP_RESEARCH.md` - **CREATE FIRST** - Document your findings
- `electron/types/backup.ts`
- `electron/services/backupService.ts`
- `electron/handlers/backupHandlers.ts`
- `electron/services/__tests__/backupService.test.ts`

## Files to Modify

- `electron/preload.ts` - Add backup API
- `electron/main.ts` - Register backup handlers
- `src/types/electron.d.ts` - Add backup types

## Dos

- ✅ **Research domain filtering FIRST** before implementing
- ✅ Document all findings in `docs/BACKUP_RESEARCH.md`
- ✅ Implement the smallest possible backup
- ✅ Support incremental backups (keep previous backup)
- ✅ Handle process cleanup on app quit
- ✅ Parse progress output to provide user feedback
- ✅ Log all backup operations including size and duration
- ✅ Allow cancellation mid-backup

## Don'ts

- ❌ **DO NOT implement full backup without domain filtering research**
- ❌ Don't run multiple backups simultaneously
- ❌ Don't leave orphaned backup processes on app crash
- ❌ Don't store backups in user-visible locations
- ❌ Don't expose raw CLI output to renderer
- ❌ Don't delete backups immediately (keep for incremental)

## Success Criteria

| Metric | Target | Unacceptable |
|--------|--------|--------------|
| First sync time | < 10 min | > 30 min |
| First sync size | < 5 GB | > 20 GB |
| Subsequent sync time | < 3 min | > 10 min |
| Subsequent sync size | < 500 MB | > 5 GB |

## Testing Instructions

1. **Research phase:** Document findings before coding
2. Mock idevicebackup2 CLI for unit tests
3. Test with real iPhone - measure actual backup size and time
4. Test incremental backup (second sync should be faster)
5. Test cancellation mid-backup
6. Test error handling (device disconnected, permission denied)

## Fallback Plan

If domain filtering is NOT possible with idevicebackup2:

1. Document the limitation
2. Implement full backup with clear UX messaging:
   - "First sync may take 30-60 minutes"
   - "Subsequent syncs will be much faster"
3. Prioritize incremental backups to minimize pain after first sync
4. Consider alternative tools (pymobiledevice3) as future enhancement

## PR Preparation Checklist

Before completing, ensure:

- [ ] Research documented in `docs/BACKUP_RESEARCH.md`
- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added with good coverage
- [ ] Backup size and time logged for review
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Research Findings
```
[SUMMARIZE YOUR DOMAIN FILTERING RESEARCH]
- Does idevicebackup2 support domain filtering? Yes/No
- What approach did you use?
- Expected backup size:
- Expected backup time:
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
- First sync size:
- First sync time:
- Incremental sync size:
- Incremental sync time:
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
