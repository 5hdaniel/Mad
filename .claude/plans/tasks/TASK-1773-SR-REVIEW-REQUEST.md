# SR Engineer Technical Review Request: TASK-1773

**Date:** 2026-01-30
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** 6 (Architecture Enhancement)

---

## Task Summary

**TASK-1773: External Contacts Shadow Table**

Create a persistent `external_contacts` table that mirrors macOS Contacts app data with pre-computed `last_message_at` for instant sorted contact loading.

**Backlog Item:** BACKLOG-569

---

## Review Needed

### 1. Schema Review

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

**Questions for SR:**
- Is JSON array storage for phones/emails appropriate, or should we use separate junction tables?
- Is the index on `(user_id, last_message_at DESC)` sufficient for sorted queries?
- Should we add a `deleted_at` soft-delete column for sync conflict resolution?

### 2. Relationship with phone_last_message (TASK-1772)

TASK-1772 just added `phone_last_message` lookup table. This task adds `external_contacts` shadow table.

**Current approach:**
- Keep `phone_last_message` table as-is
- Use it to populate `last_message_at` in `external_contacts` during initial sync
- Continue updating `phone_last_message` after message imports
- Update `external_contacts.last_message_at` after message imports via phone matching

**SR Decision Needed:**
- Is this the right relationship, or should `external_contacts` completely replace `phone_last_message` for external contact sorting?
- Should message import update both tables, or just `phone_last_message` with `external_contacts` reading from it?

### 3. Sync Strategy Review

**Proposed Flow:**
1. On first load (or table empty): Read all macOS contacts, insert into shadow table
2. Background refresh: Periodically check for changes (adds/updates/deletes)
3. After message import: Update `last_message_at` for affected phone numbers
4. Manual refresh: User can trigger sync if needed

**Questions for SR:**
- How often should background sync run? (Current thinking: 24h or on-demand)
- How to detect deleted macOS contacts? (Compare record IDs? Or just soft-delete stale records?)
- Should sync be blocking or fully async?

### 4. Files to Be Created/Modified

**New Files:**
- `electron/services/db/externalContactDbService.ts` - CRUD operations
- `electron/services/externalContactSyncService.ts` - Sync logic

**Modified Files:**
- `electron/services/databaseService.ts` - Migration 25, delegate methods
- `electron/contact-handlers.ts` - Use shadow table instead of fresh macOS reads
- `electron/handlers/messageImportHandlers.ts` - Update shadow table after import

**SR Questions:**
- Is a separate `externalContactSyncService.ts` needed, or should sync logic live in `contact-handlers.ts`?
- Should preload.ts expose new IPC channels for manual sync?

### 5. Performance Expectations

**Current (without shadow table):**
- ~50-100 seconds with sorting (now ~1s with TASK-1772 lookup table)
- Still requires fresh macOS API read every load

**After shadow table:**
- <500ms contact selection load (single SQLite query)
- macOS API only read during sync (background)

**SR Questions:**
- Any concerns about initial sync performance (1000+ contacts)?
- Should we paginate the initial sync?

---

## Task Files for Review

| File | Location |
|------|----------|
| Task File | `.claude/plans/tasks/TASK-1773-external-contacts-shadow-table.md` |
| Backlog Item | `.claude/plans/backlog/items/BACKLOG-569-external-contacts-shadow-table.md` |
| Sprint Plan | `.claude/plans/sprints/SPRINT-066-contact-ux-overhaul.md` |

---

## Branch Information (To Be Set by SR)

After review, please specify:

- **Branch From:** `sprint-066-contact-ux-overhaul` or `develop`?
- **Branch Into:** `sprint-066-contact-ux-overhaul` or `develop`?
- **Branch Name:** `feature/task-1773-external-contacts-shadow-table` (suggested)
- **Execution:** Sequential (depends on TASK-1772 being complete)

---

## Context: Current External Contact Flow

```typescript
// Current flow in contact-handlers.ts (simplified)
async function getExternalContacts(userId: string) {
  // 1. Read fresh from macOS every time
  const macOSContacts = await readMacOSContacts();  // ~1000 records

  // 2. Look up last_message_at from phone_last_message table (TASK-1772)
  const phones = macOSContacts.flatMap(c => c.phones).map(normalizePhone);
  const dateMap = await getLastMessageDatesForPhones(phones, userId);

  // 3. Attach dates and sort
  for (const contact of macOSContacts) {
    contact.last_message_at = dateMap.get(normalizePhone(contact.phones[0]));
  }

  return macOSContacts.sort((a, b) => /* by last_message_at */);
}
```

**After this task:**
```typescript
async function getExternalContacts(userId: string) {
  // 1. Check if sync needed
  if (await isStale(userId)) {
    await syncFromMacOS(userId);  // Background
  }

  // 2. Read from shadow table (instant, pre-sorted)
  return await externalContactDbService.getAllForUser(userId);
}
```

---

## Awaiting SR Engineer Review

Please review and provide:
1. Schema approval or modifications
2. Sync strategy approval or modifications
3. File creation/modification approval
4. Branch information for task assignment
5. Any technical concerns or blockers

**After SR approval, PM will assign task to Engineer for implementation.**
