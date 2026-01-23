# BACKLOG-423: Fix Transactions.test.tsx Missing Mock

**Created**: 2026-01-23
**Priority**: Medium
**Category**: Test
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

The `Transactions.test.tsx` file is failing because it doesn't mock the `transactions.onSubmissionStatusChanged` function used by `useSubmissionSync` hook.

## Error

```
TypeError: transactions.onSubmissionStatusChanged is not a function

at src/hooks/useSubmissionSync.ts:66:38
```

## Solution

Update the test mock in `Transactions.test.tsx` to include:

```typescript
// In the mock setup
onSubmissionStatusChanged: jest.fn().mockReturnValue(() => {}),
```

## Files to Modify

- `src/components/__tests__/Transactions.test.tsx`

## Acceptance Criteria

- [ ] Test mock includes `onSubmissionStatusChanged`
- [ ] All Transactions tests pass
- [ ] CI passes

## Related

- useSubmissionSync.ts hook
- SPRINT-050 submission sync feature
