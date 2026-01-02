# TASK-908: iPhone Sync Skip Unchanged Backups

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-090
**Priority:** HIGH
**Category:** service
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 3-4 turns, ~15K tokens, 15-20 min

---

## Goal

Skip re-parsing iPhone backups that haven't changed since the last successful sync.

## Non-Goals

- Do NOT modify email sync logic
- Do NOT change backup parsing implementation
- Do NOT modify message deduplication (handled by external_id)

---

## Current State

The `useIPhoneSync` hook and `syncOrchestrator` already track `lastSyncTime` in memory, but this isn't persisted or used to skip unchanged backups.

---

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/services/syncOrchestrator.ts` | Add backup change detection |
| `electron/services/backupService.ts` | Expose backup metadata (modification time) |

---

## Implementation Notes

### Backup Change Detection

```typescript
// In backupService.ts - add method to get backup metadata

async getBackupMetadata(backupPath: string): Promise<{
  modifiedAt: Date;
  manifestHash: string;
} | null> {
  try {
    const manifestPath = path.join(backupPath, 'Manifest.db');
    const stats = await fs.stat(manifestPath);

    // Also compute hash for more reliable change detection
    const manifestContent = await fs.readFile(manifestPath);
    const hash = crypto.createHash('sha256').update(manifestContent).digest('hex');

    return {
      modifiedAt: stats.mtime,
      manifestHash: hash,
    };
  } catch (error) {
    console.error('[Backup] Failed to get metadata:', error);
    return null;
  }
}
```

### Skip Logic in Orchestrator

```typescript
// In syncOrchestrator.ts

interface LastBackupSync {
  backupPath: string;
  manifestHash: string;
  syncedAt: Date;
}

// Store in user preferences or a dedicated table
private lastBackupSync: LastBackupSync | null = null;

async shouldProcessBackup(backupPath: string): Promise<boolean> {
  const metadata = await backupService.getBackupMetadata(backupPath);
  if (!metadata) return true; // Can't determine, process anyway

  if (
    this.lastBackupSync &&
    this.lastBackupSync.backupPath === backupPath &&
    this.lastBackupSync.manifestHash === metadata.manifestHash
  ) {
    console.log('[Sync] Backup unchanged since last sync, skipping re-parse');
    return false;
  }

  return true;
}

async recordBackupSync(backupPath: string, manifestHash: string): Promise<void> {
  this.lastBackupSync = {
    backupPath,
    manifestHash,
    syncedAt: new Date(),
  };
  // TODO: Persist to preferences/database for cross-session retention
}
```

### Integration

```typescript
// In the sync flow

async syncIPhoneBackup(backupPath: string) {
  const shouldProcess = await this.shouldProcessBackup(backupPath);

  if (!shouldProcess) {
    console.log('[Sync] Skipping unchanged backup');
    return { skipped: true, reason: 'unchanged' };
  }

  // ... existing parse and sync logic ...

  const metadata = await backupService.getBackupMetadata(backupPath);
  if (metadata) {
    await this.recordBackupSync(backupPath, metadata.manifestHash);
  }
}
```

---

## Acceptance Criteria

- [ ] `getBackupMetadata()` returns modification time and hash
- [ ] `shouldProcessBackup()` returns false if backup unchanged
- [ ] Skip decision logged for debugging
- [ ] First sync always processes (no prior state)
- [ ] Force-resync option available (bypass skip)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use SHA-256 hash of Manifest.db for reliable change detection
- Log skip decisions for debugging
- Handle missing/corrupted backup gracefully
- Provide force-resync escape hatch

### Don't
- Skip based on mtime alone (can be unreliable)
- Modify backup parsing logic
- Remove existing external_id deduplication

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Backup structure is different than expected
- Need persistent storage for cross-session skip
- Force-resync UI needed

---

## Testing Expectations

- Unit test `getBackupMetadata()` with mock filesystem
- Unit test `shouldProcessBackup()` with various states
- Integration test: second sync skips unchanged backup
- Manual verification: modify backup, verify re-sync triggers

---

## PR Preparation

**Branch:** `feature/TASK-908-iphone-skip-unchanged`
**Title:** `feat(sync): skip unchanged iPhone backups`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-906, TASK-907)
- **Depends On:** None
- **Blocks:** TASK-911
