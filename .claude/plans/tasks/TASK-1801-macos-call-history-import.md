# Task TASK-1801: macOS Call History Import Service

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

Create a service to import call history from macOS CallHistoryDB (~/Library/Application Support/CallHistoryDB/CallHistory.storedata) into the app's database, following existing patterns from macOSMessagesImportService.

## Non-Goals

- Do NOT implement Windows import (TASK-1803)
- Do NOT implement IPC handlers (TASK-1802)
- Do NOT implement UI components (TASK-1805)
- Do NOT handle FaceTime calls (VoIP) - only cellular calls
- Do NOT import call recordings (not accessible)

## Deliverables

1. New file: `electron/services/macOSCallHistoryImportService.ts`
2. Update: `electron/services/index.ts` - Export new service

## Acceptance Criteria

- [ ] Service reads from `~/Library/Application Support/CallHistoryDB/CallHistory.storedata`
- [ ] Checks Full Disk Access permission before attempting read
- [ ] Parses Core Data SQLite format (ZCALLRECORD table)
- [ ] Converts Core Data timestamps (seconds since 2001-01-01) to ISO 8601
- [ ] Correctly maps call types: 1=outgoing, 4=incoming, 16=missed
- [ ] Deduplicates using external_id (Z_PK from source)
- [ ] Normalizes phone numbers before storage
- [ ] Links calls to existing contacts by phone number
- [ ] Supports progress callback for UI updates
- [ ] Handles permission denied gracefully
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### macOS CallHistory.storedata Structure

The CallHistory.storedata file is a Core Data SQLite database located at:
```
~/Library/Application Support/CallHistoryDB/CallHistory.storedata
```

**Requires Full Disk Access** permission (same as Messages app access).

### ZCALLRECORD Table Schema

```sql
-- Key fields in ZCALLRECORD
Z_PK              INTEGER   -- Primary key (use as external_id)
ZADDRESS          TEXT      -- Phone number or caller ID
ZCALLTYPE         INTEGER   -- Call type indicator (see mapping below)
ZDURATION         REAL      -- Duration in seconds
ZDATE             REAL      -- Core Data timestamp
ZORIGINATED       INTEGER   -- 1=outgoing call
ZANSWERED         INTEGER   -- 1=call was answered
ZREAD             INTEGER   -- 1=call has been viewed
```

### Call Type Mapping

```typescript
function mapCallType(callType: number, originated: number, answered: number): CallDirection {
  // Missed call
  if (callType === 16 || (originated === 0 && answered === 0)) {
    return 'missed';
  }
  // Outgoing call
  if (originated === 1 || callType === 1) {
    return 'outgoing';
  }
  // Incoming call
  return 'incoming';
}
```

### Core Data Timestamp Conversion

Core Data uses seconds since 2001-01-01 00:00:00 UTC:

```typescript
const CORE_DATA_EPOCH = new Date('2001-01-01T00:00:00Z').getTime();

function coreDataTimestampToISO(timestamp: number): string {
  const ms = CORE_DATA_EPOCH + (timestamp * 1000);
  return new Date(ms).toISOString();
}
```

### Service Pattern (Follow macOSMessagesImportService)

```typescript
// electron/services/macOSCallHistoryImportService.ts

import path from 'path';
import os from 'os';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import databaseService from './databaseService';
import permissionService from './permissionService';
import logService from './logService';
import type { CallLog, CallLogInput, CallDirection } from '../types/callLog';

/**
 * Result of importing macOS call history
 */
export interface MacOSCallImportResult {
  success: boolean;
  callsImported: number;
  callsSkipped: number;
  callsLinked: number;  // Linked to contacts
  duration: number;
  error?: string;
}

/**
 * Progress callback for import operations
 */
export type CallImportProgressCallback = (progress: {
  phase: 'checking' | 'querying' | 'importing';
  current: number;
  total: number;
  percent: number;
}) => void;

const CALL_HISTORY_DB_PATH = path.join(
  os.homedir(),
  'Library/Application Support/CallHistoryDB/CallHistory.storedata'
);

const macOSCallHistoryImportService = {
  /**
   * Import call history from macOS CallHistoryDB
   */
  async importCallHistory(
    userId: string,
    onProgress?: CallImportProgressCallback,
    forceReimport = false
  ): Promise<MacOSCallImportResult> {
    // 1. Check Full Disk Access permission
    // 2. Open CallHistory.storedata SQLite database
    // 3. Query ZCALLRECORD table
    // 4. Convert and deduplicate records
    // 5. Link to contacts by phone number
    // 6. Insert into call_logs table
    // 7. Return result
  },

  /**
   * Check if call history import is available
   */
  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    // Check Full Disk Access
    // Check if CallHistory.storedata exists
  }
};

export default macOSCallHistoryImportService;
```

### Phone Number Normalization

```typescript
/**
 * Normalize phone number for matching
 * Removes formatting, handles international prefixes
 */
function normalizePhoneNumber(phone: string | null): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading +1 for US numbers
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }
  // Remove leading 1 for US numbers
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned || null;
}
```

### Contact Linking

```typescript
/**
 * Find contact by phone number
 */
async function findContactByPhone(
  userId: string,
  phoneNumber: string
): Promise<string | null> {
  // Query contacts table for matching phone
  // Use normalized phone comparison
  // Return contact_id or null
}
```

## Integration Notes

- Imports from: `electron/types/callLog.ts` (TASK-1800)
- Exports to: Used by `electron/handlers/callLogHandlers.ts` (TASK-1802)
- Used by: TASK-1802 (IPC handlers), TASK-1807 (sync integration)
- Depends on: TASK-1800 (schema must exist)
- Pattern follows: `electron/services/macOSMessagesImportService.ts`

## Do / Don't

### Do:

- Follow macOSMessagesImportService patterns exactly
- Check Full Disk Access before attempting to read
- Use batch processing with progress callbacks
- Yield to event loop periodically for UI responsiveness
- Normalize phone numbers before contact matching
- Handle missing/null fields gracefully

### Don't:

- Don't import FaceTime calls (different data source)
- Don't assume phone numbers are in any specific format
- Don't block the main thread during large imports
- Don't skip permission checking
- Don't forget to close SQLite connections

## When to Stop and Ask

- If CallHistory.storedata format differs from expected
- If Full Disk Access check patterns are unclear
- If contact matching logic requirements are ambiguous
- If ZCALLRECORD has unexpected schema in testing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `macOSCallHistoryImportService.test.ts`
  - Test timestamp conversion
  - Test call type mapping
  - Test phone number normalization
  - Test import with mocked SQLite database
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: New service should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Import succeeds with Full Disk Access
  - Import fails gracefully without Full Disk Access
  - Duplicate calls are skipped on reimport
  - Calls are linked to existing contacts
  - Progress callback receives updates

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(calls): add macOS call history import service`
- **Labels**: `feature`, `macos`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new service file | +15K |
| Files to modify | 1 file (services/index) | +2K |
| Code volume | ~400 lines service + tests | +8K |
| Test complexity | Medium - mocked SQLite | +5K |

**Confidence:** Medium

**Risk factors:**
- Core Data format may have undocumented quirks
- Phone number formats may vary

**Similar past tasks:** Service tasks typically use x0.5 multiplier, but import services are complex.

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
- [ ] electron/services/macOSCallHistoryImportService.ts
- [ ] electron/services/__tests__/macOSCallHistoryImportService.test.ts

Features implemented:
- [ ] Import from CallHistory.storedata
- [ ] Timestamp conversion
- [ ] Call type mapping
- [ ] Phone normalization
- [ ] Contact linking
- [ ] Progress callbacks

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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
