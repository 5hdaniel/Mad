# Task TASK-1804: Call Log Service (CRUD Operations)

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

Create a database service for querying and filtering call logs, providing the data layer for the Calls tab UI component.

## Non-Goals

- Do NOT implement import logic (TASK-1801, TASK-1803)
- Do NOT implement UI components (TASK-1805)
- Do NOT implement export logic (TASK-1806)
- Do NOT implement delete functionality (not needed for MVP)

## Deliverables

1. New file: `electron/services/db/callLogDbService.ts`
2. New file: `electron/handlers/callLogQueryHandlers.ts`
3. Update: `electron/handlers/index.ts` - Register query handlers
4. Update: `electron/preload/api.ts` - Expose query API
5. Update: `src/window.d.ts` - Add query types

## Acceptance Criteria

- [ ] `getCallLogsForTransaction()` returns calls filtered by transaction contacts
- [ ] `getCallLogsForUser()` returns all calls for a user
- [ ] `getCallLogsByContact()` returns calls for a specific contact
- [ ] Filter by direction (incoming, outgoing, missed)
- [ ] Sort by timestamp (newest first by default)
- [ ] Pagination support (limit/offset)
- [ ] Returns call duration in human-readable format
- [ ] Includes contact name when available
- [ ] IPC handlers expose all query methods
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Database Service Pattern

