# Task TASK-2052: SQLite Backup/Restore

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add the ability for users to backup and restore their local SQLite database (`mad.db`). This provides data safety -- users can create backups before risky operations, and restore from backups if data is lost or corrupted.

## Non-Goals

- Do NOT implement cloud backup (to Supabase or any cloud storage).
- Do NOT implement automatic/scheduled backups.
- Do NOT implement incremental backups (full database copy only).
- Do NOT modify the encryption scheme or key management.
- Do NOT add backup rotation or retention policies.
- Do NOT implement database migration between versions via backup/restore.

## Prerequisites

**Depends on:** TASK-2051 (app:// protocol migration) must be merged first.

**Sprint:** SPRINT-094

**Parallel with:** TASK-2053 (CCPA data export) -- these can run simultaneously.

**Shared files with TASK-2053:** Both modify `electron/handlers/index.ts`, `electron/preload/index.ts`, `src/window.d.ts`, and `src/components/Settings.tsx`. However, they add independent handler registrations, bridge functions, and UI sections. SR Engineer should review for merge conflicts.

## Deliverables

1. **Create:** `electron/services/sqliteBackupService.ts` -- Backup and restore logic
2. **Create:** `electron/handlers/backupRestoreHandlers.ts` -- IPC handlers for backup/restore operations
3. **Update:** `electron/handlers/index.ts` -- Register new backup/restore handlers
4. **Update:** `electron/preload/systemBridge.ts` -- Add backup/restore IPC channels (or create new `backupBridge.ts`)
5. **Update:** `electron/preload/index.ts` -- Expose backup API
6. **Update:** `src/window.d.ts` -- Add backup/restore API type definitions
7. **Update:** `src/components/Settings.tsx` -- Add "Backup & Restore" UI section
8. **Create:** Unit tests for `sqliteBackupService.ts`

## Acceptance Criteria

- [ ] "Backup Database" button in Settings opens a save dialog and creates a backup file
- [ ] "Restore Database" button in Settings opens an open dialog, shows confirmation, and restores from backup
- [ ] Backup file is a valid encrypted SQLite database (same encryption as original)
- [ ] Backup includes all tables and data (full database copy)
- [ ] Restore operation closes the current database, replaces it, and reopens
- [ ] Restore from a corrupted/invalid file shows an error (does not break the app)
- [ ] Restore from a file encrypted with a different key shows an error
- [ ] UI shows success/failure feedback after backup and restore operations
- [ ] App functions normally after a restore (no restart required, or app restarts cleanly)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Database Architecture Context

The database file is at `app.getPath('userData')/mad.db`. It is encrypted with SQLCipher (AES-256). The encryption key is retrieved from OS keychain via `databaseEncryptionService.getEncryptionKey()`.

Key services:
- `electron/services/databaseService.ts` -- Facade layer, initialization, provides `getRawDatabase()`
- `electron/services/databaseEncryptionService.ts` -- Manages encryption key via safeStorage
- `electron/services/db/core/dbConnection.ts` -- Shared db connection module

### Backup Approach

Use `better-sqlite3`'s `.backup()` method (which wraps SQLite's Online Backup API). This is safe to call even while the database is open -- SQLite handles locking internally.

```typescript
import type { Database as DatabaseType } from 'better-sqlite3';

export class SqliteBackupService {
  /**
   * Create a backup of the database to the specified path.
   * Uses SQLite's backup API which is safe for concurrent access.
   */
  async backup(db: DatabaseType, destinationPath: string): Promise<void> {
    await db.backup(destinationPath);
  }

  /**
   * Restore a database from a backup file.
   * 1. Verify the backup file is a valid encrypted SQLite database
   * 2. Close the current database connection
   * 3. Copy backup file over the current database
   * 4. Reopen the database connection
   */
  async restore(backupPath: string): Promise<void> {
    // Implementation details in task
  }

  /**
   * Verify a backup file is a valid, decryptable SQLite database.
   */
  async verifyBackup(backupPath: string, encryptionKey: string): Promise<boolean> {
    // Open with encryption key, run pragma integrity_check
  }
}
```

### Restore Workflow

