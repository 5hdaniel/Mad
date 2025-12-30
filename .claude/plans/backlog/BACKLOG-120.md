# BACKLOG-120: CI Testing Infrastructure Gaps

**Category:** test/infra
**Priority:** Medium
**Status:** Pending
**Sprint:** Unassigned
**Created:** 2025-12-30
**Origin:** TASK-704 CI debugging session

---

## Summary

Track and address testing infrastructure gaps identified during TASK-704 CI debugging work. Several test categories are currently excluded from CI due to technical limitations, representing potential risk areas that need alternative coverage strategies.

---

## Background Context

During TASK-704 implementation, CI runs started hanging indefinitely (20-45+ minutes). Extensive debugging revealed multiple root causes related to how Jest handles certain test patterns in the CI environment.

### Root Cause Analysis

1. **Mock Services with EventEmitter/setTimeout**
   - Mock classes extend EventEmitter and create setTimeout timers
   - These timers keep Node.js event loop alive after tests complete
   - Jest's `--forceExit` flag conflicts with `--detectOpenHandles`

2. **Native Module Incompatibility**
   - Electron native modules (better-sqlite3-multiple-ciphers) are compiled for Electron runtime
   - Jest runs under Node.js, causing version mismatches
   - Tests that require native modules hang during module load

3. **Fake Timer Conflicts**
   - Integration tests use `jest.useFakeTimers()` at module level
   - Mixed with real async operations (Promises, EventEmitter)
   - Creates deadlock: fake timers wait for manual advancement, async code waits for real time

---

## Current Workarounds Applied (TASK-704)

### 1. jest.config.js Changes
```javascript
testPathIgnorePatterns: [
  '/tests/integration/',  // Fake timer conflicts
  ...(process.env.CI ? [
    '/electron/services/__tests__/',  // EventEmitter/setTimeout
    '/electron/__tests__/',  // IPC handlers with native dependencies
  ] : []),
],
testTimeout: 30000,  // Global 30-second timeout
```

### 2. CI Workflow Changes (.github/workflows/ci.yml)
```yaml
run: npm test -- --silent --maxWorkers=2 --workerIdleMemoryLimit=512MB --forceExit
```

### 3. Individual Test File Skips
- `electron/services/__tests__/nativeModules.test.ts` - `describe.skip` in CI
- `electron/services/__tests__/syncOrchestrator.test.ts` - `describe.skip` in CI
- `src/components/__tests__/ContactSelectModal.test.tsx` - excluded via testPathIgnorePatterns in CI

---

## Testing Gaps to Address

### 1. SQLite/Native Modules - Risk: Medium-High

**What's Not Tested in CI:**
- `nativeModules.test.ts` - SQLite driver loading and version compatibility

**Current Mitigation:**
- CI runs `node scripts/rebuild-native.js` which rebuilds for Electron
- Downstream tests (transaction, contact tests) would fail if SQLite broken

**TODO:**
- [ ] Add dedicated SQLite health check to CI build step
- [ ] Consider adding SQLite smoke test that works with Node.js (not Electron-specific)
- [ ] Document manual testing requirements for native module changes

**Estimated Effort:** 2-3 turns

---

### 2. SyncOrchestrator (Windows iPhone Sync) - Risk: Low-Medium

**What's Not Tested in CI:**
- `syncOrchestrator.test.ts` - Full sync workflow orchestration
- `backupService.test.ts` - iPhone backup creation
- Device detection, backup decryption, message parsing pipeline

**Current Mitigation:**
- Windows-only feature with limited user base
- Individual components have unit tests that do run
- CI doesn't have iPhone devices anyway

**TODO:**
- [ ] Refactor mock implementations to use proper timer cleanup
- [ ] Consider extracting timer-dependent logic into separate, testable units
- [ ] Add smoke tests if Windows user adoption increases
- [ ] Document manual testing requirements for iPhone sync changes

**Estimated Effort:** 8-12 turns (mock refactoring is complex)

---

### 3. Integration Tests (/tests/integration/) - Risk: Medium

**What's Not Tested in CI:**
- E2E user journey tests
- Cross-component integration flows
- State machine transition tests

