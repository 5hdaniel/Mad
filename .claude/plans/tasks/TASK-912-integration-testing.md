# TASK-912: Integration Testing

**Sprint:** SPRINT-014
**Backlog:** ALL (BACKLOG-032, BACKLOG-090, BACKLOG-091)
**Priority:** HIGH
**Category:** test
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

**Estimated:** 4-6 turns, ~25K tokens, 25-35 min

---

## Goal

Create integration tests that verify all SPRINT-014 features work together correctly.

## Non-Goals

- Do NOT create E2E tests with real APIs
- Do NOT test UI in isolation (component tests elsewhere)
- Do NOT modify production code

---

## Prerequisites

**Depends on:** All other SPRINT-014 tasks (TASK-904 through TASK-911) must be merged first.

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `electron/services/__tests__/incrementalSync.integration.test.ts` | Test incremental sync flow |
| `electron/services/__tests__/syncLock.integration.test.ts` | Test sync lock mechanism |
| `electron/services/__tests__/emailDedup.integration.test.ts` | Test Message-ID extraction and filtering |

---

## Test Scenarios

### 1. Sync Lock Tests (`syncLock.integration.test.ts`)

```typescript
describe('Sync Lock Integration', () => {
  it('should report sync status accurately when backup running', async () => {
    // Arrange: Start a backup
    await backupService.startBackup();

    // Act: Check status
    const status = await syncStatusService.getStatus();

    // Assert
    expect(status.isAnyOperationRunning).toBe(true);
    expect(status.backupInProgress).toBe(true);
    expect(status.currentOperation).toContain('backup');
  });

  it('should block new sync when backup in progress', async () => {
    // Arrange: Start a backup
    await backupService.startBackup();

    // Act: Try to start another sync
    const result = await syncOrchestrator.startSync();

    // Assert
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('progress');
  });

  it('should allow sync after previous completes', async () => {
    // Arrange: Complete a backup
    await backupService.startBackup();
    await backupService.completeBackup();

    // Act: Start new sync
    const status = await syncStatusService.getStatus();

    // Assert
    expect(status.isAnyOperationRunning).toBe(false);
  });
});
```

### 2. Incremental Sync Tests (`incrementalSync.integration.test.ts`)

```typescript
describe('Incremental Sync Integration', () => {
  it('should only fetch emails since last sync (Gmail)', async () => {
    // Arrange: Set up mock with last sync time
    const lastSync = new Date('2024-01-01');
    await databaseService.updateOAuthTokenSyncTime('user1', 'google', lastSync);

    // Act: Fetch emails
    const query = await gmailFetchService.buildQuery('user1');

    // Assert
    expect(query).toContain('after:');
    expect(query).toContain(Math.floor(lastSync.getTime() / 1000).toString());
  });

  it('should fetch 90 days on first sync (no last_sync_at)', async () => {
    // Arrange: No previous sync
    await databaseService.clearOAuthTokenSyncTime('user1', 'google');

    // Act: Build query
    const query = await gmailFetchService.buildQuery('user1');

    // Assert: Should have 90-day limit
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    expect(query).toContain(`after:${ninetyDaysAgo}`);
  });

  it('should skip unchanged iPhone backup', async () => {
    // Arrange: Set up backup with known hash
    const backupPath = '/test/backup';
    await syncOrchestrator.recordBackupSync(backupPath, 'hash123');

    // Mock: Return same hash
    jest.spyOn(backupService, 'getBackupMetadata').mockResolvedValue({
      modifiedAt: new Date(),
      manifestHash: 'hash123',
    });

    // Act
    const shouldProcess = await syncOrchestrator.shouldProcessBackup(backupPath);

    // Assert
    expect(shouldProcess).toBe(false);
  });

  it('should process changed iPhone backup', async () => {
    // Arrange: Set up backup with old hash
    const backupPath = '/test/backup';
    await syncOrchestrator.recordBackupSync(backupPath, 'hash123');

    // Mock: Return new hash
    jest.spyOn(backupService, 'getBackupMetadata').mockResolvedValue({
      modifiedAt: new Date(),
      manifestHash: 'hash456', // Different
    });

    // Act
    const shouldProcess = await syncOrchestrator.shouldProcessBackup(backupPath);

    // Assert
    expect(shouldProcess).toBe(true);
  });
});
```

