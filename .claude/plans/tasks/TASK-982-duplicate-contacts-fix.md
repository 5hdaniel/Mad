# TASK-982: Fix Duplicate Contacts in Import Page

**Sprint**: SPRINT-026
**Priority**: Medium
**Estimate**: 20,000 tokens
**Status**: Ready
**Dependencies**: TASK-979, TASK-980
**Backlog**: BACKLOG-165

---

## Objective

Fix the Import Contacts page showing every contact twice.

## Context

Users see duplicate entries in the Import Contacts page. The deduplication logic in `contact-handlers.ts` may not be catching all duplicates when contacts exist in both:
- iPhone-synced contacts (unimportedDbContacts)
- macOS Contacts app (phoneToContactInfo)

## Root Cause Analysis

In `electron/contact-handlers.ts` lines 94-218, the `contacts:get-available` handler:
1. Gets unimported contacts from DB (`is_imported = 0`)
2. Gets contacts from macOS Contacts app
3. Combines them with deduplication using `seenContacts` Set

The deduplication uses lowercase name as key, but may not catch duplicates if:
- Names have slight differences
- Same person exists in both sources with different name spellings
- Email/phone matching isn't being used

## Scope

### Must Implement

1. **Improve deduplication logic** in `contact-handlers.ts`
   - Dedupe by email in addition to name
   - Dedupe by phone number (E.164 format)
   - iPhone-synced contacts take precedence (they have real DB IDs)

2. **Add unit tests** for deduplication logic

### Out of Scope

- Contact merging UI
- Manual duplicate resolution
- Changes to import flow itself

## Files to Modify

| File | Action |
|------|--------|
| `electron/contact-handlers.ts` | Improve deduplication in `contacts:get-available` |
| `electron/contact-handlers.test.ts` | Add deduplication tests |

## Solution Approach

```typescript
// Improved deduplication
const seenEmails = new Set<string>();
const seenPhones = new Set<string>();
const seenNames = new Set<string>();

function isDuplicate(contact: Contact): boolean {
  const nameLower = contact.display_name?.toLowerCase();

  // Check email duplicates
  for (const email of contact.emails || []) {
    if (seenEmails.has(email.toLowerCase())) return true;
  }

  // Check phone duplicates
  for (const phone of contact.phones || []) {
    const normalized = normalizePhone(phone);
    if (seenPhones.has(normalized)) return true;
  }

  // Check name duplicates (fallback)
  if (nameLower && seenNames.has(nameLower)) return true;

  return false;
}

function markAsSeen(contact: Contact): void {
  const nameLower = contact.display_name?.toLowerCase();
  if (nameLower) seenNames.add(nameLower);

  for (const email of contact.emails || []) {
    seenEmails.add(email.toLowerCase());
  }

  for (const phone of contact.phones || []) {
    seenPhones.add(normalizePhone(phone));
  }
}
```

## Acceptance Criteria

- [ ] Each contact appears only once in Import Contacts page
- [ ] Deduplication considers name, email, AND phone
- [ ] Contacts from iPhone sync take precedence (they have real DB IDs)
- [ ] Unit tests cover deduplication scenarios
- [ ] No regression in contact import functionality

## Testing

1. **Manual test**: Import page shows no duplicates
2. **Manual test**: Same contact in iPhone and macOS Contacts app appears once
3. **Unit test**: Deduplication by email works
4. **Unit test**: Deduplication by phone works
5. **Unit test**: iPhone-synced contacts take precedence

## Branch

```
feature/TASK-982-duplicate-contacts-fix
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
