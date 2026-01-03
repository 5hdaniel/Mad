# BACKLOG-140: Duplicate Transaction Re-Import Prevention

**Priority:** High
**Category:** service
**Status:** Pending
**Created:** 2026-01-03
**Sprint:** Unassigned

---

## Problem

When running transaction detection/import (e.g., "Auto Detect" or scanning for new transactions), the system is re-downloading and re-importing transactions that were already imported previously. This creates duplicate entries or wastes processing time checking transactions that already exist.

## Expected Behavior

The transaction import process should:
1. Check if a transaction already exists before importing
2. Skip transactions that have already been imported
3. Only import genuinely new transactions

## Potential Root Causes

1. **Missing deduplication check** - Import logic doesn't check for existing transactions
2. **Identifier mismatch** - The uniqueness check uses different identifiers than what's stored
3. **Timestamp-based logic error** - "Last imported" timestamp not being used/updated correctly
4. **Batch import issue** - Bulk imports not checking against existing records

## Investigation Steps

1. Review transaction import flow in:
   - `electron/services/transactionService.ts`
   - `electron/services/transactionDbService.ts`
   - Any related import/sync services

2. Check for existing deduplication logic:
   - What fields are used for uniqueness? (ID, date, amount, etc.)
   - Is there a "last sync" timestamp being tracked?

3. Verify database schema:
   - Are unique constraints in place?
   - Is there an import timestamp column?

## Acceptance Criteria

- [ ] Transaction import skips already-imported transactions
- [ ] No duplicate transaction entries created
- [ ] Import process is efficient (doesn't re-process old data)
- [ ] Logging shows when transactions are skipped (for debugging)

## Notes

Reported during SPRINT-019 manual testing. User observed "downloading duplicates old transactions that were already imported" when using the transaction detection feature.

---

## Related

- BACKLOG-013: Duplicate Transaction Detection (may be related - detection vs prevention)
- BACKLOG-139: Database Init Gate (discovered during same testing session)
