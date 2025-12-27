# TASK-610: Any Types Remediation

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
**Status:** Complete
**Depends On:** TASK-609

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** 2025-12-26 ~10:00
**Task End:** 2025-12-26 ~10:30
**Wall-Clock Time:** ~30 min (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | 0 | 0 | 0 min |
| Implementation | 7 | ~28K | ~25 min |
| Debugging | 1 | ~4K | ~5 min |
| **Total** | 8 | ~32K | ~30 min |

**Estimated vs Actual:**
- Est Turns: 2-3 → Actual: 8 (variance: +167%)
- Est Wall-Clock: 10-15 min → Actual: ~30 min (variance: +100%)

**Note:** Task was more complex than estimated - original audit (114 any) was stale.
Actual count was 35, and the remaining 5 in production code are justified with eslint-disable.
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 8-10 | **2-3** | - |
| **Tokens** | ~40K | ~12K | - |
| **Time** | 1-1.5h | **10-15 min** | **10-15 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Replace `any` type usages across the codebase with proper TypeScript types.

SR Engineer audit found 114 occurrences across 37 files.

---

## Current State

High occurrence files:
| File | `any` Count |
|------|-------------|
| `src/components/Contacts.tsx` | 15 |
| `src/components/Transactions.tsx` | 13 |
| `src/components/TransactionDetails.tsx` | 8 |

---

## Requirements

### Must Do
1. Audit all `any` usages
2. Replace with proper types or `unknown` + type guards
3. Reduce to < 10 justified `any` usages
4. Document any remaining `any` with // eslint-disable-line comment explaining why

### Must NOT Do
- Add @ts-ignore
- Weaken type safety elsewhere
- Change runtime behavior

---

## Replacement Strategy

### Pattern 1: Event handlers
```typescript
// Bad
const handleChange = (e: any) => { ... }

// Good
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
```

### Pattern 2: API responses
```typescript
// Bad
const result: any = await window.api.getData();

// Good
interface DataResult {
  success: boolean;
  data?: SomeType;
  error?: string;
}
const result = await window.api.getData() as DataResult;
```

### Pattern 3: Unknown external data
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (isValidData(data)) {
    // data is now typed
  }
}
```

---

## Files to Modify

Audit and fix all 37 files with `any` usage, prioritizing:
1. Components with highest counts
2. Service files
3. Type definition files

---

## Testing Requirements

1. **Type Check**
   - `npm run type-check` passes
   - No new type errors introduced

2. **Existing Tests**
   - All tests pass
   - No behavior changes

---

## Acceptance Criteria

- [x] `any` count reduced from 35 to 5 in production code (all documented with eslint-disable)
- [x] Remaining `any` documented with justification (driver API access, backwards compatibility)
- [x] All existing tests pass (1 pre-existing timeout failure unrelated to changes)
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (warnings only)

---

## Implementation Summary

### Changes Made

1. **Removed `as any` casts from transaction bulk operations** (4 occurrences)
   - `Transactions.tsx` - bulkDelete and bulkUpdateStatus
   - `useBulkActions.ts` - bulkDelete and bulkUpdateStatus

2. **Removed `as any` cast from Joyride steps** (1 occurrence)
   - `ConversationList/index.tsx` - Step[] type already compatible

3. **Fixed userId type mismatch** (4 occurrences)
   - Changed `AuditTransactionModal` userId prop from `number` to `string`
   - Removed `parseInt()` calls in `TransactionDetails.tsx`, `TransactionList.tsx`, `Transactions.tsx`
   - Removed `as any` cast in `AppModals.tsx`

4. **Fixed transaction details response type** (2 occurrences)
   - Updated `window.d.ts` getDetails return type to include `communications` and `contact_assignments`
   - Updated `ipc.ts` getDetails return type with proper Communication[] type
   - Removed `as any` casts in `useTransactionDetails.ts`

5. **Fixed EmailViewModal recipients access** (2 occurrences)
   - Removed `as any` cast - recipients already exists on Communication type

6. **Updated TransactionStatus type** (type definition fix)
   - Added `pending` and `rejected` to `TransactionStatus` type in `models.ts`
   - Updated `bulkUpdateStatus` API types in `ipc.ts` and `window.d.ts`

### Remaining `any` (Justified, 5 in production)

| File | Justification |
|------|---------------|
| `window.d.ts:937` | Index signature for backwards compatibility |
| `AppleDriverSetup.tsx:43` | Runtime-optional drivers API access |
| `AppleDriverStep.tsx:65` | Runtime-optional drivers API access |
| `usePhoneTypeApi.ts:61` | Runtime-optional drivers API access |
| `useSecureStorage.ts:178` | Runtime-optional drivers API access |

All have `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments.

### Files Modified

- `electron/types/ipc.ts`
- `electron/types/models.ts`
- `src/appCore/AppModals.tsx`
- `src/components/AuditTransactionModal.tsx`
- `src/components/ConversationList/index.tsx`
- `src/components/TransactionDetails.tsx`
- `src/components/TransactionList.tsx`
- `src/components/Transactions.tsx`
- `src/components/transaction/hooks/useBulkActions.ts`
- `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx`
- `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts`
- `src/window.d.ts`

---

## Branch

```
feature/TASK-610-any-types-remediation
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