Restore is more complex than backup because it requires:
1. **Verify** the backup file exists and is a valid encrypted SQLite database
2. **Close** the current database connection (`databaseService.close()` or equivalent)
3. **Create safety copy** of the current database (in case restore fails)
4. **Copy** the backup file to the database path (`mad.db`)
5. **Reopen** the database connection
6. **Run migrations** if the backup is from an older version
7. If any step fails, restore the safety copy

### IPC Channels

```typescript
// electron/handlers/backupRestoreHandlers.ts
ipcMain.handle('db:backup', async () => {
  // Show save dialog
  // Call backup service
  // Return success/failure
});

ipcMain.handle('db:restore', async () => {
  // Show open dialog
  // Show confirmation dialog
  // Call restore service
  // Return success/failure + whether restart is needed
});

ipcMain.handle('db:get-backup-info', async () => {
  // Return database file size, last modified date
  // Useful for showing info in Settings UI
});
```

### UI Design (Settings.tsx)

Add a "Backup & Restore" section to the Settings page:

```
Data Management
-------------------------------------------------
Database Backup & Restore

Your database is encrypted and stored locally.
Backups can be used to recover data if something
goes wrong.

Database size: 42 MB
Last modified: Feb 22, 2026 3:45 PM

[Backup Database]     [Restore from Backup]

Note: Backups are encrypted with your machine's
keychain. They can only be restored on this machine.
-------------------------------------------------
```

### Key Files to Examine

- `electron/services/databaseService.ts` -- Database lifecycle (initialize, close, reopen)
- `electron/services/databaseEncryptionService.ts` -- Encryption key management
- `electron/services/db/core/dbConnection.ts` -- Shared db connection
- `electron/handlers/index.ts` -- Handler registration pattern
- `electron/preload/systemBridge.ts` -- Existing bridge pattern
- `src/components/Settings.tsx` -- Settings page layout

## Integration Notes

- Imports from: `electron/services/databaseService.ts` (for db lifecycle), `electron/services/databaseEncryptionService.ts` (for key verification)
- Exports to: UI via IPC bridge
- Used by: Settings page UI
- Depends on: TASK-2051 (merged first)

## Do / Don't

### Do:
- Use SQLite's backup API (`db.backup()`) for safe concurrent backup
- Verify backup integrity before restore (try opening with encryption key)
- Create a safety copy of the current database before restoring
- Show confirmation dialog before restore (destructive operation)
- Handle the case where the app needs to restart after restore
- Use `dialog.showSaveDialog` / `dialog.showOpenDialog` for file selection
- Default backup filename: `magic-audit-backup-YYYY-MM-DD.db`
- Filter file dialog to `.db` files

### Don't:
- Use raw file copy for backup (use SQLite backup API to handle write-ahead log)
- Allow restore without confirmation
- Leave the database in a broken state if restore fails
- Store backup paths or metadata in the database itself
- Expose the encryption key to the renderer process
- Allow backup to the same file as the active database

## When to Stop and Ask

- If `better-sqlite3-multiple-ciphers` does not support the `.backup()` method
- If closing and reopening the database requires an app restart (affects UX design)
- If the restore process cannot re-run migrations safely
- If the Settings.tsx is too complex to add a section without refactoring
- If you discover that the database file is locked by another process (worker thread)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test backup creates a valid file at destination path
  - Test backup file is a valid encrypted SQLite database
  - Test restore replaces current database with backup
  - Test restore fails gracefully for invalid/corrupted file
  - Test restore fails gracefully for wrong encryption key
  - Test verifyBackup returns true for valid backup, false for invalid
  - Test backup with default filename includes date
  - Test IPC handlers return correct success/failure responses

### Coverage

- Coverage impact: Must not decrease; new service should have meaningful coverage

### Integration / Feature Tests

