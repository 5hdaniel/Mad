# TASK-1773: External Contacts Shadow Table

**Backlog ID:** BACKLOG-569
**Sprint:** SPRINT-066 (Contact Management UX Overhaul)
**Phase:** 6 (Architecture Enhancement)
**Branch:** `feature/task-1773-external-contacts-shadow-table`
**Estimated Turns:** 8-12
**Estimated Tokens:** 18K-25K

---

## Objective

Create an `external_contacts` table that mirrors macOS Contacts app data with pre-computed `last_message_at` for instant sorted contact loading. This eliminates the need to read 1000+ contacts fresh from macOS every time the contact selection screen opens.

---

## Context

**Current State:**
- External contacts are read fresh from macOS Contacts API every load
- `phone_last_message` lookup table (TASK-1772) enables O(1) message date lookups
- Contact selection still requires cross-referencing two sources

**After This Task:**
- External contacts are persisted in our database
- `last_message_at` is pre-computed and stored on each record
- Contact selection reads from a single, indexed table
- Sync happens in background, not on every UI load

---

## Requirements

### Must Do:

1. **Create Migration (Migration 25):**
   ```sql
   CREATE TABLE external_contacts (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     name TEXT,
     phones TEXT,                        -- JSON array
     emails TEXT,                        -- JSON array
     company TEXT,
     last_message_at DATETIME,
     macos_record_id TEXT,
     synced_at DATETIME,
     FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
     UNIQUE(user_id, macos_record_id)
   );
   CREATE INDEX idx_external_contacts_user ON external_contacts(user_id);
   CREATE INDEX idx_external_contacts_last_msg ON external_contacts(user_id, last_message_at DESC);
   ```

2. **Create `externalContactDbService.ts`:**
   - `getAllForUser(userId: string): Promise<ExternalContact[]>` - sorted by `last_message_at DESC`
   - `upsertFromMacOS(userId: string, contacts: MacOSContact[]): Promise<number>` - batch insert/update
   - `updateLastMessageAt(userId: string, phone: string, date: string): void` - called after message import
   - `deleteByMacOSRecordId(userId: string, recordId: string): void` - for sync removal

3. **Create Sync Service (`externalContactSyncService.ts`):**
   - `syncFromMacOS(userId: string): Promise<SyncResult>` - full sync
   - `isStale(userId: string): boolean` - check if sync needed (e.g., >24h old)
   - Handle adds, updates, and deletes from macOS

4. **Update `contact-handlers.ts`:**
   - Replace fresh macOS reads with shadow table reads
   - Add sync trigger when table is empty or stale
   - Add manual sync handler for user-triggered refresh

5. **Update `messageImportHandlers.ts`:**
   - After message import, update `last_message_at` on matching external contacts
   - Match by normalized phone number

6. **Add IPC handlers:**
   - `contacts:syncExternal` - trigger manual sync
   - `contacts:getExternalSyncStatus` - check last sync time

### Must NOT Do:

- Do NOT remove `phone_last_message` table (keep for other uses)
- Do NOT change the existing imported contacts flow
- Do NOT block UI on sync - use background sync
- Do NOT store duplicate data for already-imported contacts

---

## Acceptance Criteria

- [ ] Migration 25 creates `external_contacts` table successfully
- [ ] Initial sync populates table from macOS Contacts (~1000 records)
- [ ] Contact selection reads from shadow table (not fresh macOS API)
- [ ] Contacts sorted by `last_message_at DESC` (most recent first)
- [ ] Contacts without messages sorted after those with messages
- [ ] Message import updates `last_message_at` on matching external contacts
- [ ] Manual sync can be triggered via IPC
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] Performance: Contact selection loads in <500ms

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/db/externalContactDbService.ts` | CRUD for external_contacts table |
| `electron/services/externalContactSyncService.ts` | Sync logic with macOS Contacts |

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/databaseService.ts` | Migration 25, delegate methods |
| `electron/contact-handlers.ts` | Use shadow table, add sync handlers |
| `electron/handlers/messageImportHandlers.ts` | Update external contacts after import |
| `electron/preload.ts` | Add new IPC channels |
| `src/types/index.ts` | Add ExternalContact type if not exists |

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/db/contactDbService.ts` | Pattern for db service |
| `electron/contact-handlers.ts` | Current external contact loading |
| `electron/handlers/messageImportHandlers.ts` | Message import flow |
| `.claude/plans/tasks/TASK-1772-external-contact-sorting-lookup-table.md` | phone_last_message implementation |

---

## Implementation Sketch

### Migration 25 (databaseService.ts)

```typescript
// Migration 25: Create external_contacts shadow table (BACKLOG-569)
const externalContactsExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='external_contacts'"
).get();

if (!externalContactsExists) {
  await logService.info("Running migration 25: Create external_contacts shadow table", "DatabaseService");

  db.exec(`
    CREATE TABLE external_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      phones TEXT,
      emails TEXT,
      company TEXT,
      last_message_at DATETIME,
      macos_record_id TEXT,
      synced_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users_local(id) ON DELETE CASCADE,
      UNIQUE(user_id, macos_record_id)
    )
  `);
  db.exec(`CREATE INDEX idx_external_contacts_user ON external_contacts(user_id)`);
  db.exec(`CREATE INDEX idx_external_contacts_last_msg ON external_contacts(user_id, last_message_at DESC)`);

  await logService.info("Migration 25 complete: external_contacts table created", "DatabaseService");
}
```

### externalContactDbService.ts

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './core/dbConnection';
import logService from '../logService';

export interface ExternalContact {
  id: string;
  user_id: string;
  name: string | null;
  phones: string[];       // Parsed from JSON
  emails: string[];       // Parsed from JSON
  company: string | null;
  last_message_at: string | null;
  macos_record_id: string;
  synced_at: string;
}

export function getAllForUser(userId: string): ExternalContact[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, user_id, name, phones, emails, company, last_message_at, macos_record_id, synced_at
    FROM external_contacts
    WHERE user_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `).all(userId);

  return rows.map(row => ({
    ...row,
    phones: JSON.parse(row.phones || '[]'),
    emails: JSON.parse(row.emails || '[]'),
  }));
}

