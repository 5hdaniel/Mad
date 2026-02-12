# BACKLOG-616: Cloud Contact Sync - Outlook and Gmail

**Category:** Feature
**Priority:** Medium
**Status:** Pending
**Created:** 2026-02-04
**Estimate:** ~25K tokens

---

## Summary

Import contacts from Outlook (Microsoft Graph) and Gmail (Google People API) into the external contacts system. The OAuth infrastructure already exists for email access—this feature adds contact-specific API calls.

---

## Background

Current contact sources:
- macOS Contacts.app (via local SQLite) ✅
- iPhone Contacts (via backup AddressBook.sqlitedb) ✅
- Email/SMS participants (extracted from messages) ✅
- Manual entry ✅

Missing cloud contact sync:
- Outlook Contacts ❌
- Google Contacts ❌

---

## Requirements

### 1. Outlook Contacts Integration

- Use existing Microsoft Graph client (`electron/outlookService.ts`)
- Add `/me/contacts` API endpoint calls
- Map Outlook contact fields to `external_contacts` schema
- Add `'outlook'` to source enum

**Microsoft Graph endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/contacts
```

### 2. Gmail/Google Contacts Integration

- Extend existing Google OAuth (`electron/services/gmailFetchService.ts`)
- Add Google People API integration
- Add scope: `https://www.googleapis.com/auth/contacts.readonly`
- Map Google contact fields to `external_contacts` schema
- Add `'google'` to source enum

**Google People API endpoint:**
```
GET https://people.googleapis.com/v1/people/me/connections
```

### 3. Database Changes

Extend `external_contacts.source` constraint:
```sql
source TEXT CHECK (source IN ('macos', 'iphone', 'outlook', 'google'))
```

### 4. UI Changes

- Add sync buttons for Outlook/Google contacts in settings or contacts view
- Show source pill for cloud-synced contacts
- Handle OAuth consent flow if not already authorized

---

## Technical Notes

### Existing Infrastructure

| Component | File | Status |
|-----------|------|--------|
| Microsoft Graph client | `electron/outlookService.ts` | Exists (email only) |
| Google OAuth | `electron/services/gmailFetchService.ts` | Exists (email only) |
| External contacts table | `electron/services/db/externalContactDbService.ts` | Exists |
| Source tracking | Migration 27 | Exists (`macos`, `iphone`) |
| Source pill UI | `src/components/shared/SourcePill.tsx` | Exists |

### Field Mapping

| App Field | Outlook Field | Google Field |
|-----------|---------------|--------------|
| name | displayName | names[0].displayName |
| emails | emailAddresses[].address | emailAddresses[].value |
| phones | phones[].number | phoneNumbers[].value |
| company | companyName | organizations[0].name |
| external_record_id | id | resourceName |

---

## Acceptance Criteria

- [ ] User can sync contacts from connected Outlook account
- [ ] User can sync contacts from connected Gmail account
- [ ] Contacts show correct source pill (Outlook/Google)
- [ ] Duplicate detection works across sources
- [ ] Incremental sync (delta) supported where API allows
- [ ] Graceful handling if user denies contact scope

---

## Dependencies

- Existing OAuth flows working for email
- No new npm packages required (uses existing Graph/Google clients)

---

## Suggested Tasks

1. **TASK-A:** Add Microsoft Graph `/me/contacts` API integration
2. **TASK-B:** Add Google People API integration
3. **TASK-C:** Extend database source enum migration
4. **TASK-D:** UI for triggering cloud contact sync
5. **TASK-E:** Testing and edge cases (large contact lists, pagination)
