# BACKLOG-192: Clean Up Console Statements (186 Remaining)

## Summary

Remove or replace 186 console statements throughout the codebase with structured logging or remove them entirely.

## Problem

Console statements in production code:
- Clutter production logs
- May expose sensitive information
- Make debugging harder (noise vs signal)
- Indicate incomplete development work

## Current State

| File | Count | Priority |
|------|-------|----------|
| `src/components/onboarding/steps/PermissionsStep.tsx` | 21 | High |
| `src/hooks/useAutoRefresh.ts` | 13 | High |
| `src/components/Settings.tsx` | 12 | High |
| Other files | 140 | Medium |
| **Total** | 186 | - |

## Proposed Solution

### Phase 1: High-Priority Files (3 files, 46 statements)
Focus on the files with the most console statements first.

### Phase 2: Remaining Files
Process remaining 140 statements across the codebase.

### Approach for Each Statement

1. **Debug logging** (e.g., `console.log('data:', data)`) - Remove
2. **Error logging** (e.g., `console.error(err)`) - Keep or convert to proper error handling
3. **Development markers** (e.g., `console.log('TODO')`) - Address the TODO or remove
4. **Conditional logging** - Consider keeping with production guard

### Example Conversions

```typescript
// BEFORE
console.log('User logged in:', user);

// AFTER (remove if not needed in prod)
// OR use structured logging if app has logging service:
logger.info('User logged in', { userId: user.id });
```

## Acceptance Criteria

- [ ] Console statements reduced from 186 to <20
- [ ] Remaining statements are intentional error logging
- [ ] No functionality broken by removals
- [ ] All tests pass

## Priority

**MEDIUM** - Affects production debugging and code quality

## Estimate

~30K tokens

## Category

refactor

## Impact

- Cleaner production logs
- Better debugging experience
- Reduced risk of information exposure

## Notes

BACKLOG-065 (Remove Console Statements) was marked complete in SPRINT-009, but this is a fresh audit showing 186 still remain. This may be due to new code added since then, or the original cleanup was partial.
