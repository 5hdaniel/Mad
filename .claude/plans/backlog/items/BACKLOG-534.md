# BACKLOG-534: Fix Fail-Open Security Patterns in Supabase Service

**Created**: 2026-01-27
**Priority**: P1 - High Security
**Category**: Security
**Status**: Pending

---

## Problem Statement

Two critical security functions return `allowed: true` when errors occur, effectively disabling security checks on failure.

### Affected Functions

**1. `checkDeviceLimit()` - Line ~671**
```typescript
// Current (BAD)
catch (error) {
    console.error('Device limit check failed:', error);
    return { allowed: true }; // SECURITY BUG: Fails open
}
```

**2. `checkApiLimit()` - Line ~788**
```typescript
// Current (BAD)
catch (error) {
    console.error('API limit check failed:', error);
    return { allowed: true }; // SECURITY BUG: Fails open
}
```

## Security Risk

**Severity**: High

- Device limits can be bypassed by causing errors (e.g., network issues)
- API rate limits can be bypassed by causing errors
- Attackers could intentionally trigger errors to bypass restrictions
- Legitimate license enforcement is undermined

## Security Principle Violated

**Fail-Closed (Fail-Secure)**: Security controls should deny access when they cannot make a determination. This is a fundamental security principle.

## Solution

### Change to Fail-Closed Pattern

```typescript
// CORRECT (Fail-Closed)
catch (error) {
    console.error('Device limit check failed:', error);
    return {
        allowed: false,
        reason: 'Unable to verify device limit. Please try again.',
        error: true  // Flag for UI to show retry option
    };
}
```

### Also Consider

1. **Retry Logic**: Add automatic retry with backoff before failing
2. **Caching**: Cache last-known-good state for brief offline periods
3. **Graceful Degradation**: Allow limited functionality during outages

```typescript
async checkDeviceLimit(): Promise<DeviceLimitResult> {
    const MAX_RETRIES = 3;
    const BACKOFF_MS = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // ... check logic
            return { allowed: result.allowed, reason: result.reason };
        } catch (error) {
            if (attempt < MAX_RETRIES) {
                await sleep(BACKOFF_MS * attempt);
                continue;
            }
            // All retries failed - fail closed
            return {
                allowed: false,
                reason: 'Service temporarily unavailable',
                retryable: true
            };
        }
    }
}
```

## Acceptance Criteria

- [ ] `checkDeviceLimit()` returns `allowed: false` on error
- [ ] `checkApiLimit()` returns `allowed: false` on error
- [ ] Retry logic added before failing
- [ ] UI shows appropriate message when check fails
- [ ] Unit tests cover error scenarios

## Estimated Effort

~15K tokens (code changes + comprehensive testing)

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/supabaseService.ts` | Fix both functions |
| `src/components/*` | Update UI to handle retry scenarios |
| `electron/services/__tests__/supabaseService.test.ts` | Add error case tests |
