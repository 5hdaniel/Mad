# BACKLOG-365: Fix feedbackService Table Reference Mismatch

**Created**: 2026-01-21
**Priority**: Critical
**Category**: Bug / Data Integrity
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-002)

---

## Problem Statement

The feedback system has a table mismatch that could cause runtime errors:

- **feedbackService.ts** calls `window.api.feedback.*` methods
- **Migration `add_user_feedback.sql`** creates `user_feedback` table
- **Schema `schema.sql`** defines `classification_feedback` table (different structure)

The IPC handlers (via window.api.feedback) may be querying a table that doesn't exist or has the wrong structure.

## Evidence

**add_user_feedback.sql (migration):**
```sql
CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('correction', 'confirmation', 'rejection')),
  source_communication_id TEXT,
  ...
);
```

**schema.sql (lines 498-533):**
```sql
CREATE TABLE IF NOT EXISTS classification_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_id TEXT,
  attachment_id TEXT,
  transaction_id TEXT,
  contact_id TEXT,
  feedback_type TEXT CHECK (feedback_type IN ('message_relevance', 'transaction_link', ...)),
  original_value TEXT,
  corrected_value TEXT,
  ...
);
```

**Key Differences:**
| Field | user_feedback | classification_feedback |
|-------|---------------|------------------------|
| transaction_id | NOT NULL | Nullable |
| field_name | Present | Absent |
| message_id | Absent | Present |
| feedback_type values | correction/confirmation/rejection | message_relevance/transaction_link/etc. |

## Investigation Needed

1. Check which table the IPC handlers actually query
2. Determine if `user_feedback` migration was ever run
3. Identify if data exists in either table
4. Determine intended feedback workflow

## Potential Solutions

### Option A: Align feedbackService with classification_feedback
- Update feedbackService.ts to use classification_feedback schema
- Update IPC handlers to query classification_feedback
- Deprecate user_feedback migration

### Option B: Keep Both Tables for Different Purposes
- `user_feedback` for field-level corrections (closing_date, sale_price)
- `classification_feedback` for AI classification corrections (message relevance, roles)
- Update services to use correct table for each purpose

### Option C: Merge Tables
- Create unified feedback table supporting both use cases
- Migrate data from both tables
- Update all services

## Acceptance Criteria

- [ ] Feedback service successfully reads/writes data
- [ ] No runtime errors when using feedback features
- [ ] Clear documentation of feedback data model
- [ ] Migration handles any existing data

## Estimation

- **Category:** database/service refactor
- **Estimated Tokens:** ~8K (includes investigation)
- **Risk:** Medium (need to understand current data and usage)

## Related

- BACKLOG-296 (FINDING-03): Originally identified this issue
- feedbackService.ts: Renderer-side abstraction
- electron/handlers/feedbackHandler.ts: IPC handlers (if exists)
