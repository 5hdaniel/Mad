# TASK-1995: Multi-Email and Multi-Phone Editing in Contact Form

**Backlog:** BACKLOG-704
**Sprint:** SPRINT-083
**Status:** Pending
**Priority:** High
**Category:** feature
**Estimated Tokens:** ~35K (UI + backend + tests)

---

## Summary

The contact edit form (`ContactFormModal.tsx`) currently shows a single email field and a single phone field, but the database schema already supports multiple emails (`contact_emails` table) and multiple phones (`contact_phones` table) per contact. This task updates the form to show ALL emails and phones for a contact, with the ability to edit, add, remove, and designate which is primary.

---

## Context

### Current Behavior

- `ContactFormModal.tsx` renders one `<input type="email">` and one `<input type="tel">`
- `ContactFormData` type has `email: string` and `phone: string` (singular)
- `getContactById()` in `contactDbService.ts` returns only the primary email/phone via subquery
- `contacts:update` handler in `contact-handlers.ts` updates only the primary email/phone row
- Users cannot see or edit secondary emails/phones from the UI

### Desired Behavior

- The edit form shows ALL emails for the contact, each in its own input row
- The edit form shows ALL phones for the contact, each in its own input row
- Each row has a "primary" radio/star indicator and a remove (X) button
- An "Add email" and "Add phone" button appends a new empty row
- On save, the backend syncs the full list (creates new rows, updates changed rows, deletes removed rows, updates `is_primary` flags)

### Database Schema (already exists)

**`contact_emails` table:**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| contact_id | TEXT FK | references contacts.id |
| email | TEXT | the email address |
| is_primary | INTEGER | 1 = primary, 0 = secondary |
| source | TEXT | 'import', 'manual', etc. |
| created_at | TIMESTAMP | auto |

**`contact_phones` table:**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| contact_id | TEXT FK | references contacts.id |
| phone_e164 | TEXT | normalized phone |
| phone_display | TEXT | display format |
| is_primary | INTEGER | 1 = primary, 0 = secondary |
| source | TEXT | 'import', 'manual', etc. |
| created_at | TIMESTAMP | auto |

---

## Requirements

### R1: Backend - Fetch All Emails/Phones for a Contact

Add a new function or extend `getContactById` to return all emails and phones.

**Option A (preferred):** Add new IPC endpoints:
- `contacts:getEmails` -> returns `{ id, email, is_primary, source }[]` for a contact
- `contacts:getPhones` -> returns `{ id, phone_e164, phone_display, is_primary, source }[]` for a contact

**Option B:** Extend `getContactById` to include `all_emails` and `all_phones` arrays in the response (similar to how `getImportedContacts` already does with `all_emails_json` / `all_phones_json`).

**Decision:** Engineer should choose based on what is cleanest. Option B avoids new IPC channels but changes the return type. Option A is more modular.

### R2: Backend - Bulk Update Emails/Phones on Save

Update the `contacts:update` handler in `contact-handlers.ts` to accept arrays:

```typescript
// New shape for update payload
{
  name: string;
  company: string;
  title: string;
  emails: Array<{ id?: string; email: string; is_primary: boolean }>;
  phones: Array<{ id?: string; phone: string; is_primary: boolean }>;
}
```

Logic:
1. **Existing rows with matching `id`:** UPDATE the email/phone value and `is_primary` flag
2. **New rows (no `id`):** INSERT into `contact_emails` / `contact_phones` with `source = 'manual'`
3. **Missing rows (in DB but not in payload):** DELETE from `contact_emails` / `contact_phones`
4. **Primary enforcement:** Exactly one email and one phone should be `is_primary = 1`. If none marked primary, default the first one.
5. **Also update `contacts` table:** Set `contacts.email` (if column exists) and `contacts.phone` (if column exists) to the primary values for backward compatibility with any code using those fields directly.

### R3: Frontend - Update ContactFormData Type

In `src/types/components.ts`, update `ContactFormData`:

```typescript
export interface ContactEmailEntry {
  id?: string;       // undefined for new entries
  email: string;
  is_primary: boolean;
}

export interface ContactPhoneEntry {
  id?: string;       // undefined for new entries
  phone: string;
  phone_display?: string;
  is_primary: boolean;
}

export interface ContactFormData {
  name: string;
  email: string;        // keep for backward compat (primary email)
  phone: string;        // keep for backward compat (primary phone)
  company: string;
  title: string;
  emails?: ContactEmailEntry[];   // full list for multi-edit
  phones?: ContactPhoneEntry[];   // full list for multi-edit
}
```

### R4: Frontend - Update ContactFormModal UI

Replace the single email/phone inputs with a dynamic list.

**Email section:**
```
Email
  [john@example.com    ] (star-filled) [X]    <- primary
  [john.doe@work.com   ] (star-empty)  [X]    <- secondary
  [+ Add email]
```

