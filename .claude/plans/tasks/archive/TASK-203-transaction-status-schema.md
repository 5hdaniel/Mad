# Task TASK-203: Fix transactions.status Schema Mismatch

## Goal

Normalize the `transactions.status` column to only accept canonical values (`active`, `closed`, `archived`), eliminating legacy values and adding database-level validation.

## Non-Goals

- Do NOT add new status values
- Do NOT change the TransactionStatus TypeScript type
- Do NOT modify transaction UI beyond status display
- Do NOT change transaction creation flow logic

## Deliverables

1. New file: `electron/database/migrations/normalize_transaction_status.sql`
2. Update: `electron/services/db/transactionDbService.ts`
3. Update: `electron/services/databaseService.ts` (add CHECK constraint migration)
4. Update: Any components with hardcoded status strings

## Acceptance Criteria

- [ ] Migration normalizes all existing status values
- [ ] Database CHECK constraint enforces valid values
- [ ] `createTransaction` validates before insert (no runtime mapping)
- [ ] `updateTransaction` validates before update
- [ ] API rejects invalid status values with clear error
- [ ] No legacy `transaction_status` field in write paths
- [ ] All existing tests pass
- [ ] New tests verify status validation

## Implementation Notes

### Status Value Mapping

```
Legacy Value    ->  Canonical Value
-----------------------------------------
"completed"     ->  "closed"
"pending"       ->  "active"
"open"          ->  "active"
null/undefined  ->  "active"
"cancelled"     ->  "archived"
```

### Migration Script

```sql
-- Migration: normalize_transaction_status.sql

-- Step 1: Normalize existing data
UPDATE transactions SET status = 'closed' WHERE status = 'completed';
UPDATE transactions SET status = 'active' WHERE status = 'pending';
UPDATE transactions SET status = 'active' WHERE status = 'open';
UPDATE transactions SET status = 'active' WHERE status IS NULL OR status = '';
UPDATE transactions SET status = 'archived' WHERE status = 'cancelled';

-- Step 2: Verify no invalid values remain
-- SELECT DISTINCT status FROM transactions;
-- Should only show: active, closed, archived

-- Step 3: Add CHECK constraint (SQLite requires table recreation or check in app)
-- Note: SQLite doesn't support ADD CONSTRAINT, so we enforce in application layer
```

### Service Layer Changes

**transactionDbService.ts - createTransaction:**
```typescript
// Remove the runtime mapping function (lines 46-55)
// Replace with validation:

const VALID_STATUSES = ['active', 'closed', 'archived'] as const;

function validateTransactionStatus(status: unknown): TransactionStatus {
  const normalized = status || 'active';
  if (!VALID_STATUSES.includes(normalized as TransactionStatus)) {
    throw new DatabaseError(
      `Invalid transaction status: "${status}". Valid values: ${VALID_STATUSES.join(', ')}`
    );
  }
  return normalized as TransactionStatus;
}

// In createTransaction:
const validatedStatus = validateTransactionStatus(
  transactionData.status || transactionData.transaction_status
);
```

**transactionDbService.ts - updateTransaction:**
```typescript
// Add validation when status is in updates:
if (updates.status) {
  updates.status = validateTransactionStatus(updates.status);
}
```

### Type Clarification (models.ts)

The type is already correct:
```typescript
export type TransactionStatus = "active" | "closed" | "archived";
```

Remove or clearly deprecate:
```typescript
/** @deprecated Use status field with TransactionStatus type */
transaction_status?: string;
```

## Integration Notes

- Imports from: `electron/types/models.ts` (TransactionStatus)
- Exports to: Transaction handlers, UI
- Used by: Transaction list, transaction detail, status filters
- Depends on: None
- Parallel with: TASK-202 (can run simultaneously)

## Do / Don't

### Do:
- Audit existing data before migration
- Log any unexpected status values found
- Provide clear validation error messages
- Test status filter queries after migration

### Don't:
- Silently drop unknown status values (log them first)
- Remove the deprecated field immediately (keep readable)
- Change the canonical value set
- Break existing transaction filtering

## When to Stop and Ask

- If migration finds status values not in the mapping table
- If more than 100 records need status normalization
- If transaction filtering breaks after migration
- If UI components hardcode status values beyond simple display

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `validateTransactionStatus` accepts valid values
  - `validateTransactionStatus` throws on invalid values
  - `createTransaction` uses validated status
  - `updateTransaction` validates status changes
- Existing tests to update:
  - Any test using legacy status values

### Coverage

- Coverage impact: Should not decrease

### Integration Tests

- Required scenarios:
  - Create transaction with each valid status
  - Filter transactions by status
  - Update transaction status

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(schema): normalize transactions.status enum values`
- **Labels**: `database`, `schema`, `tech-debt`
- **Depends on**: TASK-201 (workflow enforcement should be in place)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] Migration script

Files updated:
- [ ] transactionDbService.ts
- [ ] Any UI components with hardcoded status

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Migration tested on dev database
- [ ] Status filters work correctly
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
