# Task TASK-1969: Pre-Migration Database Backup

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add an automatic backup step in `runMigrations()` before executing any schema changes, so users can recover if a migration fails.

## Non-Goals

- Do NOT add backup rotation or cleanup (single backup per migration run is sufficient)
- Do NOT add backup verification/restore UI
- Do NOT back up before every database open (only before migrations)
- Do NOT add scheduled backups

## Deliverables

1. Update: `electron/services/databaseService.ts` (lines 287-301, `runMigrations()`) — add backup step before schema execution

## Acceptance Criteria

- [ ] Backup file created before any migration SQL executes
- [ ] Backup file named with timestamp (e.g., `mad-backup-20260211T120000.db`)
- [ ] If WAL mode is enabled (TASK-1965), `PRAGMA wal_checkpoint(TRUNCATE)` runs before backup
- [ ] Backup file is valid (openable with same encryption key)
- [ ] Backup location: same directory as main database file
- [ ] All CI checks pass

## Implementation Notes

### Pattern Reference

Follow the existing encryption migration backup pattern at `databaseService.ts:187-190`:

```typescript
// Existing pattern (lines 187-190):
const backupPath = dbPath.replace('.db', `-backup-${Date.now()}.db`);
fs.copyFileSync(dbPath, backupPath);
```

### Implementation

In `runMigrations()` (lines 287-301), add before the migration loop:

```typescript
async function runMigrations(database: Database.Database, dbPath: string): Promise<void> {
  const pendingMigrations = getPendingMigrations(database);

  if (pendingMigrations.length === 0) return;

  // Backup before running migrations
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const backupPath = dbPath.replace('.db', `-backup-${timestamp}.db`);

  // Checkpoint WAL if enabled (ensures all data is in main file before copy)
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // WAL may not be enabled — safe to ignore
  }

  fs.copyFileSync(dbPath, backupPath);
  console.log(`[DB] Pre-migration backup created: ${backupPath}`);

  // ... existing migration logic
}
```

### Important Details

- **WAL checkpoint:** If TASK-1965 (WAL mode) is merged, the `-wal` file contains uncommitted data. `PRAGMA wal_checkpoint(TRUNCATE)` flushes everything to the main database file before copying.
- **If WAL is not enabled:** The checkpoint pragma is a no-op — wrap in try/catch.
- **Single backup:** Overwrites any previous backup for this migration run. No rotation needed for now.
- **Encryption:** `fs.copyFileSync` copies the encrypted file as-is — the backup is automatically encrypted with the same key.

## Integration Notes

- If TASK-1965 (WAL Mode) is merged first, WAL checkpoint is important
- If TASK-1965 is NOT merged, the try/catch around the checkpoint handles this gracefully
- Independent of other 080C tasks

## Do / Don't

### Do:
- Run WAL checkpoint before copy (with try/catch fallback)
- Log the backup path for debugging
- Only backup when there are pending migrations (skip if no migrations needed)

### Don't:
- Do NOT add backup cleanup/rotation
- Do NOT copy `-wal` and `-shm` files (they're transient)
- Do NOT add a backup verification step (trust the file copy)

## When to Stop and Ask

- If `runMigrations()` has been significantly refactored
- If the database path is not easily accessible in the migration function
- If the backup directory doesn't have write permissions

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes — verify backup file is created when migrations exist
- Existing tests: Check if migration tests exist in the test suite

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(db): add pre-migration database backup`
- **Labels:** `feature`, `database`
- **Depends on:** None (WAL checkpoint is best-effort)

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~15K
**Token Cap:** 60K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/services/databaseService.ts (backup in runMigrations)

Features implemented:
- [ ] Pre-migration backup with timestamp
- [ ] WAL checkpoint before copy (try/catch)
- [ ] Skip backup when no pending migrations

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Backup file created during migration
- [ ] Backup file is valid (openable)
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>
- Test coverage: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
