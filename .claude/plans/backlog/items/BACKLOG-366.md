# BACKLOG-366: Verify TransactionStatus Type/Schema Alignment

**Created**: 2026-01-21
**Priority**: Critical
**Category**: Bug / Data Integrity
**Status**: Pending (Needs Verification)
**Source**: SR Engineer Database Audit (ISSUE-003)

---

## Problem Statement

The SR Engineer audit flagged a potential mismatch between TypeScript `TransactionStatus` type and the database CHECK constraint.

**Audit Finding:** TypeScript allows `"archived"` status but schema doesn't include it.

## Current State (Needs Verification)

### TypeScript Definition (transactionService.ts:18)
```typescript
export type TransactionStatus = "pending" | "active" | "closed" | "rejected";
```

### Schema CHECK Constraint (schema.sql:307)
```sql
status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'closed', 'rejected'))
```

**Based on current code inspection:** Both appear to match. No `"archived"` status found in either.

## Investigation Required

1. Verify if there's another TypeScript file with different TransactionStatus definition
2. Check if any UI component references "archived" status
3. Verify runtime database state vs schema file
4. Determine if "archived" was planned but not implemented

## Potential Issues If Mismatch Exists

- TypeScript may allow setting a status that fails at database level
- Runtime errors when trying to archive transactions
- Inconsistent state between UI and database

## Acceptance Criteria

- [ ] Confirm TypeScript type matches schema CHECK constraint
- [ ] If mismatch found: align both to same set of valid statuses
- [ ] Add "archived" to both if feature is needed
- [ ] Update any UI components that reference invalid statuses

## Estimation

- **Category:** investigation / fix
- **Estimated Tokens:** ~2K (investigation), ~3K (fix if needed)
- **Risk:** Low if already aligned, Medium if changes needed

## Notes

Initial investigation shows both TypeScript and schema use the same values:
- pending
- active
- closed
- rejected

The audit finding may have been based on outdated code or a planned feature. Recommend quick verification before closing.

## Related

- BACKLOG-296 (FINDING-13): CHECK constraint inconsistencies
- transactionService.ts: TypeScript type definition
- TransactionStatusWrapper.tsx: UI status component
