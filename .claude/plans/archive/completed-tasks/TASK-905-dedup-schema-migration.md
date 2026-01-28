# TASK-905: Database Schema Migration - Dedup Columns

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-091 (Phase 1)
**Priority:** HIGH
**Category:** schema
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 3-4 turns, ~15K tokens, 15-20 min

---

## Goal

Add database columns and indexes to support email deduplication across providers.

## Non-Goals

- Do NOT implement dedup logic (that's TASK-909, TASK-911)
- Do NOT backfill existing data
- Do NOT add UI for duplicates

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `electron/database/migrations/014-dedup-columns.ts` | Schema migration |

### Files to Modify

| File | Change |
|------|--------|
| `electron/database/schema.sql` | Document new columns |
| `electron/types/models.ts` | Add fields to Message interface |

---

## Schema Changes

```sql
-- Add to messages table
ALTER TABLE messages ADD COLUMN message_id_header TEXT;
ALTER TABLE messages ADD COLUMN content_hash TEXT;
ALTER TABLE messages ADD COLUMN duplicate_of TEXT;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_message_id_header ON messages(message_id_header);
CREATE INDEX IF NOT EXISTS idx_messages_content_hash ON messages(content_hash);
CREATE INDEX IF NOT EXISTS idx_messages_duplicate_of ON messages(duplicate_of);
```

---

## Implementation Notes

### Migration File

```typescript
// electron/database/migrations/014-dedup-columns.ts
import { Database } from 'better-sqlite3-multiple-ciphers';

export function migrate(db: Database): void {
  // Add columns (SQLite ADD COLUMN is fast - no table rewrite)
  db.exec(`
    ALTER TABLE messages ADD COLUMN message_id_header TEXT;
    ALTER TABLE messages ADD COLUMN content_hash TEXT;
    ALTER TABLE messages ADD COLUMN duplicate_of TEXT;
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_message_id_header ON messages(message_id_header);
    CREATE INDEX IF NOT EXISTS idx_messages_content_hash ON messages(content_hash);
    CREATE INDEX IF NOT EXISTS idx_messages_duplicate_of ON messages(duplicate_of);
  `);
}

export const version = 14;
export const description = 'Add deduplication columns to messages table';
```

### Type Updates

```typescript
// In electron/types/models.ts - add to Message interface
export interface Message {
  // ... existing fields ...

  /** RFC 5322 Message-ID header for cross-provider deduplication */
  message_id_header?: string;

  /** SHA-256 hash of email content for fallback deduplication */
  content_hash?: string;

  /** ID of the original message if this is a duplicate */
  duplicate_of?: string;
}
```

---

## Acceptance Criteria

- [ ] Migration file created at `electron/database/migrations/014-dedup-columns.ts`
- [ ] Migration adds 3 new columns to messages table
- [ ] Migration creates 3 indexes
- [ ] `Message` interface updated with new optional fields
- [ ] `schema.sql` documentation updated
- [ ] Migration tested on empty database
- [ ] Migration tested on database with existing messages
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Follow existing migration file patterns
- Use `IF NOT EXISTS` for indexes
- Make new fields optional (nullable)
- Update schema.sql comments

### Don't
- Populate the new columns (that comes later)
- Add foreign key constraints to duplicate_of
- Modify existing columns

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Messages table has different structure than expected
- Migration system works differently than expected
- Need to add constraints or defaults

---

## Testing Expectations

- Test migration on fresh database
- Test migration on database with 1000+ messages
- Verify columns exist after migration
- Verify indexes are created

---

## PR Preparation

**Branch:** `feature/TASK-905-dedup-schema`
**Title:** `feat(db): add deduplication columns to messages table`
**Labels:** `feature`, `schema`, `SPRINT-014`

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-904)
- **Depends On:** None
- **Blocks:** TASK-909, TASK-911

### Technical Considerations
- **VERIFY MIGRATION SYSTEM**: Existing migrations are `.sql` files in `electron/database/migrations/`, not numbered `.ts` files
- Engineer should investigate actual migration pattern before implementing
- If migration system differs significantly from task spec, use Stop-and-Ask trigger
- SQLite `ALTER TABLE ADD COLUMN` is fast and non-blocking
