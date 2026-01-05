# TASK-971: Delete Deprecated PermissionsScreen Component

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-159
**Status:** Ready
**Estimate:** ~10K tokens
**Token Cap:** 40K
**Depends On:** TASK-970

---

## Context

`PermissionsScreen.tsx` (873 lines) is marked `@deprecated` but still exists. The replacement `PermissionsStep.tsx` is already in use.

## Deliverables

1. **Verify replacement** - Confirm PermissionsStep.tsx handles all cases
2. **Find references** - Search for any imports of PermissionsScreen
3. **Delete file** - Remove `src/components/PermissionsScreen.tsx`
4. **Update imports** - Fix any broken references
5. **Test** - Verify onboarding permissions flow works

## Files

- `src/components/PermissionsScreen.tsx` - DELETE
- Any importing files - MODIFY

## Branch

```bash
git checkout -b fix/TASK-971-delete-permissionsscreen develop
```

## Verification Commands

```bash
# Find all references
grep -r "PermissionsScreen" src/

# Type check after deletion
npm run type-check

# Test onboarding
npm test -- --testPathPattern=onboarding
```

## Acceptance Criteria

- [ ] PermissionsScreen.tsx deleted
- [ ] No TypeScript errors
- [ ] No broken imports
- [ ] Onboarding tests pass

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 10K) / 10K × 100]_%