**Phone section:**
```
Phone
  [(555) 123-4567      ] (star-filled) [X]    <- primary
  [(555) 987-6543      ] (star-empty)  [X]    <- secondary
  [+ Add phone]
```

UI Details:
- Each row: input field + primary toggle (star or radio) + remove button (X icon)
- Clicking the star/radio on a non-primary row makes it primary (and un-primaries the previous one)
- Remove button deletes that row from the form state (minimum 1 email OR 1 phone must remain for the contact to be valid -- same rule as today)
- "Add email" / "Add phone" appends a new empty row
- New rows should auto-focus
- Validation: no duplicate emails (case-insensitive), no empty entries on save (strip them)

### R5: Frontend - Load All Emails/Phones When Opening Edit

When `ContactFormModal` opens for an existing contact:
1. Fetch all emails and phones (using whichever approach chosen in R1)
2. Populate the `emails[]` and `phones[]` arrays in form state
3. If the contact has NO emails/phones in the DB (legacy data), fall back to single `contact.email` / `contact.phone` as the initial entry

### R6: Frontend - Save Logic

On save:
1. Build the `emails` and `phones` arrays from form state
2. Filter out empty entries
3. Ensure exactly one primary per type
4. Send to `contacts:update` with the new payload shape
5. Backend handles diff (insert/update/delete)

---

## Files Likely Modified

| File | Change |
|------|--------|
| `src/components/contact/components/ContactFormModal.tsx` | Major: multi-email/phone UI |
| `src/types/components.ts` | Add `ContactEmailEntry`, `ContactPhoneEntry`, update `ContactFormData` |
| `electron/contact-handlers.ts` | Update `contacts:update` handler for array payloads |
| `electron/services/db/contactDbService.ts` | Add `getContactEmails`, `getContactPhones` (or extend `getContactById`) |
| `electron/services/databaseService.ts` | Expose new methods if added |
| `electron/types/database.ts` | Update interface if needed |
| `electron/preload/contactBridge.ts` | Add IPC channels if Option A |

---

## Acceptance Criteria

- [ ] Opening edit for a contact with 3 emails shows all 3 in the form
- [ ] Opening edit for a contact with 2 phones shows both in the form
- [ ] Can change the primary email by clicking the primary indicator
- [ ] Can change the primary phone by clicking the primary indicator
- [ ] Can add a new email row and fill it in
- [ ] Can add a new phone row and fill it in
- [ ] Can remove a non-primary email
- [ ] Can remove a non-primary phone
- [ ] Saving persists all changes to `contact_emails` and `contact_phones`
- [ ] Removed entries are deleted from the database
- [ ] New entries are inserted with `source = 'manual'`
- [ ] Exactly one primary email and one primary phone after save
- [ ] Legacy contacts with only `contacts.email`/`contacts.phone` (no rows in child tables) still work
- [ ] Empty entries are stripped before save
- [ ] Duplicate emails (case-insensitive) are prevented
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (existing tests still pass)

---

## Testing Requirements

### Unit Tests

- [ ] `ContactFormModal` renders all emails/phones for a contact with multiple entries
- [ ] Add email button appends a new row
- [ ] Add phone button appends a new row
- [ ] Primary toggle switches primary correctly
- [ ] Remove button removes the entry
- [ ] Save sends correct payload with emails/phones arrays
- [ ] Empty entries are filtered on save
- [ ] Duplicate email validation works

### Backend Tests

- [ ] `contacts:update` handler processes email array (insert, update, delete)
- [ ] `contacts:update` handler processes phone array (insert, update, delete)
- [ ] Primary enforcement: exactly one primary after save
- [ ] Backward compat: old-style single email/phone payload still works

---

## Technical Considerations

- The `contacts:update` handler must remain backward compatible. If the payload contains `email: string` (old format) without `emails[]`, it should work as before. Only when `emails[]` is present should the new bulk logic activate.
- The `contact_emails` and `contact_phones` tables use `INSERT OR IGNORE` in many places -- the update handler should use explicit UPDATE/DELETE, not upsert patterns.
- Phone normalization: new phones entered manually should be stored as-is in `phone_e164` and `phone_display`. Do not attempt E.164 formatting for manually entered phones (the import pipeline handles that separately).
- The form must gracefully handle contacts that have zero rows in `contact_emails`/`contact_phones` (e.g., very old contacts created before the multi-email schema was added).

---

## Out of Scope

- Changing how contacts are displayed outside the edit form (ContactCard, ContactRow, etc. still show primary only)
- Email/phone validation beyond basic format checking
- Merging duplicate contacts
- Bulk editing multiple contacts at once

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Branch** | |
| **PR** | |
| **Files Changed** | |
| **Tests Added** | |
| **Issues/Blockers** | |
