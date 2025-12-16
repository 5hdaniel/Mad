# TASK-203: Fix syncOrchestrator.test.ts Skipped Tests

**Backlog ID:** BACKLOG-059
**Sprint:** TECHDEBT-2024-01
**Phase:** 1 (Test Stabilization)
**Branch:** `fix/task-203-sync-tests`
**Estimated Turns:** 15-25

---

## Objective

Re-enable and fix the skipped tests in `electron/services/__tests__/syncOrchestrator.test.ts`. The entire file appears to be skipped, meaning critical sync logic has no test coverage.

---

## Context

The syncOrchestrator is responsible for:
- Coordinating iPhone backup and sync operations
- Managing sync state and progress
- Handling errors and recovery

This is **critical path code** - sync failures directly impact users' ability to get data from their phones.

---

## Requirements

### Must Do:
1. Read and understand the syncOrchestrator implementation:
   - `electron/services/syncOrchestrator.ts`
   - Related services it calls (backupService, messageParser, etc.)

2. Identify why tests were skipped:
   - Check for TODO/FIXME comments
   - Check git history for when tests were skipped
   - Understand what mocks are needed

3. For each skipped test:
   - Understand the behavior being tested
   - Create proper mocks for external dependencies
   - Update assertions to match current implementation
   - Remove skip and verify test passes

4. Ensure tests are deterministic:
   - No timing dependencies
   - Proper mock isolation
   - No file system side effects

### Must NOT Do:
- Change syncOrchestrator.ts implementation
- Skip tests that are hard to fix (fix them properly)
- Add new tests (focus on existing)

---

## Acceptance Criteria

- [ ] All previously skipped tests in syncOrchestrator.test.ts are running
- [ ] All tests pass
- [ ] Tests are not flaky (run 3x to verify)
- [ ] `npm test -- --testPathPattern=syncOrchestrator.test.ts` passes
- [ ] No changes to production code

---

## Expected Mocks Needed

Based on syncOrchestrator dependencies, you'll likely need mocks for:

```typescript
// Example mock structure
jest.mock('../backupService', () => ({
  startBackup: jest.fn(),
  checkBackupStatus: jest.fn(),
  // ...
}));

jest.mock('../messageParser', () => ({
  parseMessages: jest.fn(),
  // ...
}));

jest.mock('../databaseService', () => ({
  // database operations
}));
```

---

## Files to Modify

- `electron/services/__tests__/syncOrchestrator.test.ts` - Fix skipped tests

## Files to Read (for context):

- `electron/services/syncOrchestrator.ts`
- `electron/services/backupService.ts`
- `electron/services/messageParser.ts`
- Any existing mock utilities in `__tests__/` or `__mocks__/`

---

## Complexity Note

This task is marked as **Complex** because:
- syncOrchestrator has many dependencies
- Sync operations involve async state management
- May need significant mock infrastructure

If after initial investigation you estimate >30 turns needed, **stop and report to PM** for possible task breakdown.

---

## Implementation Summary Template

```markdown
## Implementation Summary

### Tests Fixed:
1. [Test name] - [What was wrong] → [How fixed]
2. ...

### Mocks Created/Updated:
- [Mock name]: [What it mocks]

### Key Challenges:
- [Challenge 1]: [How resolved]

### Verified:
- [ ] Tests run 3x without flakiness
- [ ] No production code changes
```

---

## Guardrails

⚠️ **STOP and ask PM if:**
- Tests require changes to production code to be testable
- You discover the syncOrchestrator has bugs
- Mock complexity exceeds reasonable scope (>200 lines of mocks)
- Tests would require integration test infrastructure (real file system, etc.)
