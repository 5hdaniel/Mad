# TASK-1792: Add Idempotency Check to iPhone Contact Migration

**Backlog ID:** BACKLOG-595
**Sprint:** SPRINT-068 (Follow-up / Post-Review)
**Phase:** Post-Implementation Database Optimization
**Branch:** Follow branch pattern from current work
**Estimated Tokens:** ~3K
**Priority:** LOW

---

## Objective

Add idempotency check to migration 27b to prevent wasteful re-processing of already-migrated iPhone contacts on repeated migration runs.

---

## Context

**Current Implementation (Issue):**
- Migration 27b migrates existing iPhone contacts from `contacts` to `external_contacts` with `source='iphone'`
- Does not check if iPhone contacts already migrated in a previous run
- Uses `INSERT OR IGNORE` to prevent data duplication (works, but inefficient)
- Re-scans and attempts to insert same records every time migration runs
- Not a data integrity issue, but inefficient

**Impact:**
- Migration slower than necessary on re-run (unnecessary table scans)
- More SQL work than needed
- Inconsistent with idempotent migration best practices

**SR Engineer Recommendation:**
"Add check for existing `source='iphone'` records before migrating"

---

## Requirements

### Must Do:
1. Check if any `external_contacts` records with `source='iphone'` already exist
2. If migration previously ran, skip re-processing
3. Log that migration was skipped (already complete)

### Must NOT Do:
- Break existing data migration logic
- Modify INSERT OR IGNORE behavior (keep safety net)
- Change final data state

---

## Acceptance Criteria

- [ ] Migration checks for existing `source='iphone'` records
- [ ] If records found, migration skips processing (logs completion)
- [ ] If no records found, migration proceeds normally
- [ ] Data integrity unchanged
- [ ] All existing tests pass

---

## Files to Modify

- `electron/services/databaseService.ts` (migration 27b, around lines 1100-1128)

## Files to Reference

- Migration 27 logic (understanding the schema)
- Other idempotent migration patterns in codebase

---

## Testing Expectations

### Manual Testing (Primary)
1. Run migrations once → observe migration 27b completes
2. Run migrations again → observe migration 27b skips (logs message)
3. Verify data unchanged in both cases

### Unit Tests
- **Recommended:** Mock migration run and verify idempotency check
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## Technical Implementation

### Check Pattern
```sql
-- Add at start of migration 27b:
SELECT COUNT(*) FROM external_contacts WHERE source = 'iphone'
-- If count > 0, skip migration, log message
-- If count = 0, proceed with migration
```

### Example Logic Flow
```typescript
async function migration_27b() {
  // Check if already migrated
  const existingCount = await db.query(
    "SELECT COUNT(*) as count FROM external_contacts WHERE source = 'iphone'"
  );

  if (existingCount > 0) {
    console.log('Migration 27b already completed, skipping...');
    return;
  }

  // Proceed with original migration logic
  await migrateIPhoneContacts();
}
```

---

## PR Preparation

- **Title:** `chore(db): add idempotency check to iPhone contact migration 27b`
- **Target:** `develop`
- **Related PR:** #716 (SPRINT-068 original work)

---

## Guardrails

**STOP and ask PM if:**
- Logic would break existing migrations
- Estimate exceeds 5K tokens

**OK to skip if:**
- Migration performance is acceptable
- No complaints about slow re-runs

---

## Implementation Status

**STATUS: PENDING**

Awaiting engineer assignment from PM. This is a direct SR Engineer follow-up recommendation from PR #716 review. **LOW PRIORITY** - can be deferred if sprint capacity limited.

