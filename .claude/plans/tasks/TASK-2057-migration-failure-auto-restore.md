# Task TASK-2057: Migration Failure Auto-Restore

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

When a database migration fails during app startup, auto-restore the pre-migration backup, re-open the database on the old schema, show a user-facing dialog explaining what happened, and report the failure to Sentry -- so the user is never left with an unbootable app.

## Non-Goals

- Do NOT implement safe mode / reduced functionality mode.
- Do NOT implement resume-from-partial-migration capability.
- Do NOT change the migration framework or versioned migration system.
- Do NOT add new migrations in this task.
- Do NOT implement cloud backup or cloud-assisted recovery.
- Do NOT modify the backup retention policy (already keeps last 3).
- Do NOT change the encryption scheme or key management.

## Prerequisites

**Sprint:** SPRINT-095
**Parallel with:** TASK-2055 (sync dismiss), TASK-2056 (offline blocking) -- no shared files.
**Blocks:** Nothing.

## Context

The app already has:
1. **Pre-migration backup** -- `runMigrations()` in `databaseService.ts` (line 326-344) creates a timestamped backup copy before running migrations.
2. **Transaction rollback per migration** -- Each versioned migration runs inside a transaction.
3. **Error logging + Sentry** -- Migration failures are logged and sent to Sentry (lines 354-360).
4. **Backup retention** -- Keeps last 3 backups, deletes older ones (lines 363-381).
5. **sqliteBackupService.ts** -- Created in SPRINT-094 (TASK-2052) for user-facing backup/restore. Can be leveraged for integrity verification.

What is MISSING:
- **Auto-restore on failure** -- The backup exists but is never used when migration fails. The `catch` block at line 353 logs the error and re-throws, crashing the app.
- **User notification** -- No `dialog.showMessageBox` call to explain what happened.
- **Backup integrity verification** -- No check that the backup file is a valid SQLite database before trusting it as a fallback.

## Requirements

### Must Do:

1. **Wrap `runMigrations()` call in try/catch** -- In `initializeDatabase()` (around line 150), catch migration failures.

2. **Verify backup integrity** -- Before restoring, open the backup file and run `PRAGMA integrity_check` to confirm it is a valid SQLite database. If backup is corrupt, do NOT restore -- fall through to error dialog.

3. **Auto-restore backup** -- If migration fails and backup is verified:
   - Close the current (corrupted) database connection
   - Copy the backup file over the main database file
   - Re-open the database connection
   - Log the restore action

4. **Show user dialog** -- Use Electron's `dialog.showMessageBox` to inform the user:
   - **If restore succeeded:** "A database update failed, but your data has been restored to the previous version. The app will continue with your existing data. Please contact support if this happens again."
   - **If restore failed (no valid backup):** "A database update failed and could not be automatically fixed. Please contact support. Your data may need manual recovery." Then allow the app to continue if possible (do not force-quit).

5. **Sentry capture** -- Send the migration error to Sentry with tags:
   - `migration_failure: true`
   - `auto_restore: succeeded | failed | no_backup`
   - `backup_integrity: valid | corrupt | missing`

6. **Handle "no backup exists" edge case** -- First-run installations have no backup. If migration fails on first run, show the error dialog but do not attempt restore (there is nothing to restore).

### Must NOT Do:

- Force-quit the app after showing dialog (let user continue if possible)
- Modify existing migration SQL files
- Change backup retention policy
- Add new IPC channels (this is all main-process logic)

## Acceptance Criteria

- [ ] Migration failure triggers auto-restore from most recent backup
- [ ] Backup integrity is verified (PRAGMA integrity_check) before restore
- [ ] User sees a dialog explaining what happened (restore success or failure)
- [ ] Sentry receives the migration error with auto_restore tags
- [ ] App continues running on restored (old-schema) database after successful restore
- [ ] First-run with no backup: migration failure shows error dialog, no crash
- [ ] Corrupt backup: migration failure shows error dialog, does not attempt restore from corrupt file
- [ ] No regression in normal migration flow (happy path unchanged)
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Modify

| File | Changes |
|------|---------|
| `electron/services/databaseService.ts` | Wrap `runMigrations()` in `initializeDatabase()` with try/catch, add auto-restore logic, add user dialog |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/sqliteBackupService.ts` | Reference for backup file handling patterns and integrity checks |
| `electron/services/__tests__/sqliteBackupService.test.ts` | Test patterns for backup operations |

## Implementation Notes

### Auto-restore flow in initializeDatabase()

```typescript
// In initializeDatabase(), around line 150:
try {
  await this.runMigrations();
} catch (migrationError) {
  // Migration failed -- attempt auto-restore
  const restored = await this._attemptAutoRestore(migrationError);

  if (restored) {
    // Show success dialog (non-blocking)
    dialog.showMessageBox({
      type: 'warning',
      title: 'Database Update Notice',
      message: 'A database update failed, but your data has been restored.',
      detail: 'The app will continue with your existing data. Please contact support if this happens again.',
      buttons: ['OK'],
    });
  } else {
    // Show failure dialog
    dialog.showMessageBox({
      type: 'error',
      title: 'Database Update Failed',
      message: 'A database update failed and could not be automatically fixed.',
      detail: 'Please contact support. Your data may need manual recovery.',
      buttons: ['OK'],
    });
  }
}
```

### Backup integrity check

```typescript
private _verifyBackupIntegrity(backupPath: string): boolean {
  try {
    const testDb = new Database(backupPath, { /* same encryption options */ });
    const result = testDb.pragma('integrity_check');
    testDb.close();
    return result[0]?.integrity_check === 'ok';
  } catch {
    return false;
  }
}
```

### Finding the most recent backup

The backup naming convention is `mad-backup-YYYYMMDDTHHMMSS.db`. To find the most recent:

```typescript
const backupFiles = fs.readdirSync(dbDir)
  .filter(f => f.startsWith(`${dbName}-backup-`) && f.endsWith('.db'))
  .sort()
  .reverse(); // newest first
const latestBackup = backupFiles[0];
```

This pattern already exists in `runMigrations()` for retention cleanup (lines 366-371).

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  1. Test auto-restore is triggered when `runMigrations()` throws
  2. Test backup integrity check rejects corrupt files
  3. Test that dialog is shown after restore (mock `dialog.showMessageBox`)
  4. Test Sentry capture includes correct tags
  5. Test no-backup scenario (first run): dialog shown, no crash
  6. Test normal migration path is unchanged (happy path)

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** service
- **Multiplier:** x 0.5
- **Base estimate:** ~50K tokens
- **Adjusted estimate:** ~25K tokens
- **SR overhead:** +15K
- **Final estimate:** ~40K tokens (rounding up for safety -- migration code is sensitive)
- **Token Cap:** 160K (4x of 40K)

## PR Preparation

- **Title:** `fix(database): auto-restore backup on migration failure`
- **Branch:** `fix/task-2057-migration-auto-restore`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 40K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `initializeDatabase()` flow is more complex than expected (e.g., encryption key recovery after restore)
- Backup files use a different encryption key than the current database
- `dialog.showMessageBox` is not available in the context where `initializeDatabase` runs (e.g., before `app.whenReady()`)
- You need to add new IPC channels for any reason
- Existing tests fail in ways unrelated to this change
- You encounter blockers not covered in the task file