### 3. Email Dedup Tests (`emailDedup.integration.test.ts`)

```typescript
describe('Email Deduplication Integration', () => {
  it('should extract Message-ID from Gmail headers', async () => {
    // Arrange: Gmail message with Message-ID
    const mockMessage = {
      payload: {
        headers: [
          { name: 'Message-ID', value: '<test123@mail.gmail.com>' },
          { name: 'Subject', value: 'Test' },
        ],
      },
    };

    // Act: Parse message
    const parsed = await gmailFetchService.parseMessage(mockMessage);

    // Assert
    expect(parsed.messageIdHeader).toBe('<test123@mail.gmail.com>');
  });

  it('should handle missing Message-ID gracefully', async () => {
    // Arrange: Gmail message without Message-ID
    const mockMessage = {
      payload: {
        headers: [
          { name: 'Subject', value: 'Test' },
        ],
      },
    };

    // Act
    const parsed = await gmailFetchService.parseMessage(mockMessage);

    // Assert
    expect(parsed.messageIdHeader).toBeNull();
  });

  it('should exclude duplicates from LLM analysis', async () => {
    // Arrange: Insert messages with one duplicate
    await databaseService.insertMessage({
      id: 'msg1',
      user_id: 'user1',
      is_transaction_related: null,
      duplicate_of: null,
    });
    await databaseService.insertMessage({
      id: 'msg2',
      user_id: 'user1',
      is_transaction_related: null,
      duplicate_of: 'msg1', // Duplicate
    });

    // Act: Get messages for LLM
    const messages = await databaseService.getMessagesForLLMAnalysis('user1');

    // Assert
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe('msg1');
  });

  it('should exclude already-analyzed from LLM analysis', async () => {
    // Arrange: Insert messages with one analyzed
    await databaseService.insertMessage({
      id: 'msg1',
      user_id: 'user1',
      is_transaction_related: true, // Already analyzed
      duplicate_of: null,
    });
    await databaseService.insertMessage({
      id: 'msg2',
      user_id: 'user1',
      is_transaction_related: null, // Not analyzed
      duplicate_of: null,
    });

    // Act
    const messages = await databaseService.getMessagesForLLMAnalysis('user1');

    // Assert
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe('msg2');
  });
});
```

---

## Acceptance Criteria

- [ ] All integration tests pass
- [ ] Tests cover sync lock mechanism
- [ ] Tests cover incremental email sync (Gmail + Outlook)
- [ ] Tests cover iPhone backup skip logic
- [ ] Tests cover Message-ID extraction
- [ ] Tests cover LLM filter (duplicates + analyzed)
- [ ] Tests use proper mocking, no real API calls
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use Jest mocks for external dependencies
- Test integration points between services
- Include edge cases (null values, empty arrays)
- Add descriptive test names

### Don't
- Make real API calls
- Test UI components (separate tests)
- Duplicate unit tests from other tasks

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Required services not available (tasks not merged)
- Test patterns differ from existing tests
- Need to modify production code for testability

---

## Testing Expectations

- All tests should run in CI
- No flaky tests
- Coverage for happy path and edge cases
- Integration with existing test suite

---

## PR Preparation

**Branch:** `feature/TASK-912-integration-tests`
**Title:** `test(sync): add integration tests for incremental sync and dedup`
**Labels:** `test`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop (AFTER all other SPRINT-014 tasks merged)
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** No - final task
- **Depends On:** TASK-904 through TASK-911
- **Blocks:** None (sprint completion)
