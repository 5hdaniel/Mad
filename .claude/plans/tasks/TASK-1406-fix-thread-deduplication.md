# Task TASK-1406: Fix Thread Deduplication on Import

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Fix the thread deduplication issue where the same conversation appears as multiple separate threads in the UI after message import.

## Non-Goals

- Do NOT migrate existing duplicate data (document workaround instead)
- Do NOT modify frontend thread grouping logic
- Do NOT change how threads are displayed in UI
- Do NOT fix iOS sync (focus on macOS import first)

## Deliverables

1. Update: `electron/services/macOSMessagesImportService.ts` - Thread ID assignment and deduplication
2. Update/Create: Tests for thread deduplication logic

## Acceptance Criteria

- [ ] Same conversation gets consistent thread_id across re-imports
- [ ] GUID deduplication prevents message duplicates
- [ ] Thread ID is based on reliable source (chat_id from macOS)
- [ ] Re-sync does not create new thread entries for existing conversations
- [ ] Unit tests verify deduplication logic
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Root Cause (from TASK-1402 Investigation)

Based on investigation findings, the issue is likely:
1. Thread ID assignment not using consistent source
2. GUID deduplication not catching all duplicates
3. Re-import creating new records instead of updating

### Key Files

- `electron/services/macOSMessagesImportService.ts` - Main import logic
- `electron/services/db/communicationDbService.ts` - Database operations

### Expected Fix Pattern

Ensure consistent thread_id assignment:
```typescript
// Use macOS chat_id as thread_id source
const threadId = String(macOSMessage.chat_id);

// Or generate consistent ID from participants
const threadId = generateThreadId(participants.sort().join('-'));
```

Ensure GUID deduplication works:
```typescript
// Check for existing message by GUID before insert
const existing = await this.findMessageByGUID(macOSMessage.guid);
if (existing) {
  // Update existing instead of creating new
  await this.updateMessage(existing.id, messageData);
  return existing.id;
}
```

### Verification Steps

1. Import messages from macOS
2. Note thread_ids for specific conversations
3. Re-run import (simulate re-sync)
4. Verify same conversations have same thread_ids
5. Verify no duplicate messages created

## Integration Notes

- **Depends on**: TASK-1402 (investigation findings)
- **Related files**:
  - `electron/services/db/messageDbService.ts` - Message storage
  - `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` - Thread display
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Use investigation findings from TASK-1402 to guide implementation
- Ensure thread_id source is deterministic
- Preserve existing message data on re-import
- Log when deduplication occurs (debug level)

### Don't:

- Delete existing duplicate data (user action required)
- Change frontend grouping logic
- Modify iOS sync logic (out of scope)
- Break existing import functionality

## When to Stop and Ask

- If the root cause is different from TASK-1402 findings
- If fix requires schema migration
- If existing data corruption is discovered
- If iOS sync has same issue and needs immediate fix

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Re-import same message returns existing ID (not new)
  - Thread ID is consistent for same conversation
  - GUID deduplication prevents duplicates
- Existing tests to update:
  - macOSMessagesImportService tests (if they exist)

### Coverage

- Coverage impact: Must not decrease
- Focus: `macOSMessagesImportService.ts` import and deduplication logic

### Integration / Feature Tests

- Required scenarios:
  - Import messages twice, verify no duplicates
  - Same conversation has same thread_id after re-import

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(import): ensure consistent thread deduplication on message import`
- **Labels**: `bug`, `import`, `messages`
- **Depends on**: TASK-1402 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +10K |
| Import logic complexity | Complex service | +6K |
| Test updates | 3-4 test cases | +4K |

**Confidence:** Medium

**Risk factors:**
- Import service is complex
- Edge cases may be hard to test
- May need database query changes

**Similar past tasks:** BACKLOG-506 architecture changes

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
Files modified:
- [ ] electron/services/macOSMessagesImportService.ts
- [ ] (tests)

Features implemented:
- [ ] Thread ID assignment fixed
- [ ] GUID deduplication verified
- [ ] Tests added/updated

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: re-import creates no duplicates
```

### Existing Data Workaround

**For users with existing duplicate threads:**
<Document any manual steps or SQL queries to clean up>

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~17.5K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~17.5K | ~XK | +/-X% |
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

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes

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
