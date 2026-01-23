# BACKLOG-436: Edit External Contacts with Auto-Import & Merge Conflict Handling

## Summary

Allow users to edit external (not-yet-imported) contacts directly from the UI. Behind the scenes, auto-import the contact to local DB when edit is clicked, warn users that changes won't sync back, and handle potential merge conflicts when external contact data differs from local edits.

## Category

Architecture / UX / Data Integrity

## Priority

P1 - High (Critical UX gap that confuses users)

## Description

### The Problem

**Current Flow (Backend-Driven):**
1. User sees external contact (not imported)
2. User must first import the contact
3. Then edit to add missing info (e.g., email)
4. Then trigger sync to pull communications

**User's Mental Model (UX-Driven):**
1. User sees contact with missing email
2. User wants to edit/fix it immediately
3. User expects to then add contact to transaction

The backend flow is technically correct but creates friction and confusion.

### Proposed Solution

#### 1. Allow Edit on External Contacts
- Show "Edit" button even for external (non-imported) contacts
- When user clicks Edit on external contact:
  - **Behind the scenes**: Auto-import contact to local database
  - Then open edit mode as normal
  - User doesn't need to know about the import step

#### 2. Save Warning for External Contacts
When saving edits to a contact that originated externally:
```
┌─────────────────────────────────────────────────┐
│  ⚠️ Local Changes Only                          │
│                                                 │
│  Changes will be saved locally but won't        │
│  update the contact in Gmail/Outlook/iMessage.  │
│                                                 │
│  [Cancel]                    [Save Locally]     │
└─────────────────────────────────────────────────┘
```

#### 3. Merge Conflict Detection & Resolution

**Scenario:**
- Agent edits contact locally: adds email "work@email.com"
- Later, same contact is updated in Gmail with different email
- On next sync, we detect the external contact changed

**Detection:**
- Track `last_external_sync_at` timestamp on contacts
- Track `last_local_edit_at` timestamp
- On sync, compare external data hash with stored hash
- If external changed AND local was edited → conflict

**Resolution UI:**
```
┌─────────────────────────────────────────────────┐
│  ⚠️ Contact Update Conflict                     │
│                                                 │
│  "John Smith" was updated in both Gmail and     │
│  locally. Choose which version to keep:         │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │ Keep Local      │  │ Use External    │      │
│  │                 │  │                 │      │
│  │ Email:          │  │ Email:          │      │
│  │ work@email.com  │  │ john@gmail.com  │      │
│  │ (you added)     │  │ (from Gmail)    │      │
│  └─────────────────┘  └─────────────────┘      │
│                                                 │
│  [Keep Local]  [Use External]  [Merge Both]    │
└─────────────────────────────────────────────────┘
```

**Resolution Options:**
1. **Keep Local** - Preserve local edits, ignore external changes
2. **Use External** - Overwrite with external data, lose local edits
3. **Merge Both** - Combine (e.g., keep both email addresses)

#### 4. Data Model Changes

Add to contacts table:
```sql
-- Track sync state for conflict detection
ALTER TABLE contacts ADD COLUMN external_source TEXT;  -- 'gmail', 'outlook', 'icloud', null
ALTER TABLE contacts ADD COLUMN external_id TEXT;       -- ID in external system
ALTER TABLE contacts ADD COLUMN external_data_hash TEXT; -- Hash of last synced external data
ALTER TABLE contacts ADD COLUMN last_external_sync_at DATETIME;
ALTER TABLE contacts ADD COLUMN last_local_edit_at DATETIME;
ALTER TABLE contacts ADD COLUMN has_local_edits INTEGER DEFAULT 0;
```

### User Flow Diagram

```
User sees external contact
         │
         ▼
    Clicks "Edit"
         │
         ▼
┌────────────────────┐
│ Auto-import to     │ (invisible to user)
│ local database     │
└────────────────────┘
         │
         ▼
    Edit form opens
         │
         ▼
    User makes changes
         │
         ▼
    Clicks "Save"
         │
         ▼
┌────────────────────┐
│ Show warning:      │
│ "Local only"       │
└────────────────────┘
         │
         ▼
    User confirms
         │
         ▼
    Save with flags:
    - has_local_edits = 1
    - last_local_edit_at = NOW()
         │
         ▼
    [Later on sync]
         │
         ▼
    External changed?
    ┌─────┴─────┐
   No          Yes
    │           │
    ▼           ▼
  Done    Show conflict
          resolution UI
```

## Acceptance Criteria

- [ ] Edit button visible on external (non-imported) contacts
- [ ] Clicking Edit auto-imports contact to local DB
- [ ] Edit flow works seamlessly after auto-import
- [ ] Save shows "local changes only" warning
- [ ] Contacts track external source and sync timestamps
- [ ] Contacts track local edit timestamps
- [ ] Sync detects when external data changed
- [ ] Conflict resolution UI shown when both sides changed
- [ ] User can choose: Keep Local / Use External / Merge Both
- [ ] Merge combines data intelligently (e.g., union of emails)
- [ ] No data loss in any scenario

## Estimated Effort

~45K tokens (complex data flow + conflict resolution)

## Dependencies

- BACKLOG-435: Contact Card View Details & Edit (edit UI)
- BACKLOG-432: Unified Contact Selection (contact flow)

## Related Items

- Contact sync services
- Gmail/Outlook/iCloud contact integration
- Data integrity and conflict resolution patterns

## Technical Notes

### Conflict Detection Algorithm
```typescript
async function detectConflict(contact: Contact, externalData: ExternalContact): ConflictStatus {
  // No conflict if never synced before
  if (!contact.external_data_hash) return 'no_conflict';

  // No conflict if external hasn't changed
  const currentHash = hashExternalData(externalData);
  if (currentHash === contact.external_data_hash) return 'no_conflict';

  // No conflict if no local edits
  if (!contact.has_local_edits) return 'external_update';

  // Both changed = conflict
  return 'conflict';
}
```

### Merge Strategy
- Names: Prefer local (user intentionally changed)
- Emails: Union of both sets
- Phones: Union of both sets
- Notes: Append external notes to local
