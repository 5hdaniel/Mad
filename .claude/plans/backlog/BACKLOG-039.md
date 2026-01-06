# BACKLOG-039: Schema Mismatch transactions.status

**Priority:** Critical
**Type:** Technical Debt / Data Integrity
**Created:** 2025-12-16
**Sprint:** SPRINT-003 (Phase 2)

---

## Problem Statement

The `transactions.status` column accepts values that don't match the TypeScript enum. Legacy values like "completed" and "pending" are used in some code paths while the canonical values are "active", "closed", "archived".

This causes:
1. Inconsistent data in the database
2. Filter queries failing to match records
3. UI status badges showing unexpected states
4. Runtime type mismatches

---

## Technical Analysis

### Current State

**Type Definition** (`electron/types/models.ts`):
```typescript
export type TransactionStatus = "active" | "closed" | "archived";

export interface Transaction {
  status: TransactionStatus;
  /** @deprecated Use status instead */
  transaction_status?: string;
}
```

**Workaround Code** (`transactionDbService.ts`):
```typescript
// Lines 46-55: Mapping in createTransaction
status: (() => {
  const rawStatus = transactionData.transaction_status || transactionData.status || "active";
  if (rawStatus === "completed") return "closed";
  if (rawStatus === "pending") return "active";
  if (["active", "closed", "archived"].includes(rawStatus)) return rawStatus;
  return "active";
})(),
```

### Problem Scope

**Values in use:**
- Canonical: `"active"`, `"closed"`, `"archived"`
- Legacy: `"completed"`, `"pending"`, `"open"` (possibly others)

**Affected code paths:**
- `transactionDbService.ts` - createTransaction, updateTransaction
- `transactionService.ts` - May have additional mappings
- API handlers - May accept legacy values
- UI components - May display unmapped values

---

## Acceptance Criteria

- [ ] Database CHECK constraint enforces valid status values
- [ ] All existing data normalized to canonical values
- [ ] `createTransaction` validates status before insert
- [ ] `updateTransaction` validates status before update
- [ ] API layer rejects invalid status values with clear error
- [ ] UI status selectors only offer valid options
- [ ] Migration script normalizes all existing records
- [ ] Legacy `transaction_status` field removed from write paths
- [ ] All tests pass with strict status validation

---

## Implementation Approach

### Phase 1: Data Migration
1. Query for non-canonical status values
2. Create mapping script for legacy -> canonical
3. Execute update migration
4. Verify all records have valid status

### Phase 2: Add Database Constraint
1. Add CHECK constraint to transactions.status
2. Only allow: 'active', 'closed', 'archived'

### Phase 3: Service Layer Hardening
1. Remove runtime mapping from createTransaction
2. Add validation function with clear error messages
3. Update updateTransaction to validate
4. Remove deprecated `transaction_status` from write paths

### Phase 4: API/UI Alignment
1. Update API handlers to validate before service call
2. Ensure UI dropdowns use canonical values
3. Update any hardcoded strings

---

## Estimated Effort

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Data Migration | 3-4 | ~15K | 20m |
| Database Constraint | 2-3 | ~10K | 15m |
| Service Layer | 3-5 | ~15K | 25m |
| API/UI Updates | 2-3 | ~10K | 15m |
| **Total** | **10-15** | **~50K** | **~1.5h** |

---

## Status Value Mapping

| Legacy Value | Canonical Value | Rationale |
|--------------|-----------------|-----------|
| "completed" | "closed" | Transaction finished |
| "pending" | "active" | Transaction in progress |
| "open" | "active" | Transaction in progress |
| "cancelled" | "archived" | Transaction no longer active |
| null/undefined | "active" | Default for new transactions |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing data with unknown values | High | Audit before migration, map all found values |
| CHECK constraint blocks inserts | Medium | Ensure all write paths validated first |
| UI shows wrong status | Low | Test UI after migration |

---

## Dependencies

- None (can be done in parallel with BACKLOG-038)

---

## Testing Requirements

### Unit Tests
- `createTransaction` rejects invalid status
- `createTransaction` accepts all valid statuses
- `updateTransaction` validates status
- Status validation error messages are clear

### Integration Tests
- Transaction list filters correctly by status
- Status badge displays correct text

### Migration Tests
- Run migration on test database with legacy values
- Verify all records have valid status after

---

## References

- Type definition: `electron/types/models.ts` (TransactionStatus type)
- Service implementation: `electron/services/db/transactionDbService.ts`
- Related: Transaction UI components
