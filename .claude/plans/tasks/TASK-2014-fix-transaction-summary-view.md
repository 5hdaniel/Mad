# TASK-2014: Fix transaction_summary view -- counts from wrong table

**Backlog ID:** BACKLOG-364
**Sprint:** SPRINT-088
**Phase:** Phase 1 (Parallel - schema only, no app code overlap)
**Branch:** `fix/task-2014-fix-transaction-summary-view`
**Estimated Tokens:** ~8K

---

## Objective

Fix the `transaction_summary` SQL view that counts participants from the deprecated `transaction_participants` table instead of the current `transaction_contacts` table. The view returns incorrect `participant_count` values because the active data is in `transaction_contacts`.

---

## Context

### Investigation Findings

- **File:** `electron/database/schema.sql` lines 1017-1032
- **Problem line 1030:** `(SELECT COUNT(*) FROM transaction_participants tp WHERE tp.transaction_id = t.id) as participant_count`
- **Should reference:** `transaction_contacts` instead of `transaction_participants`
- **Both tables exist in schema:** `transaction_participants` (line 469) and `transaction_contacts` (line 504)
- **Active table:** `transaction_contacts` is the one the app writes to (has `role_category`, `specific_role`, `is_primary` columns not present in the deprecated table)
- **Deprecated table:** `transaction_participants` is a legacy table that may contain stale or no data

### Schema Evidence

The `transaction_contacts` table (line 504) has richer schema:
- `role_category`, `specific_role`, `is_primary` columns
- Indexes for role, specific_role, category, primary (lines 777-782)
- Update trigger (line 846)

The `transaction_participants` table (line 469) is simpler, legacy:
- Only `role` column (no category/specific_role)
- Basic indexes only (lines 772-774)
- Update trigger (line 840)

---

## Requirements

### Must Do

1. **Create a migration** (NOT modify schema.sql directly) that drops and recreates the `transaction_summary` view with `transaction_contacts` instead of `transaction_participants`
2. **Also update schema.sql** so the canonical schema matches the migration
3. **Verify the column alias** stays as `participant_count` (or rename to `contact_count` if that is what the app expects -- check consumers)
4. **Check all consumers** of the `transaction_summary` view to ensure the column name is expected

### Migration SQL (Approximate)

```sql
DROP VIEW IF EXISTS transaction_summary;
CREATE VIEW IF NOT EXISTS transaction_summary AS
SELECT
  t.id,
  t.user_id,
  t.property_address,
  t.transaction_type,
  t.status,
  t.stage,
  t.started_at,
  t.closed_at,
  t.message_count,
  t.attachment_count,
  t.confidence_score,
  (SELECT COUNT(*) FROM transaction_contacts tc WHERE tc.transaction_id = t.id) as participant_count,
  (SELECT COUNT(*) FROM audit_packages ap WHERE ap.transaction_id = t.id) as audit_count
FROM transactions t;
```

### Must NOT Do

- Do NOT drop or modify the `transaction_participants` table itself (may have data or be referenced elsewhere)
- Do NOT modify any application code unless a column name needs to change

### Acceptance Criteria

- [ ] `transaction_summary` view counts from `transaction_contacts`
- [ ] Migration file created in `electron/database/migrations/`
- [ ] `schema.sql` updated to match
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] App starts correctly (`npm run dev`)

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/database/schema.sql` | Update view definition (line 1030) |
| `electron/database/migrations/NNN_fix_transaction_summary_view.sql` | New migration file |
| `electron/services/databaseService.ts` | May need migration version bump (check migration runner) |

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| Agent ID | |
| Branch | |
| PR | |
| Files Changed | |
| Tests Added/Modified | |
| Actual Tokens | |
