# Task TASK-1054: Add Test Coverage for Critical Paths

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Increase test coverage from 25% statements / 15% branches to 40% statements / 30% branches by adding comprehensive tests for critical paths: auth flows, database operations, and sync orchestration.

## Non-Goals

- Do NOT refactor production code to make it more testable
- Do NOT add integration tests (only unit tests)
- Do NOT test UI components (focus on backend services)
- Do NOT achieve 100% coverage (diminishing returns)
- Do NOT change existing test behavior (only add new tests)

## Deliverables

1. New/Expand: `electron/services/__tests__/googleAuthService.test.ts`
2. New/Expand: `electron/services/__tests__/microsoftAuthService.test.ts`
3. New/Expand: `electron/services/__tests__/syncOrchestrator.test.ts`
4. Expand: `electron/services/__tests__/databaseService.test.ts` (additional edge cases)

## Acceptance Criteria

- [ ] `npm test -- --coverage` shows >= 40% statement coverage
- [ ] `npm test -- --coverage` shows >= 30% branch coverage
- [ ] All new tests pass
- [ ] No regressions in existing tests
- [ ] Critical paths have comprehensive coverage (see Focus Areas below)
- [ ] All CI checks pass

## Implementation Notes

### Coverage Analysis Process

Before writing tests, run coverage report to identify gaps:

```bash
npm test -- --coverage --coverageReporters=text-summary --coverageReporters=html
# Open coverage/index.html to see detailed report
```

### Focus Areas (Priority Order)

#### 1. Auth Services (High Priority)

**googleAuthService.ts** - Key flows to test:
- OAuth URL generation with correct scopes
- Token exchange (authorization code -> tokens)
- Token refresh flow
- Error handling (invalid tokens, network errors)
- Token storage and retrieval

**microsoftAuthService.ts** - Key flows to test:
- Device code flow initiation
- Polling for token completion
- Token refresh flow
- Error handling (expired codes, network errors)
- Token storage and retrieval

#### 2. Database Operations (Medium Priority)

**databaseService.ts** - Additional edge cases:
- Transaction rollback on error
- Concurrent operation handling
- NULL/undefined input handling
- Large dataset pagination
- Connection recovery after error

#### 3. Sync Orchestration (Medium Priority)

**syncOrchestrator.ts** - Key flows to test:
- State transitions (idle -> syncing -> complete)
- Error recovery and retry logic
- Concurrent sync prevention
- Progress callback handling
- Cancellation handling

### Test Writing Patterns

**Auth Service Test Pattern:**
```typescript
describe('GoogleAuthService', () => {
  describe('getAuthUrl', () => {
    it('should include required scopes', () => {
      const url = googleAuthService.getAuthUrl();
      expect(url).toContain('scope=');
      expect(url).toContain('email');
      expect(url).toContain('profile');
    });

    it('should include PKCE code challenge', () => {
      const url = googleAuthService.getAuthUrl();
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should return tokens on successful exchange', async () => {
      // Mock fetch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
        }),
      });

      const tokens = await googleAuthService.exchangeCodeForTokens('auth-code');

      expect(tokens.access_token).toBe('access-123');
      expect(tokens.refresh_token).toBe('refresh-456');
    });

    it('should throw on invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      await expect(
        googleAuthService.exchangeCodeForTokens('invalid-code')
      ).rejects.toThrow();
    });
  });
});
```

**Sync Service Test Pattern:**
```typescript
describe('SyncOrchestrator', () => {
  describe('startSync', () => {
    it('should transition from idle to syncing', async () => {
      expect(syncOrchestrator.getState()).toBe('idle');

      const promise = syncOrchestrator.startSync();

      expect(syncOrchestrator.getState()).toBe('syncing');
      await promise;
      expect(syncOrchestrator.getState()).toBe('idle');
    });

    it('should prevent concurrent syncs', async () => {
      const sync1 = syncOrchestrator.startSync();
      const sync2 = syncOrchestrator.startSync();

      await expect(sync2).rejects.toThrow('Sync already in progress');
      await sync1;
    });
  });
});
```

### Coverage Improvement Strategy

1. **Start with uncovered files:** Check coverage report for 0% covered files in critical paths
2. **Add happy path tests first:** Cover the main success scenarios
3. **Add error handling tests:** Cover exception paths and error states
4. **Add edge case tests:** Cover boundary conditions and unusual inputs
5. **Verify coverage increased:** Run coverage report after each batch

### Mocking Dependencies

Use the existing mock patterns from the codebase:

```typescript
// Mock external services
jest.mock('node-fetch');
jest.mock('../databaseService');
jest.mock('../logService');

// Mock Electron
jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/path') },
  shell: { openExternal: jest.fn() },
}));
```

## Integration Notes

- Imports from: Service files being tested
- Exports to: None (test files)
- Used by: CI pipeline, coverage reports
- Depends on: TASK-1053 (tests must be passing first)

## Do / Don't

### Do:

- Run coverage report before starting to identify gaps
- Focus on critical paths first (auth, db, sync)
- Write tests that document expected behavior
- Mock all external dependencies (network, filesystem, electron)
- Test both success and failure paths

### Don't:

- Don't test implementation details (test behavior, not internals)
- Don't write tests that duplicate existing coverage
- Don't refactor production code to make it testable
- Don't add tests for deprecated/unused code paths
- Don't aim for 100% coverage (diminishing returns after 60-70%)

## When to Stop and Ask

- If a service is too tightly coupled to test without refactoring
- If you discover security issues while writing tests
- If coverage targets require testing private/internal functions
- If estimated effort exceeds 60K tokens
- If you need to modify production code to make it testable

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (this IS the test task)
- New tests to write:
  - googleAuthService: OAuth flow, token management
  - microsoftAuthService: Device code flow, token management
  - syncOrchestrator: State transitions, error handling
  - databaseService: Additional edge cases

### Coverage

- Coverage impact:
  - Statements: 25% -> >= 40%
  - Branches: 15% -> >= 30%

### Integration / Feature Tests

- Not required for this task

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks
- [ ] Coverage >= 40% statements (verified manually until TASK-1055)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `test(services): add critical path test coverage for auth, db, and sync`
- **Labels**: `test`, `technical-debt`, `coverage`
- **Depends on**: TASK-1053 (failing tests must be fixed first)

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~35K-45K

**Token Cap:** 180K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create/modify | 4 test files | +15K |
| Test cases per service | ~10-15 per service | +20K |
| Mock complexity | Medium (network, db) | +5K |
| Coverage verification | Multiple runs | +5K |

**Confidence:** Medium

**Risk factors:**
- Services may be tightly coupled requiring creative mocking
- Coverage targets may require more tests than estimated
- Some services may have complex state management

**Similar past tasks:** TASK-800 (test fixtures) used ~25K; this is larger scope

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
Files created/modified:
- [ ] electron/services/__tests__/googleAuthService.test.ts
- [ ] electron/services/__tests__/microsoftAuthService.test.ts
- [ ] electron/services/__tests__/syncOrchestrator.test.ts
- [ ] electron/services/__tests__/databaseService.test.ts (additions)

Coverage verification:
- [ ] Initial coverage baseline recorded
- [ ] Final coverage meets targets (40% statements, 30% branches)
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Coverage Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Statements | X% | X% | +X% |
| Branches | X% | X% | +X% |
| Functions | X% | X% | +X% |
| Lines | X% | X% | +X% |

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~40K | ~XK | +/-X% |
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A (test-only changes)
**Test Coverage:** >= 40% statements / >= 30% branches

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