```typescript
// electron/services/db/callLogDbService.ts

import databaseService from '../databaseService';
import type { CallLog, CallLogWithContact, CallDirection } from '../../types/callLog';

/**
 * Query options for call logs
 */
export interface CallLogQueryOptions {
  userId: string;
  direction?: CallDirection | null;  // Filter by direction
  contactId?: string | null;         // Filter by contact
  phoneNumber?: string | null;       // Filter by phone
  startDate?: string | null;         // Filter by date range start
  endDate?: string | null;           // Filter by date range end
  limit?: number;                    // Pagination limit
  offset?: number;                   // Pagination offset
  sortOrder?: 'asc' | 'desc';        // Sort order (default: desc)
}

/**
 * Call log database service
 */
export const callLogDbService = {
  /**
   * Get all call logs for a user with optional filters
   */
  getCallLogs(options: CallLogQueryOptions): CallLogWithContact[] {
    const db = databaseService.getRawDatabase();

    let sql = `
      SELECT
        cl.*,
        c.name as contact_name,
        c.phone as contact_phone
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE cl.user_id = ?
    `;
    const params: unknown[] = [options.userId];

    if (options.direction) {
      sql += ' AND cl.direction = ?';
      params.push(options.direction);
    }

    if (options.contactId) {
      sql += ' AND cl.contact_id = ?';
      params.push(options.contactId);
    }

    if (options.phoneNumber) {
      sql += ' AND cl.phone_number = ?';
      params.push(options.phoneNumber);
    }

    if (options.startDate) {
      sql += ' AND cl.timestamp >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      sql += ' AND cl.timestamp <= ?';
      params.push(options.endDate);
    }

    sql += ` ORDER BY cl.timestamp ${options.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return db.prepare(sql).all(...params) as CallLogWithContact[];
  },

  /**
   * Get call logs for contacts assigned to a transaction
   */
  getCallLogsForTransaction(
    userId: string,
    transactionId: string,
    options?: Partial<CallLogQueryOptions>
  ): CallLogWithContact[] {
    const db = databaseService.getRawDatabase();

    // Get phone numbers of contacts assigned to this transaction
    const contactPhones = db.prepare(`
      SELECT DISTINCT c.phone
      FROM contacts c
      INNER JOIN transaction_contacts tc ON tc.contact_id = c.id
      WHERE tc.transaction_id = ? AND c.phone IS NOT NULL
    `).all(transactionId) as { phone: string }[];

    if (contactPhones.length === 0) {
      return [];
    }

    // Get calls matching these phone numbers
    const phones = contactPhones.map(c => c.phone);
    const placeholders = phones.map(() => '?').join(',');

    let sql = `
      SELECT
        cl.*,
        c.name as contact_name,
        c.phone as contact_phone
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE cl.user_id = ?
        AND cl.phone_number IN (${placeholders})
    `;
    const params: unknown[] = [userId, ...phones];

    if (options?.direction) {
      sql += ' AND cl.direction = ?';
      params.push(options.direction);
    }

    if (options?.startDate) {
      sql += ' AND cl.timestamp >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      sql += ' AND cl.timestamp <= ?';
      params.push(options.endDate);
    }

    sql += ` ORDER BY cl.timestamp ${options?.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options?.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return db.prepare(sql).all(...params) as CallLogWithContact[];
  },

  /**
   * Get call log count for a transaction (for badge display)
   */
  getCallCountForTransaction(userId: string, transactionId: string): number {
    const db = databaseService.getRawDatabase();

    const contactPhones = db.prepare(`
      SELECT DISTINCT c.phone
      FROM contacts c
      INNER JOIN transaction_contacts tc ON tc.contact_id = c.id
      WHERE tc.transaction_id = ? AND c.phone IS NOT NULL
    `).all(transactionId) as { phone: string }[];

    if (contactPhones.length === 0) {
      return 0;
    }

    const phones = contactPhones.map(c => c.phone);
    const placeholders = phones.map(() => '?').join(',');

    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM call_logs
      WHERE user_id = ? AND phone_number IN (${placeholders})
    `).get(userId, ...phones) as { count: number };

    return result.count;
  },

  /**
   * Get call statistics for a contact
   */
  getCallStatsForContact(
    userId: string,
    contactId: string
  ): {
    totalCalls: number;
    totalDuration: number;
    incomingCalls: number;
    outgoingCalls: number;
    missedCalls: number;
  } {
    const db = databaseService.getRawDatabase();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        COALESCE(SUM(duration), 0) as totalDuration,
        SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incomingCalls,
        SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoingCalls,
        SUM(CASE WHEN direction = 'missed' THEN 1 ELSE 0 END) as missedCalls
      FROM call_logs
      WHERE user_id = ? AND contact_id = ?
    `).get(userId, contactId) as {
      totalCalls: number;
      totalDuration: number;
      incomingCalls: number;
      outgoingCalls: number;
      missedCalls: number;
    };

    return stats;
  },
};

export default callLogDbService;
```

### IPC Handlers

```typescript
// electron/handlers/callLogQueryHandlers.ts

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { callLogDbService, CallLogQueryOptions } from '../services/db/callLogDbService';
import logService from '../services/logService';

let handlersRegistered = false;

export function registerCallLogQueryHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(
    'calls:get-for-transaction',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      transactionId: string,
      options?: Partial<CallLogQueryOptions>
    ) => {
      return callLogDbService.getCallLogsForTransaction(userId, transactionId, options);
    }
  );

  ipcMain.handle(
    'calls:get-count-for-transaction',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      transactionId: string
    ) => {
      return callLogDbService.getCallCountForTransaction(userId, transactionId);
    }
  );

  ipcMain.handle(
    'calls:get-stats-for-contact',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      contactId: string
    ) => {
      return callLogDbService.getCallStatsForContact(userId, contactId);
    }
  );
}
```

### Duration Formatting Utility

```typescript
/**
 * Format call duration in human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1:23" or "0:05"
 */
export function formatCallDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
```

## Integration Notes

- Imports from: `electron/types/callLog.ts` (TASK-1800)
- Exports to: Used by UI components (TASK-1805), export service (TASK-1806)
- Used by: TASK-1805 (Calls tab UI), TASK-1806 (export)
- Depends on: TASK-1800 (schema)
- Pattern follows: `electron/services/db/` existing services

## Do / Don't

### Do:

- Follow existing db service patterns
- Use prepared statements for all queries
- Return typed results
- Include contact info in results (LEFT JOIN)
- Support flexible filtering and pagination

### Don't:

- Don't implement delete functionality yet
- Don't expose raw SQL to renderer
- Don't forget to handle null contact_id
- Don't forget phone number normalization in queries

## When to Stop and Ask

- If transaction_contacts table structure differs
- If existing db service patterns are unclear
- If pagination requirements change

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `callLogDbService.test.ts`
  - Test query with filters
  - Test transaction filtering
  - Test contact stats
  - Test pagination
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: New service should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Query returns calls for transaction contacts
  - Direction filter works
  - Date range filter works
  - Pagination works correctly

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(calls): add call log query service`
- **Labels**: `feature`, `service`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-18K

**Token Cap:** 72K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (service + handlers) | +8K |
| Files to modify | 3 files (index, preload, window.d.ts) | +4K |
| Code volume | ~300 lines queries + types | +4K |
| Test complexity | Medium - query testing | +4K |

**Confidence:** High

**Risk factors:**
- Transaction contact query complexity

**Similar past tasks:** Service tasks use x0.5 multiplier = ~15K

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
- [ ] electron/services/db/callLogDbService.ts
- [ ] electron/handlers/callLogQueryHandlers.ts
- [ ] Tests for both files

Files modified:
- [ ] electron/handlers/index.ts
- [ ] electron/preload/api.ts
- [ ] src/window.d.ts

Features implemented:
- [ ] getCallLogsForTransaction
- [ ] getCallLogsForUser
- [ ] getCallCountForTransaction
- [ ] getCallStatsForContact
- [ ] IPC handlers
- [ ] Preload API

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
