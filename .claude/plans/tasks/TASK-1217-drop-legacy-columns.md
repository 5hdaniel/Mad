# Task TASK-1217: Migration to Drop Legacy Columns from Communications

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## CRITICAL WARNING

**This is a DESTRUCTIVE migration. It cannot be undone.**

Only proceed if:
- [ ] ALL phases 1-6 are complete and merged
- [ ] User has tested ALL features and approved
- [ ] You are confident no queries reference these columns

---

## Goal

Create a migration that drops the legacy content columns from the `communications` table, completing the transition to a pure junction table.

## Non-Goals

- Do NOT run this migration without user approval
- Do NOT skip any column from the removal list
- Do NOT make other changes in this migration

## Deliverables

1. Update: `electron/services/databaseService.ts` - Add migration
2. Update: `electron/database/schema.sql` - Remove column definitions
3. Update: TypeScript types if they reference removed columns

## Columns to Remove

```sql
-- Content columns (now in messages table)
subject, body, body_plain

-- Sender/recipient columns (now in messages table)
sender, recipients, cc, bcc

-- Timestamp columns (now in messages table)
email_thread_id, sent_at, received_at

-- Attachment columns (now in messages table)
has_attachments, attachment_count, attachment_metadata

-- Analysis columns (were unused or now in messages)
keywords_detected, parties_involved, communication_category
relevance_score, is_compliance_related, source, communication_type
```

## Acceptance Criteria

- [ ] Migration runs without errors
- [ ] All listed columns are removed
- [ ] Schema file updated to match
- [ ] TypeScript types updated if needed
- [ ] All tests pass
- [ ] App works after migration

## Implementation Notes

### Migration Approach

SQLite doesn't support `ALTER TABLE DROP COLUMN` directly in all versions. Use table recreation:

```typescript
// Migration XX: Drop legacy columns from communications
{
  const currentVersion = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (currentVersion.user_version < XX) {
    log('Running migration XX: Drop legacy columns from communications');
    db.transaction(() => {
      // Create new table with only needed columns
      db.exec(`
        CREATE TABLE communications_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          transaction_id INTEGER,
          message_id INTEGER,
          thread_id TEXT,
          communication_type TEXT,
          link_source TEXT,
          link_confidence REAL,
          linked_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
        );
      `);

      // Copy data to new table
      db.exec(`
        INSERT INTO communications_new (
          id, user_id, transaction_id, message_id, thread_id,
          communication_type, link_source, link_confidence, linked_at, created_at
        )
        SELECT
          id, user_id, transaction_id, message_id, thread_id,
          communication_type, link_source, link_confidence, linked_at, created_at
        FROM communications;
      `);

      // Drop old table and rename new
      db.exec('DROP TABLE communications');
      db.exec('ALTER TABLE communications_new RENAME TO communications');

      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_communications_transaction
          ON communications(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_communications_message
          ON communications(message_id);
        CREATE INDEX IF NOT EXISTS idx_communications_thread
          ON communications(thread_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_thread_txn_unique
          ON communications(thread_id, transaction_id)
          WHERE thread_id IS NOT NULL AND message_id IS NULL;
      `);

      db.exec(`PRAGMA user_version = XX`);
    })();
    log('Migration XX complete');
  }
}
```

### Update Schema File

Remove the dropped columns from `electron/database/schema.sql`:

```sql
-- Communications table (junction table only)
CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  transaction_id INTEGER,
  message_id INTEGER,
  thread_id TEXT,
  communication_type TEXT,
  link_source TEXT,
  link_confidence REAL,
  linked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
```

### Update TypeScript Types

If `Communication` type includes removed fields, update it.

## Integration Notes

- Depends on: TASK-1216 (all queries updated)
- After this, there's no going back to the old pattern
- User MUST have tested everything before this runs

## Do / Don't

### Do:

- Use table recreation for clean column removal
- Preserve all data in kept columns
- Recreate all necessary indexes
- Test migration on both fresh and existing databases

### Don't:

- Don't run before user approval
- Don't leave orphaned indexes
- Don't change any logic in this migration

## When to Stop and Ask

- If migration fails for any reason
- If any test starts failing after migration
- If user hasn't explicitly approved Phase 6 testing

## Testing Expectations (MANDATORY)

### Unit Tests

- Existing tests must pass
- If tests reference removed columns, update them

### Integration / Feature Tests

- All features tested in Phase 6 must still work

### CI Requirements

- [ ] All checks pass

## PR Preparation

- **Title**: `refactor(db): drop legacy content columns from communications`
- **Labels**: `database`, `schema`, `breaking-change`
- **Depends on**: TASK-1216

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Migration complexity | Table recreation | +10K |
| Schema update | Simple removal | +3K |
| Type updates | Minimal | +2K |

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Pre-Implementation Verification

```
User approval confirmed:
- [ ] User tested all Phase 6 features
- [ ] User explicitly approved proceeding
```

### Checklist

```
Migration:
- [ ] Table recreation migration added
- [ ] All indexes recreated
- [ ] Migration tested on fresh DB
- [ ] Migration tested on existing DB

Schema:
- [ ] schema.sql updated
- [ ] TypeScript types updated (if needed)

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] App starts and works
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Migration Correct:** PASS / FAIL
**Data Preserved:** PASS / FAIL
**Indexes Recreated:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## User Testing Gate

### BACKUP VERIFICATION (SR ENGINEER REQUIREMENT)

**BEFORE proceeding with this destructive migration:**

- [ ] **User has confirmed they have a database backup**
- [ ] OR **User is OK with re-importing data if needed**

**This is a one-way migration. Without backup, data recovery requires re-import from email sources.**

---

**AFTER this task merges, user must verify everything still works:**

- [ ] App starts normally
- [ ] Contact search works
- [ ] Message display works
- [ ] Export works
- [ ] Email linking works
- [ ] Text linking works

**The destructive migration is complete. If issues are found now, we'd need to restore from backup or re-import data.**

**If all tests pass, user approves proceeding to TASK-1218 (cleanup).**
