# Task TASK-1800: Call Logs Database Schema

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

Create the database schema for storing call log records, including migration file and TypeScript types, enabling call history import and transaction linking.

## Non-Goals

- Do NOT implement import logic (TASK-1801, TASK-1803)
- Do NOT implement IPC handlers (TASK-1802)
- Do NOT implement UI components (TASK-1805)
- Do NOT modify existing message or email tables

## Deliverables

1. New file: `electron/database/migrations/XXXXXX_add_call_logs_table.sql`
2. New file: `electron/types/callLog.ts`
3. Update: `electron/services/databaseService.ts` - Add call log table creation
4. Update: `src/types/index.ts` - Export call log types if needed for renderer

## Acceptance Criteria

- [ ] `call_logs` table created with all required fields
- [ ] Indexes on `phone_number`, `contact_id`, `timestamp` for query performance
- [ ] Foreign key to `contacts` table (optional - contact_id can be null)
- [ ] TypeScript types match database schema
- [ ] Migration applies cleanly on fresh database
- [ ] Migration applies cleanly on existing database
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Database Schema

```sql
-- Call logs table for phone call history
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  contact_id TEXT,  -- Optional link to contacts table
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing', 'missed')),
  duration INTEGER,  -- Duration in seconds, NULL for missed calls
  timestamp TEXT NOT NULL,  -- ISO 8601 timestamp
  device_source TEXT NOT NULL CHECK (device_source IN ('macos', 'iphone_backup')),
  external_id TEXT,  -- Original ID from source (e.g., Z_PK from CallHistory.storedata)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact_id ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_call_logs_external_id ON call_logs(external_id);

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_unique_import
  ON call_logs(user_id, external_id, device_source);
```

### TypeScript Types

```typescript
// electron/types/callLog.ts

/**
 * Call direction - incoming, outgoing, or missed
 */
export type CallDirection = 'incoming' | 'outgoing' | 'missed';

/**
 * Device source for call log
 */
export type CallDeviceSource = 'macos' | 'iphone_backup';

/**
 * Call log record stored in database
 */
export interface CallLog {
  id: string;
  user_id: string;
  phone_number: string;
  contact_id: string | null;
  direction: CallDirection;
  duration: number | null;  // seconds, null for missed calls
  timestamp: string;  // ISO 8601
  device_source: CallDeviceSource;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Call log for display (joined with contact info)
 */
export interface CallLogWithContact extends CallLog {
  contact_name: string | null;
  contact_phone: string | null;
}

/**
 * Input for creating a call log record
 */
export interface CallLogInput {
  user_id: string;
  phone_number: string;
  contact_id?: string | null;
  direction: CallDirection;
  duration?: number | null;
  timestamp: string;
  device_source: CallDeviceSource;
  external_id?: string | null;
}
```

### Migration File Naming

Use the current timestamp for migration file naming:
```
YYYYMMDDHHMMSS_add_call_logs_table.sql
```

Example: `20260202120000_add_call_logs_table.sql`

### Key Patterns

Follow existing migration patterns in `electron/database/migrations/`:

```typescript
// In databaseService.ts, add to applyMigrations or similar
const CALL_LOGS_MIGRATION = `
  CREATE TABLE IF NOT EXISTS call_logs (
    ...
  );
`;
```

## Integration Notes

- Used by: TASK-1801 (macOS import), TASK-1803 (Windows import), TASK-1804 (query service)
- Depends on: None (foundation task)
- Exports to: `electron/types/callLog.ts` types used by all call log tasks

## Do / Don't

### Do:

- Follow existing migration file patterns
- Use TEXT for IDs (UUID format)
- Include proper CHECK constraints for enum fields
- Add cascade delete on user_id
- Use SET NULL for contact_id foreign key (contact can be deleted)

### Don't:

- Don't use INTEGER for IDs (this codebase uses TEXT UUIDs)
- Don't forget indexes on commonly queried fields
- Don't make contact_id required (calls can exist without matched contact)
- Don't forget external_id for deduplication during import

## When to Stop and Ask

- If existing migration patterns are unclear
- If contacts table structure differs from expected
- If user_id field type is different from TEXT
- If there are conflicting table naming conventions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Schema creation test (table exists after migration)
  - Index creation verification
  - Foreign key constraint tests
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: New table, should add schema tests

### Integration / Feature Tests

- Required scenarios:
  - Migration applies on fresh database
  - Migration applies on database with existing data
  - Duplicate import prevented by unique constraint

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(db): add call_logs table schema`
- **Labels**: `database`, `schema`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (migration, types) | +8K |
| Files to modify | 2 files (databaseService, types/index) | +5K |
| Code volume | ~150 lines SQL + types | +5K |
| Test complexity | Low - schema verification | +2K |

**Confidence:** High

**Risk factors:**
- Migration system patterns may differ from expected
- Foreign key handling in better-sqlite3

**Similar past tasks:** Schema tasks typically complete under estimate (x1.3 multiplier applied)

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
- [ ] Migration file
- [ ] electron/types/callLog.ts

Features implemented:
- [ ] call_logs table with all fields
- [ ] Indexes created
- [ ] Types exported

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
