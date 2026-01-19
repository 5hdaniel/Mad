# BACKLOG-194: Add Test Coverage for Contexts

## Summary

Add test coverage for `AuthContext.tsx` and `NetworkContext.tsx` which are critical infrastructure with no dedicated tests.

## Problem

Context providers are foundational infrastructure that multiple components depend on:
- `src/contexts/AuthContext.tsx` - Authentication state, login/logout
- `src/contexts/NetworkContext.tsx` - Network connectivity detection

Without tests, changes to these contexts can silently break the entire application.

## Current State

| File | Approx Lines | Coverage | Consumers |
|------|--------------|----------|-----------|
| `AuthContext.tsx` | ~150 | 0% | ~20 components |
| `NetworkContext.tsx` | ~80 | 0% | ~10 components |

## Proposed Solution

Create comprehensive tests for each context:

### AuthContext Tests
- Initial state (logged out)
- Login flow (success and failure)
- Logout flow
- Session restoration
- Token refresh
- Error handling

### NetworkContext Tests
- Initial state detection
- Online/offline transitions
- Event listener cleanup
- Consumer hook behavior

### Testing Approach

```typescript
// Example: Testing AuthContext
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext', () => {
  it('should start in logged out state', () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should update state on login', async () => {
    // Mock window.api.auth.login
    // Test state transition
  });
});
```

## Acceptance Criteria

- [ ] AuthContext has >80% test coverage
- [ ] NetworkContext has >80% test coverage
- [ ] Tests cover all public API methods
- [ ] Tests cover error cases
- [ ] All existing tests pass
- [ ] No flaky tests

## Priority

**MEDIUM** - Critical path coverage

## Estimate

~40K tokens

## Category

test

## Impact

- Safer context modifications
- Prevents cascading failures
- Documents expected behavior

## Dependencies

None

## Related Items

- BACKLOG-112: Boost Test Coverage for src/hooks/
- BACKLOG-191: Add Test Coverage for Core Service Layer
