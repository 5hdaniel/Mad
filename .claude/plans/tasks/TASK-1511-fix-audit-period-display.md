# TASK-1511: Fix Audit Period Not Showing After Transaction Creation

## Status: IMPLEMENTED - READY FOR TESTING

## Problem Statement

When a user creates a new transaction through the "Audit New Transaction" modal, the audit period (e.g., "Jan 1, 2026 - Ongoing") does not display immediately after creation. The workaround is to click Edit, then Save - after which the audit period appears correctly.

## Root Cause Analysis

**Root Cause Identified:** The `createTransaction` function in `transactionDbService.ts` does NOT include `started_at` and `closed_at` fields in its INSERT SQL statement.

**Investigation Findings:**

1. **UI Display Logic** (`TransactionDetailsTab.tsx` lines 73-81, 121):
   - The audit period only displays if `startDate` or `endDate` is present
   - `startDate` = `formatAuditDate(transaction.started_at)`
   - `endDate` = `formatAuditDate(transaction.closed_at)`
   - If both are null, `auditPeriodText` is null and nothing is rendered

2. **Data Flow Issue** (`transactionDbService.ts` lines 74-100):
   - The `createTransaction` INSERT only includes:
     ```sql
     id, user_id, property_address, property_street, property_city,
     property_state, property_zip, property_coordinates,
     transaction_type, status, closing_deadline
     ```
   - **`started_at` and `closed_at` are NOT included!**

3. **Why Edit/Save Works:**
   - `updateTransaction` function (lines 296-397) correctly includes `started_at` in its allowed fields list (line 309)
   - So when users click Edit and Save, the field gets written to the database

4. **Data Source Verification:**
   - The schema has both columns: `started_at DATETIME` and `closed_at DATETIME`
   - The `AuditedTransactionData` interface includes both fields
   - `createAuditedTransaction` passes both to `createTransaction`
   - But `createTransaction` ignores them!

## Implementation Steps

### Step 1: Update createTransaction SQL INSERT

**File:** `/Users/daniel/Documents/Mad-sprint-062-licensing/electron/services/db/transactionDbService.ts`

**Current Code (lines 74-100):**
```typescript
const sql = `
  INSERT INTO transactions (
    id, user_id, property_address, property_street, property_city,
    property_state, property_zip, property_coordinates,
    transaction_type, status, closing_deadline
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const params = [
  id,
  transactionData.user_id,
  transactionData.property_address,
  transactionData.property_street || null,
  transactionData.property_city || null,
  transactionData.property_state || null,
  transactionData.property_zip || null,
  transactionData.property_coordinates
    ? JSON.stringify(transactionData.property_coordinates)
    : null,
  transactionData.transaction_type || null,
  validatedStatus,
  transactionData.closing_deadline || null,
];
```

**Updated Code:**
```typescript
const sql = `
  INSERT INTO transactions (
    id, user_id, property_address, property_street, property_city,
    property_state, property_zip, property_coordinates,
    transaction_type, status, closing_deadline, started_at, closed_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const params = [
  id,
  transactionData.user_id,
  transactionData.property_address,
  transactionData.property_street || null,
  transactionData.property_city || null,
  transactionData.property_state || null,
  transactionData.property_zip || null,
  transactionData.property_coordinates
    ? JSON.stringify(transactionData.property_coordinates)
    : null,
  transactionData.transaction_type || null,
  validatedStatus,
  transactionData.closing_deadline || null,
  transactionData.started_at || null,
  transactionData.closed_at || null,
];
```

### Step 2: Add Unit Test

**File:** `/Users/daniel/Documents/Mad-sprint-062-licensing/electron/services/__tests__/databaseService.test.ts`

Add test case to verify `started_at` and `closed_at` are persisted during transaction creation:

```typescript
it('should persist started_at and closed_at when creating transaction', async () => {
  const testUser = await databaseService.createUser({
    email: 'test@example.com',
  });

  const transactionData = {
    user_id: testUser.id,
    property_address: '123 Test St',
    started_at: '2026-01-01',
    closed_at: '2026-06-01',
  };

  const transaction = await databaseService.createTransaction(transactionData);

  expect(transaction.started_at).toBe('2026-01-01');
  expect(transaction.closed_at).toBe('2026-06-01');

  // Also verify via fresh fetch
  const fetched = await databaseService.getTransactionById(transaction.id);
  expect(fetched?.started_at).toBe('2026-01-01');
  expect(fetched?.closed_at).toBe('2026-06-01');
});
```

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/db/transactionDbService.ts` | Add `started_at` and `closed_at` to INSERT SQL and params |
| `electron/services/__tests__/databaseService.test.ts` | Add unit test for date persistence |

## Acceptance Criteria

1. [ ] After creating a transaction through "Audit New Transaction", the audit period displays immediately without needing to edit/save
2. [ ] Both `started_at` and `closed_at` are saved to the database during creation
3. [ ] Existing edit/save functionality continues to work
4. [ ] Unit test passes verifying date field persistence
5. [ ] All existing tests pass

## Risk Assessment

**Risk Level:** LOW

- This is a straightforward data persistence fix
- No architectural changes required
- Change is isolated to a single INSERT statement
- Fix aligns with existing `updateTransaction` behavior
- Database schema already supports these fields

## Related Items

- **Backlog:** BACKLOG-543 (Audit Period Not Showing)
- **Related Task:** TASK-1013 (Transaction Date Range) - dates are displayed correctly, just not saved on creation

## SR Engineer Review Notes

**Review Date:** (pending)
**Status:** READY FOR IMPLEMENTATION

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1511-audit-period-create

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `transactionDbService.ts` (isolated to createTransaction function)
- Conflicts with: None expected

### Technical Considerations
- Simple parameter addition to SQL INSERT
- No migration needed (columns already exist)
- No state machine changes
- No IPC changes
