# Task TASK-1803: Windows iPhone Backup Call Log Parser

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

Add call history extraction to the existing Windows iPhone backup sync flow, parsing CallHistory.storedata from iPhone backups and storing call logs in the database.

## Non-Goals

- Do NOT implement macOS import (TASK-1801)
- Do NOT implement standalone IPC handlers (integrate with existing sync flow)
- Do NOT implement UI components (TASK-1805)
- Do NOT handle FaceTime calls
- Do NOT handle unencrypted backup differently from encrypted (same file structure)

## Deliverables

1. New file: `electron/services/iphoneCallLogParser.ts`
2. Update: `electron/sync-handlers.ts` - Add call log extraction to sync flow
3. Update: `src/types/iphone.ts` - Add call log types to sync result

## Acceptance Criteria

- [ ] Parser extracts CallHistory.storedata from iPhone backup manifest
- [ ] Parser reads ZCALLRECORD table from extracted database
- [ ] Parses Core Data timestamps correctly (same as macOS)
- [ ] Maps call types to direction enum
- [ ] Normalizes phone numbers before storage
- [ ] Links calls to contacts by phone number
- [ ] Integrated into existing Windows sync flow
- [ ] Sync result includes call log counts
- [ ] Handles missing CallHistory.storedata gracefully (not all backups have it)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### iPhone Backup Structure

iPhone backups store files using a manifest database with hashed filenames:
- Manifest location: `Manifest.db` (or `Manifest.mbdb` for older backups)
- Files are stored with SHA-1 hash of domain + path as filename

CallHistory.storedata location in backup:
- Domain: `HomeDomain`
- Path: `Library/CallHistoryDB/CallHistory.storedata`
- File hash: `SHA1("HomeDomain-Library/CallHistoryDB/CallHistory.storedata")`

### Finding CallHistory.storedata

```typescript
import crypto from 'crypto';

/**
 * Calculate the backup file hash for CallHistory.storedata
 */
function getCallHistoryFileHash(): string {
  const domain = 'HomeDomain';
  const relativePath = 'Library/CallHistoryDB/CallHistory.storedata';
  const fullPath = `${domain}-${relativePath}`;
  return crypto.createHash('sha1').update(fullPath).digest('hex');
}

/**
 * Find CallHistory.storedata in backup using manifest
 */
async function findCallHistoryInBackup(
  manifestDb: Database,
  backupPath: string
): Promise<string | null> {
  // Query manifest for the file
  const fileHash = getCallHistoryFileHash();
  const row = manifestDb.prepare(
    'SELECT fileID FROM Files WHERE domain = ? AND relativePath = ?'
  ).get('HomeDomain', 'Library/CallHistoryDB/CallHistory.storedata');

  if (row) {
    const filePath = path.join(backupPath, row.fileID.substring(0, 2), row.fileID);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}
```

### Parser Structure

```typescript
// electron/services/iphoneCallLogParser.ts

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import databaseService from './databaseService';
import logService from './logService';
import type { CallLog, CallLogInput, CallDirection } from '../types/callLog';

/**
 * Result of parsing call logs from iPhone backup
 */
export interface CallLogParseResult {
  success: boolean;
  calls: CallLogInput[];
  error?: string;
}

/**
 * Parse call history from iPhone backup CallHistory.storedata
 */
export async function parseCallHistory(
  callHistoryDbPath: string,
  userId: string
): Promise<CallLogParseResult> {
  // 1. Open the SQLite database
  // 2. Query ZCALLRECORD table
  // 3. Map records to CallLogInput
  // 4. Return parsed calls
}

/**
 * Extract and import call logs from iPhone backup
 */
export async function extractAndImportCallLogs(
  backupPath: string,
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{
  callsImported: number;
  callsSkipped: number;
  callsLinked: number;
}> {
  // 1. Find CallHistory.storedata in backup
  // 2. Parse call records
  // 3. Insert into call_logs table
  // 4. Return counts
}
```

### Integration with Sync Flow

In `electron/sync-handlers.ts`, the existing sync flow handles messages and contacts. Add call log extraction:

```typescript
// In the sync completion handler:

// After messages are extracted, also extract call logs
try {
  const callLogResult = await extractAndImportCallLogs(
    backupPath,
    userId,
    (current, total) => {
      // Update progress for call log phase
      mainWindow.webContents.send('sync:progress', {
        phase: 'calls',
        phaseProgress: Math.round((current / total) * 100),
        overallProgress: 80 + Math.round((current / total) * 10), // 80-90% for calls
        message: `Importing call logs: ${current}/${total}`,
      });
    }
  );
  logService.info('Call logs imported', 'SyncHandlers', callLogResult);
} catch (callError) {
  logService.warn('Call log import failed (non-fatal)', 'SyncHandlers', {
    error: callError instanceof Error ? callError.message : 'Unknown error',
  });
  // Don't fail the entire sync for call log issues
}
```

### Sync Result Update

Update the sync result type to include call counts:

```typescript
// In src/types/iphone.ts

export interface BackupResult {
  success: boolean;
  error?: string;
  messagesCount?: number;
  contactsCount?: number;
  callsCount?: number;  // Add this
}
```

## Integration Notes

- Imports from: `electron/types/callLog.ts` (TASK-1800)
- Integrates with: `electron/sync-handlers.ts` (existing Windows sync flow)
- Used by: TASK-1807 (sync integration)
- Depends on: TASK-1800 (schema must exist)
- Pattern follows: Existing backup parsing in sync-handlers.ts

## Do / Don't

### Do:

- Follow existing backup parsing patterns
- Handle missing CallHistory.storedata gracefully (older backups may not have it)
- Use same timestamp conversion as macOS (Core Data format)
- Log warnings but don't fail sync for call log issues
- Reuse phone normalization logic from TASK-1801

### Don't:

- Don't fail the entire sync if call logs can't be extracted
- Don't assume CallHistory.storedata always exists
- Don't duplicate timestamp conversion code (share with macOS service)
- Don't skip encrypted backup handling

## When to Stop and Ask

- If backup manifest structure differs from expected
- If sync-handlers.ts patterns are unclear
- If CallHistory.storedata location varies between iOS versions
- If encrypted backup handling needs clarification

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `iphoneCallLogParser.test.ts`
  - Test ZCALLRECORD parsing
  - Test timestamp conversion
  - Test missing file handling
  - Test integration with sync flow (mocked)
- Existing tests to update:
  - Sync handler tests - add call log assertions

### Coverage

- Coverage impact: New parser should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Extract calls from valid iPhone backup
  - Handle missing CallHistory.storedata
  - Handle encrypted backup
  - Calls appear in database after sync

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(calls): add iPhone backup call log parser`
- **Labels**: `feature`, `windows`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new parser file | +10K |
| Files to modify | 2 files (sync-handlers, types) | +5K |
| Code volume | ~300 lines parser + integration | +5K |
| Test complexity | Medium - mocked backup | +5K |

**Confidence:** Medium

**Risk factors:**
- Backup manifest structure complexity
- iOS version differences

**Similar past tasks:** Service tasks use x0.5 multiplier, but backup parsing is complex.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/services/iphoneCallLogParser.ts
- [ ] electron/services/__tests__/iphoneCallLogParser.test.ts

Files modified:
- [ ] electron/sync-handlers.ts
- [ ] src/types/iphone.ts

Features implemented:
- [ ] CallHistory.storedata extraction
- [ ] ZCALLRECORD parsing
- [ ] Sync flow integration
- [ ] Progress reporting

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
