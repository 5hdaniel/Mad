# Task TASK-1402: Investigate Thread Deduplication Issue

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent investigates, documents findings, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate why the same conversation appears as multiple separate threads in the UI. Document root causes and propose fixes for BACKLOG-514.

## Non-Goals

- Do NOT implement fixes in this task (that's Phase 2)
- Do NOT modify any production code
- Do NOT change the database schema
- Do NOT delete duplicate threads (if found)

## Deliverables

1. Update: `.claude/plans/tasks/TASK-1402-investigate-thread-deduplication.md` (this file - Investigation Findings section)
2. New file: `.claude/plans/investigations/BACKLOG-514-thread-dedup-findings.md`

## Acceptance Criteria

- [ ] Thread ID assignment during import analyzed
- [ ] Frontend thread grouping logic analyzed
- [ ] Re-import/re-sync behavior analyzed
- [ ] Root cause of duplicate threads clearly documented
- [ ] Proposed fixes documented with specific file/line changes
- [ ] No production code modified (investigation only)
- [ ] Findings PR created and merged

## Investigation Notes

### Key Questions to Answer

1. **Import Thread Assignment**:
   - How does `macOSMessagesImportService.ts` assign thread_id?
   - Is it based on chat_id from macOS database?
   - Can the same conversation get different thread_ids on re-import?

2. **Frontend Grouping**:
   - How does `TransactionMessagesTab.tsx` group messages into threads?
   - Does it use message.thread_id or compute groups differently?
   - What happens if thread_id is null/inconsistent?

3. **Backend Grouping**:
   - How does `countTextThreadsForTransaction()` count threads?
   - Does it match the frontend grouping logic?
   - What's the COALESCE fallback behavior?

4. **Re-sync Behavior**:
   - What happens when messages are re-imported?
   - Are existing messages updated or new ones created?
   - Could GUID deduplication be failing?

### Files to Investigate

| File | Focus |
|------|-------|
| `electron/services/macOSMessagesImportService.ts` | Thread ID assignment, GUID deduplication |
| `electron/services/db/communicationDbService.ts` | Lines 837-870: Thread counting logic |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Frontend thread grouping |
| `electron/database/schema.sql` | `messages` table structure, thread_id column |

### Investigation Commands

```bash
# Check thread_id usage in import service
grep -rn "thread_id\|threadId\|chat_id" --include="*.ts" electron/services/macOSMessagesImportService.ts

# Check how threads are grouped in backend
grep -rn "thread_id\|groupBy\|DISTINCT" --include="*.ts" electron/services/db/communicationDbService.ts

# Check frontend grouping logic
grep -rn "thread\|group" --include="*.tsx" src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx

# Check GUID deduplication
grep -rn "guid\|external_id\|dedup" --include="*.ts" electron/services/macOSMessagesImportService.ts

# Check messages table schema
grep -A 30 "CREATE TABLE.*messages" electron/database/schema.sql
```

### Reproduction Steps

To potentially reproduce the issue:
1. Import messages from macOS
2. Note a specific conversation's thread_id
3. Close and reopen the app
4. Re-run message import
5. Check if same conversation now has multiple thread entries
6. Link the conversation to a transaction
7. Check if it appears as multiple threads

## Integration Notes

- **Blocks**: TASK-1406 (Fix thread deduplication)
- **Related**: macOS message import, iPhone sync
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Trace the full import flow from macOS DB to app DB
- Compare frontend and backend grouping logic
- Look for edge cases in thread_id assignment
- Document exactly when/how duplicates are created

### Don't:

- Modify any production code
- Fix bugs (save for Phase 2)
- Delete or modify user data
- Spend more than ~15K tokens on investigation

## When to Stop and Ask

- If duplicates exist in database (data corruption issue)
- If fix requires schema migration
- If iPhone sync has same issue (scope expansion)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (investigation only)

### Coverage

- Coverage impact: None (no code changes)

### Integration / Feature Tests

- Required scenarios: None (investigation only)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no code changes expected)
- [ ] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to read | 4-5 files | +8K |
| Import flow tracing | Complex service | +4K |
| Documentation | Findings document | +3K |

**Confidence:** Medium

**Risk factors:**
- Import logic is complex
- May need to trace through multiple files
- Edge cases may be hard to identify

---

## Investigation Findings (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Investigation Date: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Import Thread Assignment Analysis

**How thread_id is assigned:**
```typescript
// Paste relevant code from macOSMessagesImportService.ts
```

**Source of thread_id:**
- [ ] From macOS `chat_id`
- [ ] Generated UUID
- [ ] Computed from participants
- [ ] Other: <explain>

**Potential Issues:**
<Document any issues with assignment logic>

---

### Frontend Grouping Analysis

**Grouping Logic:**
```typescript
// Paste relevant code from TransactionMessagesTab.tsx
```

**Groups by:**
- [ ] `message.thread_id`
- [ ] Computed from participants
- [ ] Other: <explain>

**Edge Case Handling:**
<How are null/missing thread_ids handled?>

---

### Backend Counting Analysis

**Counting Logic (communicationDbService.ts):**
```sql
-- Paste the actual SQL query
```

**COALESCE Behavior:**
<What happens when thread_id is null?>

**Match with Frontend:**
- [ ] Yes, same grouping logic
- [ ] No, differs because: <explanation>

---

### Re-Import/Re-Sync Analysis

**GUID Deduplication:**
```typescript
// Paste relevant deduplication code
```

**Can duplicates occur?**
- [ ] Yes, under these conditions: <explain>
- [ ] No, because: <explain>

---

### Root Cause

**Primary Issue:**
<Clear explanation of why duplicate threads appear>

**Evidence:**
<Code snippets, logic traces that prove the root cause>

---

### Proposed Fix

**File Changes:**
| File | Line(s) | Change |
|------|---------|--------|
| `<file>` | `<lines>` | `<description>` |

**Fix Approach:**
<Describe the fix strategy>

---

### Recommended Phase 2 Task

Based on investigation:

**TASK-1406**: <specific scope and approach>

---

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Investigation Quality:** PASS / NEEDS MORE
**Root Cause Identified:** Yes / No / Partial

**Review Notes:**
<Key observations, concerns, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes
