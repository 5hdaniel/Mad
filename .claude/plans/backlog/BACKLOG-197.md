# BACKLOG-197: Enable Stricter TypeScript Rules

## Summary

Enable `noUnusedLocals` and `noUnusedParameters` in TypeScript config once `any` types are cleaned up.

## Problem

The codebase has unused variables and parameters that:
- Create noise in the code
- May indicate incomplete refactoring
- Can hide bugs (variables set but never read)

TypeScript's strict mode rules can catch these issues at compile time.

## Current State

Rules currently disabled in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

## Prerequisites

Before enabling these rules:
1. **BACKLOG-115 must be complete** - Clean up `any` types first
2. Codebase must compile cleanly with current rules

## Proposed Solution

### Phase 1: Dry Run
1. Temporarily enable rules
2. Document all violations
3. Assess scope of cleanup

### Phase 2: Fix Violations
1. Remove genuinely unused variables
2. Prefix intentionally unused params with underscore: `_param`
3. Use destructuring to ignore unused properties

### Phase 3: Enable Rules
1. Update `tsconfig.json`
2. Add to CI checks
3. Document convention for unused params

### Example Fixes

```typescript
// BEFORE - unused local
function process(data: Data) {
  const temp = data.value; // Never used
  return data.processed;
}

// AFTER - removed
function process(data: Data) {
  return data.processed;
}

// BEFORE - unused parameter
function handler(event: Event, context: Context) {
  return event.type;
}

// AFTER - prefix unused
function handler(event: Event, _context: Context) {
  return event.type;
}
```

## Acceptance Criteria

- [ ] `noUnusedLocals: true` enabled
- [ ] `noUnusedParameters: true` enabled
- [ ] All violations fixed
- [ ] CI passes with new rules
- [ ] Convention documented for underscore prefix

## Priority

**LOW** - Code hygiene improvement

## Estimate

~25K tokens (depends on violation count)

## Category

config/infra

## Impact

- Cleaner codebase
- Catches incomplete refactoring
- Prevents unused variable bugs

## Dependencies

- **BLOCKER**: BACKLOG-115 (Address any types) should be complete first
  - Fixing `any` types often creates unused variables
  - Doing both at once is more efficient

## Related Items

- BACKLOG-115: Address Remaining any Types in Electron Handlers