- Required scenarios:
  - Backup button creates file at chosen location (manual test)
  - Restore from valid backup works (manual test)
  - Restore from invalid file shows error (manual test)
  - App functions normally after restore (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(data): add SQLite database backup and restore capability`
- **Labels**: `feature`, `data-safety`, `settings`
- **Depends on**: TASK-2051 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2-3 (service, handlers, possibly bridge) | +15K |
| Files to modify | 4-5 files (index.ts, bridge, window.d.ts, Settings.tsx) | +15K |
| Code volume | ~200-300 lines (service + handlers + UI section) | +10K |
| Test complexity | Medium (mock database, mock file system) | +10K |

**Confidence:** Medium-High

**Risk factors:**
- Database close/reopen lifecycle may be more complex than expected
- Worker thread may hold database lock during restore
- Settings.tsx modifications need careful placement

**Similar past tasks:** Service category x0.5 multiplier. Base estimate ~100K applied.

---

## Implementation Summary (Engineer-Owned)

*Completed 2026-02-22*

### Agent ID

```
Engineer Agent ID: agent-a7cb236e
```

### Checklist

```
Files created:
- [x] electron/services/sqliteBackupService.ts (backup, restore, verify, getDatabaseInfo)
- [x] electron/handlers/backupRestoreHandlers.ts (IPC handlers: db:backup, db:restore, db:get-backup-info)
- [x] electron/preload/databaseBackupBridge.ts (preload bridge for renderer)
- [x] electron/services/__tests__/sqliteBackupService.test.ts (23 unit tests)

Files modified:
- [x] electron/handlers/index.ts (export registerBackupRestoreHandlers)
- [x] electron/main.ts (import and register backup/restore handlers)
- [x] electron/preload/index.ts (export databaseBackupBridge)
- [x] electron/preload.ts (wire databaseBackup bridge to contextBridge)
- [x] electron/types/ipc.ts (add databaseBackup to WindowApi interface)
- [x] src/window.d.ts (add databaseBackup types to MainAPI)
- [x] src/components/Settings.tsx (add Backup & Restore UI section)

Features implemented:
- [x] Backup service with SQLite backup API (db.backup())
- [x] Restore service with integrity verification
- [x] IPC handlers registered (db:backup, db:restore, db:get-backup-info)
- [x] Preload bridge exposed (databaseBackupBridge - NOT backupBridge, which is iPhone)
- [x] Settings UI section added with backup/restore buttons and db info display
- [x] Error handling for corrupt/invalid backups (verifyBackup with cipher_integrity_check)
- [x] Confirmation dialog for restore (via dialog.showMessageBox)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (23/23 new tests pass; 2 pre-existing failures in transaction-handlers.integration.test.ts)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |
| Input Tokens | (auto-captured) |
| Output Tokens | (auto-captured) |
| Cache Read | (auto-captured) |
| Cache Create | (auto-captured) |

**Variance:** PM Est ~50K vs Actual (auto-captured)

### Notes

- Named the preload bridge `databaseBackupBridge` (not `backupBridge`) to avoid conflict with iPhone backup bridge in deviceBridge.ts
- Named the MainAPI key `databaseBackup` (not `backup`) to avoid conflict with iPhone backup API
- Had to add type definitions to BOTH `src/window.d.ts` (MainAPI interface) AND `electron/types/ipc.ts` (WindowApi interface) because TypeScript resolves window.api through the WindowApi type
- Backup uses SQLite's built-in backup API (db.backup()) which is safe for concurrent access
- Restore workflow: verify backup -> close DB -> safety copy -> replace file -> remove WAL/SHM -> reinitialize -> cleanup safety copy
- Safety copy rollback on restore failure ensures the app never ends up with a broken database
- Default backup filename: `magic-audit-backup-YYYY-MM-DD.db`
- UI placed in Data & Privacy section of Settings, between Reindex Database and Clear All Data

### Issues/Blockers

**Issue #1: WindowApi type in ipc.ts**
- **When:** During type-check
- **What happened:** TypeScript errors on `window.api.databaseBackup` -- the actual type used is `WindowApi` from `electron/types/ipc.ts`, not `MainAPI` from `src/window.d.ts`
- **Resolution:** Added `databaseBackup` type definition to both `WindowApi` and `MainAPI` interfaces
- **Time spent:** ~3 minutes

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | (auto-captured) | (auto-calculated) |
| Duration | - | (auto-captured) | - |

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
