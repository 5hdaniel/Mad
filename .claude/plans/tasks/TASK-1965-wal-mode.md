# Task TASK-1965: Enable SQLite WAL Mode

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

Enable WAL (Write-Ahead Logging) journal mode and NORMAL synchronous mode on the SQLite database to improve concurrent read/write performance as user count scales.

## Non-Goals

- Do NOT add WAL checkpoint scheduling (manual checkpoint before backup is sufficient)
- Do NOT modify the encryption/cipher configuration
- Do NOT change the database file location or naming

## Deliverables

1. Update: `electron/services/db/core/dbConnection.ts` (lines 80-111, `openDatabase()`) — add WAL and synchronous PRAGMAs after cipher integrity check

## Acceptance Criteria

- [ ] `PRAGMA journal_mode = WAL` is set after database open
- [ ] `PRAGMA synchronous = NORMAL` is set after database open
- [ ] Return value of `pragma("journal_mode = WAL")` is checked — if it returns `delete` instead of `wal`, log a warning (SQLCipher may not support WAL)
- [ ] Query `PRAGMA journal_mode` after setting confirms `wal`
- [ ] `-wal` and `-shm` sidecar files are created alongside the database file
- [ ] All existing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Change Location

In `electron/services/db/core/dbConnection.ts`, in the `openDatabase()` function (lines 80-111), add after the cipher integrity check:

```typescript
// Enable WAL mode for better concurrent read/write performance
const journalMode = database.pragma("journal_mode = WAL");
if (journalMode?.[0]?.journal_mode !== 'wal') {
  console.warn('[DB] WAL mode not enabled, journal_mode returned:', journalMode);
}

// NORMAL synchronous is safe with WAL (data is still durable, just not as paranoid)
database.pragma("synchronous = NORMAL");
```

### Important Details

- **SQLCipher compatibility:** Some SQLCipher builds don't support WAL. The pragma silently returns `delete` instead of `wal`. Check the return value.
- **Sidecar files:** WAL creates `-wal` and `-shm` files next to the database. Any backup logic MUST checkpoint first: `PRAGMA wal_checkpoint(TRUNCATE)`
- **TASK-1969 (Migration Backup)** will need to checkpoint before backup — note this in integration notes

### PRAGMA Order

PRAGMAs should be set in this order (after cipher key):
1. `cipher_compatibility` (existing)
2. `cipher_integrity_check` (existing)
3. `journal_mode = WAL` (new)
4. `synchronous = NORMAL` (new)

## Integration Notes

- TASK-1969 (Pre-Migration Database Backup) must run `PRAGMA wal_checkpoint(TRUNCATE)` before copying the database file
- No other tasks in 080B touch this file
- The `-wal` and `-shm` files should NOT be included in any file sync or backup — they are transient

## Do / Don't

### Do:
- Check the return value of the WAL pragma
- Log a warning if WAL is not enabled (don't throw — app should still work in DELETE mode)
- Place PRAGMAs in the correct order after cipher setup

### Don't:
- Do NOT change the synchronous mode to OFF (NORMAL is the right balance)
- Do NOT add WAL checkpoint logic here (that belongs in backup code)
- Do NOT modify the cipher PRAGMAs

## When to Stop and Ask

- If SQLCipher version in use doesn't support WAL (returns `delete`)
- If enabling WAL causes any test failures
- If the `openDatabase()` function structure has changed significantly

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes — verify WAL mode is set (or add assertion in existing DB tests)
- Existing tests to verify: Run `npm test` to ensure no regressions

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(db): enable SQLite WAL mode for improved concurrency`
- **Labels:** `feature`, `database`
- **Depends on:** None

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
- [ ] electron/services/db/core/dbConnection.ts

Features implemented:
- [ ] WAL journal mode enabled
- [ ] NORMAL synchronous mode enabled
- [ ] Return value check with warning fallback

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] PRAGMA journal_mode returns 'wal'
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