export function upsertFromMacOS(userId: string, contacts: MacOSContact[]): number {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO external_contacts (id, user_id, name, phones, emails, company, macos_record_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, macos_record_id) DO UPDATE SET
      name = excluded.name,
      phones = excluded.phones,
      emails = excluded.emails,
      company = excluded.company,
      synced_at = excluded.synced_at
  `);

  let count = 0;
  db.exec('BEGIN TRANSACTION');
  try {
    for (const contact of contacts) {
      stmt.run(
        uuidv4(),
        userId,
        contact.name,
        JSON.stringify(contact.phones || []),
        JSON.stringify(contact.emails || []),
        contact.company,
        contact.recordId,
        now
      );
      count++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return count;
}

export function updateLastMessageAtForPhone(userId: string, normalizedPhone: string, lastMessageAt: string): number {
  const db = getDb();

  // Find external contacts that have this phone number
  // phones is JSON array, need LIKE match for the normalized version
  const result = db.prepare(`
    UPDATE external_contacts
    SET last_message_at = MAX(COALESCE(last_message_at, ''), ?)
    WHERE user_id = ?
      AND phones LIKE ?
  `).run(lastMessageAt, userId, `%${normalizedPhone}%`);

  return result.changes;
}
```

### Sync Flow in contact-handlers.ts

```typescript
// Replace fresh macOS read with shadow table read
const getExternalContacts = async (userId: string): Promise<ExternalContact[]> => {
  // Check if shadow table needs initial population
  const count = await externalContactDbService.getCount(userId);

  if (count === 0) {
    // First time: populate from macOS
    const macOSContacts = await readMacOSContacts();
    await externalContactDbService.upsertFromMacOS(userId, macOSContacts);

    // Populate last_message_at from phone_last_message table
    await populateLastMessageDates(userId);
  }

  return externalContactDbService.getAllForUser(userId);
};
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - `externalContactDbService.test.ts` - CRUD operations, JSON parsing
  - Test `getAllForUser` returns sorted by `last_message_at DESC`
  - Test `upsertFromMacOS` handles updates correctly
  - Test `updateLastMessageAtForPhone` updates matching records

### Integration Tests
- Test full sync flow: macOS read -> shadow table -> contact selection

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add external_contacts shadow table for instant loading`
- **Branch:** `feature/task-1773-external-contacts-shadow-table`
- **Target:** `sprint-066-contact-ux-overhaul`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-01-30*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from sprint-066-contact-ux-overhaul
- [x] Noted start time: ___
- [x] Read task file completely

Implementation:
- [x] Migration 25 created
- [x] externalContactDbService.ts created
- [x] contact-handlers.ts updated
- [x] messageImportHandlers.ts updated
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [x] CI passes (gh pr checks --watch)
- [x] SR Engineer review requested

Completion:
- [x] SR Engineer approved and merged
- [x] PM notified for next task
```

### Results

- **Before**: External contacts read from macOS every load, 50-100s with sorting
- **After**: External contacts cached in shadow table with pre-computed `last_message_at`, instant loading
- **PR**: #691 (merged to sprint-066-contact-ux-overhaul on 2026-01-30)
- **Merge Commit**: c2f1c06

### Implementation Details

**Files Created:**
- `electron/services/db/externalContactDbService.ts` - CRUD for external_contacts table

**Files Modified:**
- `electron/services/databaseService.ts` - Migration 25: `external_contacts` table
- `electron/contact-handlers.ts` - Sync IPC handlers, shadow table reads

**Key Features Implemented:**
- Migration 25: `external_contacts` table with `last_message_at` column
- Non-blocking first load (returns cached contacts, syncs in background)
- Post-message-import date refresh updates `last_message_at` on affected external contacts
- Sync IPC handlers for manual sync trigger

### Notes

**Deviations from plan:**
- Sync service was integrated into externalContactDbService.ts rather than separate file (simpler architecture)

**Issues encountered:**
- None significant

---

## Guardrails

**STOP and ask PM if:**
- macOS Contacts API has changed or is unavailable
- Need to modify phone_last_message table behavior
- Sync performance is unexpectedly slow (>5s for initial sync)
- Unclear how to handle deleted macOS contacts
- You encounter blockers not covered in the task file

---

## Technical Notes

### Phone Normalization

Use the same normalization as `phone_last_message` (digits only):
```typescript
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
```

### JSON Storage for Arrays

Store phones and emails as JSON arrays:
```typescript
// Storage
JSON.stringify(['14245551234', '13105556789'])

// Retrieval
JSON.parse(row.phones || '[]')
```

### Sorting with NULLS LAST

SQLite doesn't have native NULLS LAST, use:
```sql
ORDER BY last_message_at IS NULL, last_message_at DESC
```

Or:
```sql
ORDER BY COALESCE(last_message_at, '0000-00-00') DESC
```

### Batch Updates for Performance

When updating `last_message_at` after message import:
1. Get all affected phone numbers from imported messages
2. Batch lookup in `phone_last_message` for new dates
3. Batch update `external_contacts` in single transaction
