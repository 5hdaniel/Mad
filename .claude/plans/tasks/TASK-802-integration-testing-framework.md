# Task TASK-802: Integration Testing Framework with Fake Data

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Create an integration testing framework that uses the fake email and SMS fixtures (from TASK-800 and TASK-801) to enable end-to-end testing of sync, detection, and extraction pipelines without external dependencies.

## Non-Goals

- Do NOT create the fixtures themselves (that is TASK-800 and TASK-801)
- Do NOT modify production services
- Do NOT test UI components (focus on backend integration)

## Deliverables

1. New file: `tests/integration/testSandbox.ts` - Main sandbox orchestrator
2. New file: `tests/integration/mockProviders.ts` - Mock email/message providers
3. New file: `tests/integration/pipelineTests.test.ts` - Integration test suite
4. New file: `tests/integration/README.md` - Documentation
5. Update: `jest.config.js` - Add integration test configuration

## Acceptance Criteria

- [ ] TestSandbox can initialize with fake email and SMS data
- [ ] Mock providers simulate Gmail, Outlook, and iOS backup sync
- [ ] Pipeline tests verify email sync -> AI detection -> transaction extraction
- [ ] Tests use deterministic data and produce reproducible results
- [ ] Tests can run offline (no network calls)
- [ ] Tests complete in under 30 seconds total
- [ ] All integration tests pass in CI

## Implementation Notes

### TestSandbox Architecture

```typescript
export class TestSandbox {
  private db: Database;
  private emailProvider: MockEmailProvider;
  private messageProvider: MockMessageProvider;

  async setup(): Promise<void> { /* Initialize */ }
  async teardown(): Promise<void> { /* Cleanup */ }
  async syncEmails(provider: 'gmail' | 'outlook'): Promise<SyncResult> { ... }
  async syncMessages(): Promise<SyncResult> { ... }
  async runDetection(): Promise<DetectionResult> { ... }
}
```

### Test Patterns

```typescript
describe('Integration: Email to Transaction Pipeline', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = new TestSandbox();
    await sandbox.setup();
  });

  it('should sync emails and detect transactions', async () => {
    await sandbox.syncEmails('gmail');
    const result = await sandbox.runDetection();
    expect(result.transactionsDetected).toBeGreaterThan(0);
  });
});
```

## Integration Notes

- Imports from: TASK-800 emailFixtureService, TASK-801 iosBackupFixtureService
- Depends on: TASK-800, TASK-801 (must complete first)

## PR Preparation

- **Title**: `test(integration): add sandbox testing framework`
- **Labels**: `test`, `infrastructure`, `ci`
- **Depends on**: TASK-800, TASK-801

---

## PM Estimate

**Turns:** 12-18 | **Tokens:** ~60K-90K | **Time:** ~2-3h
