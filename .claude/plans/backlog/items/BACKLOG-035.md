# BACKLOG-035: Remove Orphaned Table

**Priority:** Critical
**Type:** Technical Debt / Database Cleanup
**Created:** 2025-12-16
**Sprint:** SPRINT-003 (Phase 2 - Final)

---

## Problem Statement

The database contains orphaned tables that are no longer used by the application:
- `extraction_metrics` - Created for ML feedback loop, never implemented
- `user_feedback` - Replaced by `ClassificationFeedback` model

These tables:
1. Add unnecessary database size
2. Cause confusion during schema review
3. Have foreign key relationships to active tables
4. May cause migration conflicts in future

---

## Technical Analysis

### Orphaned Tables

#### `extraction_metrics`
**Location:** Created in Migration 5 (`databaseService.ts:914`)
```sql
CREATE TABLE extraction_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  total_extractions INTEGER DEFAULT 0,
  confirmed_correct INTEGER DEFAULT 0,
  user_corrected INTEGER DEFAULT 0,
  completely_wrong INTEGER DEFAULT 0,
  avg_confidence INTEGER,
  high_confidence_count INTEGER DEFAULT 0,
  medium_confidence_count INTEGER DEFAULT 0,
  low_confidence_count INTEGER DEFAULT 0,
  period_start DATETIME,
  period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE
)
```
**Status:** Never used - planned for ML training metrics, not implemented
**Indexes:** `idx_extraction_metrics_user_id`, `idx_extraction_metrics_field`
**Trigger:** `update_extraction_metrics_timestamp`

#### `user_feedback`
**Location:** Created in Migration 5 (`databaseService.ts:894`)
```sql
CREATE TABLE user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  original_confidence INTEGER,
  feedback_type TEXT CHECK (feedback_type IN ('correction', 'confirmation', 'rejection')),
  source_communication_id TEXT,
  user_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_communication_id) REFERENCES communications(id) ON DELETE SET NULL
)
```
**Status:** Deprecated - `UserFeedback` type marked `@deprecated` in `models.ts`
**Indexes:** Multiple indexes exist
**Replacement:** `ClassificationFeedback` interface in models.ts (not yet implemented as table)

---

## Acceptance Criteria

- [ ] Codebase search confirms no active usage of these tables
- [ ] Database backup created before removal
- [ ] Migration script drops tables safely
- [ ] Associated indexes dropped
- [ ] Associated triggers dropped
- [ ] Migration documented in schema version log
- [ ] All tests pass after removal
- [ ] Application starts correctly after migration

---

## Implementation Approach

### Phase 1: Usage Audit (CRITICAL)
1. Search entire codebase for `extraction_metrics` references
2. Search entire codebase for `user_feedback` table references
3. Distinguish between:
   - Table references (SQL queries)
   - Type references (`UserFeedback` interface - can remain deprecated)
4. Document any unexpected usage

### Phase 2: Backup Strategy
1. Document current row counts (likely 0)
2. Export any existing data (if any)
3. Create database backup point

### Phase 3: Migration Script
1. Create new migration file
2. Drop indexes first
3. Drop triggers
4. Drop tables
5. Update schema version

### Phase 4: Verification
1. Run all tests
2. Start application
3. Verify database operations work
4. Check no errors in logs

---

## Estimated Effort

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Usage Audit | 2-3 | ~10K | 15m |
| Backup/Prep | 1-2 | ~5K | 10m |
| Migration Script | 2-3 | ~10K | 15m |
| Verification | 1-2 | ~5K | 10m |
| **Total** | **5-8** | **~30K** | **~45m** |

---

## Migration SQL

```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_extraction_metrics_user_id;
DROP INDEX IF EXISTS idx_extraction_metrics_field;
DROP INDEX IF EXISTS idx_user_feedback_user_id;
DROP INDEX IF EXISTS idx_user_feedback_transaction_id;
DROP INDEX IF EXISTS idx_user_feedback_field_name;
DROP INDEX IF EXISTS idx_user_feedback_type;

-- Drop triggers
DROP TRIGGER IF EXISTS update_extraction_metrics_timestamp;

-- Drop tables
DROP TABLE IF EXISTS extraction_metrics;
DROP TABLE IF EXISTS user_feedback;
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hidden code dependency | High | Thorough codebase search before removal |
| Data loss | Low | Tables likely empty; backup anyway |
| Migration failure | Medium | Test on dev database first |

---

## Dependencies

- **MUST complete after:** BACKLOG-038, BACKLOG-039
- Reason: Schema fixes should be verified working before any table drops

---

## Testing Requirements

### Pre-Removal Checks
- Grep for all SQL references to tables
- Run application, verify no errors

### Post-Removal Checks
- All unit tests pass
- All integration tests pass
- Application starts without database errors
- No warnings in logs about missing tables

---

## STOP-AND-ASK Triggers

If during implementation you find:
- Any active queries using these tables -> STOP and report to PM
- Data exists in either table -> STOP, document data, ask PM about preservation
- Foreign key conflicts -> STOP, document, ask PM

---

## References

- Table creation: `electron/services/databaseService.ts` (lines 894-962)
- Deprecated type: `electron/types/models.ts` (UserFeedback interface)
- New model: `ClassificationFeedback` interface in models.ts