**Current Mitigation:**
- Unit tests cover same components individually
- Component tests validate UI behavior

**TODO:**
- [ ] Create separate CI job with longer timeout (15-30 min)
- [ ] OR run integration tests as nightly/weekly build
- [ ] Refactor tests to avoid `jest.useFakeTimers()` at module level
- [ ] Use `jest.useFakeTimers({ advanceTimers: true })` for auto-advancing

**Estimated Effort:** 6-10 turns

---

### 4. Electron Handler Tests (/electron/__tests__/) - Risk: Low-Medium

**What's Not Tested in CI:**
- IPC handler unit tests
- Auth handler flow tests
- System handler tests

**Current Mitigation:**
- Most handlers are thin wrappers around services
- Service tests provide coverage of core logic

**TODO:**
- [ ] Identify which handlers have unique logic (not just service delegation)
- [ ] Extract testable logic from handlers into services where appropriate
- [ ] Ensure mock infrastructure doesn't use EventEmitter patterns

**Estimated Effort:** 4-6 turns

---

### 5. ContactSelectModal Test - Risk: Low

**What's Not Tested in CI:**
- `src/components/__tests__/ContactSelectModal.test.tsx` - Contact selection modal component tests

**Issue Discovered:**
- Test hangs during the **loading phase** (not execution) specifically in CI
- All other frontend tests run fine; only this specific file triggers the hang
- Root cause unknown - suspected module resolution or Jest worker initialization issue
- Test works perfectly fine locally with identical configuration

**Current Mitigation:**
- Component is well-covered by related tests (Contacts.test.tsx, TransactionContacts tests)
- The modal uses standard patterns also tested in AuditTransactionModal tests
- Excluded only in CI; runs locally for developers

**TODO:**
- [ ] Investigate Jest worker initialization differences in CI vs local
- [ ] Check if specific imports in this file cause issues (lazy loading, circular deps)
- [ ] Try running with --runInBand in CI to isolate worker-related issues
- [ ] Consider splitting into smaller test files to isolate problematic import

**Estimated Effort:** 3-5 turns (primarily investigation)

---

## Long-Term Solutions

### A. Mock Infrastructure Overhaul
Refactor all EventEmitter-based mocks to:
1. Use Jest's built-in mock functions instead of custom classes
2. Clear all timers in `afterEach` hooks
3. Remove `removeAllListeners()` patterns (not needed with proper mocks)

### B. Test Environment Strategy
1. Use `testEnvironment: 'node'` for electron tests (currently using jsdom)
2. Create separate Jest projects for frontend vs backend tests
3. Consider using electron-mock for handler tests

### C. Native Module Testing
1. Add prebuild check script that validates binaries before test run
2. Skip native tests gracefully with clear messaging
3. Add CI step that validates native rebuild succeeded

---

## Acceptance Criteria

- [ ] All testing gaps have documented alternative coverage strategies
- [ ] Each excluded test category has manual testing procedures documented
- [ ] Mock infrastructure refactored to not cause Jest hangs
- [ ] Integration tests run in CI (either on every PR or nightly)
- [ ] Native module tests have health check in CI build step

---

## References

- TASK-704 implementation (attach/unlink messages feature)
- PR #255 (where CI issues were discovered)
- jest.config.js (current exclusion patterns)
- .github/workflows/ci.yml (current workarounds)

---

## Risk Summary

| Category | Risk Level | Coverage Gap | Mitigation Quality |
|----------|------------|--------------|-------------------|
| SQLite/Native | Medium-High | Native module loading | Good (rebuild step + downstream tests) |
| SyncOrchestrator | Low-Medium | Windows iPhone sync | Acceptable (Windows-only, limited users) |
| Integration | Medium | E2E flows | Moderate (unit tests cover components) |
| Electron Handlers | Low-Medium | IPC handlers | Good (handlers are thin wrappers) |
| ContactSelectModal | Low | Modal component test | Good (related tests cover same patterns) |

**Overall Assessment:** Current workarounds are acceptable for shipping TASK-704. Long-term fixes should be scheduled in a future sprint focused on testing infrastructure.
