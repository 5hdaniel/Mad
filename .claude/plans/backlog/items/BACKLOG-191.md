# BACKLOG-191: Add Test Coverage for Core Service Layer

## Summary

Add test coverage for the core service layer files that currently have 0% coverage: `authService.ts`, `transactionService.ts`, `systemService.ts`, and `deviceService.ts` (781 lines total).

## Problem

The service layer contains critical business logic with no test coverage:
- `src/services/authService.ts` - Authentication logic
- `src/services/transactionService.ts` - Transaction management
- `src/services/systemService.ts` - System operations
- `src/services/deviceService.ts` - Device management

These services abstract `window.api` calls and contain business logic that should be tested to prevent regressions.

## Current State

| File | Lines | Coverage |
|------|-------|----------|
| `authService.ts` | ~150 | 0% |
| `transactionService.ts` | ~250 | 0% |
| `systemService.ts` | ~180 | 0% |
| `deviceService.ts` | ~200 | 0% |
| **Total** | ~781 | 0% |

## Proposed Solution

Create unit tests for each service file with proper mocking of `window.api`:

1. **authService.test.ts** - Test login, logout, session restore, token refresh
2. **transactionService.test.ts** - Test CRUD operations, status changes, validation
3. **systemService.test.ts** - Test platform detection, file operations, export
4. **deviceService.test.ts** - Test device registration, sync status, backup

### Testing Approach

```typescript
// Mock window.api for service tests
jest.mock('../../preload', () => ({
  api: {
    auth: {
      login: jest.fn(),
      logout: jest.fn(),
      // ...
    }
  }
}));
```

## Acceptance Criteria

- [ ] All 4 service files have test coverage >60%
- [ ] Tests cover happy path and error cases
- [ ] Tests use proper mocking (no real IPC calls)
- [ ] All existing tests continue to pass
- [ ] No flaky tests introduced

## Priority

**CRITICAL** - Core business logic without coverage is high-risk

## Estimate

| Phase | Est. Tokens |
|-------|-------------|
| authService tests | ~25K |
| transactionService tests | ~35K |
| systemService tests | ~25K |
| deviceService tests | ~30K |
| **Total** | ~115K |

## Category

test

## Impact

- Prevents regression bugs in core business logic
- Enables safer refactoring of service layer
- Improves overall codebase confidence

## Dependencies

None - can be done independently

## Related Items

- BACKLOG-112: Boost Test Coverage for src/hooks/
- BACKLOG-113: Boost Test Coverage for src/utils/
