# TASK-1026: Add Tests for macOSMessagesImportService - Threads

**Backlog ID:** BACKLOG-203
**Sprint:** SPRINT-032
**Phase:** Phase 2 - macOS Messages Test Coverage
**Branch:** `test/task-1026-macos-messages-threads`
**Estimated Tokens:** ~20K
**Token Cap:** 80K

---

## Objective

Add comprehensive unit tests for thread management functionality in `macOSMessagesImportService.ts`, covering thread grouping, participant resolution, and transaction linking.

---

## Context

This task complements TASK-1025 by focusing on the thread-related functionality of the macOS Messages import service. Threads group messages by conversation and link to transactions for audit purposes.

---

## Requirements

### Must Do:
1. Create `macOSMessagesImportService.threads.test.ts`
2. Test thread creation from chat handles
3. Test participant resolution (phone/email to contact)
4. Test thread-to-transaction linking
5. Test group chat handling
6. Test thread merging/deduplication

### Must NOT Do:
- Duplicate tests from TASK-1025 (core tests)
- Overlap with attachment tests
- Make changes to service implementation
- Test transaction creation (different service)

---

## Acceptance Criteria

- [ ] New test file created: `macOSMessagesImportService.threads.test.ts`
- [ ] Thread creation tests cover single and group chats
- [ ] Participant resolution tests cover various formats
- [ ] Thread linking tests verify correct transaction association
- [ ] Deduplication tests verify no duplicate threads
- [ ] Test coverage >60% for thread-related functions
- [ ] All existing tests continue to pass

---

## Files to Create

- `electron/services/__tests__/macOSMessagesImportService.threads.test.ts`

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` - Service implementation
- `electron/services/__tests__/macOSMessagesImportService.attachments.test.ts` - Existing tests
- `electron/services/__tests__/macOSMessagesImportService.core.test.ts` - From TASK-1025

---

## Testing Approach

### Test Categories

1. **Thread Creation**
   - Single participant (1:1 chat)
   - Multiple participants (group chat)
   - Empty participant list
   - Thread with no messages

2. **Participant Resolution**
   - Resolve phone to existing contact
   - Resolve email to existing contact
   - Handle unknown participants
   - Handle mixed known/unknown

3. **Thread-to-Transaction Linking**
   - Link by contact match
   - Link by date range
   - No matching transaction
   - Multiple potential matches

4. **Group Chat Handling**
   - Create thread with all participants
   - Handle participant changes over time
   - Handle participant leave/join

5. **Thread Deduplication**
   - Same participants = same thread
   - Different order = same thread
   - Prevent duplicate imports

---

## Testing Expectations

### Unit Tests
- **Required:** Yes (primary deliverable)
- **New tests to write:** ~12-15 test cases
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `test(messages): add thread tests for macOSMessagesImportService`
- **Branch:** `test/task-1026-macos-messages-threads`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely
- [ ] Reviewed TASK-1025 approach for consistency

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Implementation:
- [ ] Test file created
- [ ] Thread creation tests written
- [ ] Participant resolution tests written
- [ ] Transaction linking tests written
- [ ] All tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Coverage report included
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Coverage Report

| Function | Coverage |
|----------|----------|
| createThread | X% |
| resolveParticipants | X% |
| linkToTransaction | X% |
| deduplicateThreads | X% |

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Thread logic appears to have bugs that should be fixed first
- You cannot isolate thread tests from core functionality
- Coverage target requires testing private functions
- Transaction linking logic is unclear
- You encounter blockers not covered in the task file
