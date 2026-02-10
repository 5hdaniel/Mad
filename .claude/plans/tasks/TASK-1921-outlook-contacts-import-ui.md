# TASK-1921: Import Outlook Contacts to external_contacts + "Outlook" Source Pill

**Backlog Item:** BACKLOG-629
**Sprint:** SPRINT-073
**Status:** completed
**Depends On:** TASK-1920
**Category:** feature
**Created:** 2026-02-07

## Objective

Wire up the Outlook contacts fetch (from TASK-1920) into the existing contact sync flow, import to `external_contacts` SQLite table with `source = "outlook"`, add an "Outlook" source pill in the UI, and add an IPC handler + trigger.

## Architecture Context (from research)

### Existing Contact Sync Flow

The macOS contact sync works like this:
1. `contact-handlers.ts` → `contacts:get-available` IPC handler
2. Checks `external_contacts` shadow table via `externalContactDbService`
3. If empty/stale → reads from macOS Contacts API → calls `externalContactDb.fullSync()`
4. Returns combined list to renderer

### external_contacts Source Values

Currently: `'macos' | 'iphone'` — hardcoded in `ExternalContact` interface (`externalContactDbService.ts:30`)

### SourcePill Component

`src/components/shared/SourcePill.tsx` — maps source strings to colored badges:
- `imported` / `contacts_app` → blue "Imported"
- `external` → violet "Contacts App"
- `sms` / `messages` → amber "Message"
- `manual` → green "Manual"

**Note:** The SourcePill uses `ContactSource` type from SourcePill.tsx (NOT the one from `electron/types/models.ts`). Currently missing "outlook" variant.

### externalContactDb.fullSync() Pattern

`externalContactDbService.ts` `fullSync(userId, contacts)`:
- Uses `dbTransaction()` for batch performance
- Upserts by `external_record_id` + `source` (unique constraint)
- Deletes stale records not in current sync set
- Updates `last_message_at` from phone_last_message lookup

## Requirements

### 1. Update external_contacts source type

**File:** `electron/services/db/externalContactDbService.ts`

Update the `ExternalContact` interface:
```ts
source: 'macos' | 'iphone' | 'outlook';  // Add 'outlook'
```

### 2. Add Outlook contacts sync function

**File:** `electron/services/db/externalContactDbService.ts`

Create `syncOutlookContacts(userId, outlookContacts)`:
- Similar to `fullSync()` but scoped to `source = 'outlook'`
- Upserts contacts with `external_record_id` = Graph API contact `id`
- Only deletes stale 'outlook' records (don't touch macos/iphone)
- Wrap in `dbTransaction()` for performance

**CRITICAL (SR Engineer):** Do NOT reuse `fullSync()` — it calls `deleteStaleContacts()` which deletes ALL stale records regardless of source. Must use `deleteStaleContactsBySource(userId, 'outlook', syncTime)` to isolate Outlook deletions.

Also update `deleteStaleContactsBySource` signature (line ~316) — its `source` parameter is typed `'macos' | 'iphone'` and needs `'outlook'` added.

Also update type casts in `getAllForUser()` (line ~111) and `search()` (line ~436) where `row.source` is cast as `'macos' | 'iphone'`.

### 3. Add IPC handler for Outlook contact sync

**File:** `electron/contact-handlers.ts`

Add new handler `contacts:syncOutlookContacts`:
- Calls `fetchOutlookContacts()` from TASK-1920
- Maps to ExternalContact format
- Calls sync function
- Returns count of imported contacts
- Emits progress events via `mainWindow.webContents.send()`

### 4. Add preload bridge

**File:** `electron/preload/contactBridge.ts`

Add `syncOutlookContacts(userId)` to the preload bridge.

### 5. Add "Email" source pill variant

**File:** `src/components/shared/SourcePill.tsx`

Add `"email"` to SourcePill's `ContactSource` type:
```ts
export type ContactSource =
  | "imported" | "external" | "manual"
  | "contacts_app" | "sms" | "messages"
  | "email";  // NEW — for contacts imported via email providers (Outlook, Google)
```

Add new variant in `VARIANT_STYLES`:
```ts
email: {
  bg: "bg-sky-100",
  text: "text-sky-700",
  label: "Email",
},
```

Add to `getVariant()`:
```ts
case "email":
  return "email";
```

**Note:** `"email"` already exists in the `contacts` table CHECK constraint (`electron/types/models.ts:24`), so no DB migration is needed. When Outlook contacts are imported from `external_contacts` (source="outlook") into the main `contacts` table, they use `source = "email"`. This is generic — Google contacts will also use `source = "email"` later.

### 6. Add sync button in UI (with scope guard)

Add an "Import from Outlook" button in the contacts UI — follow existing patterns. Could be in `ImportContactsModal.tsx` or as a standalone action.

**SR Engineer requirements:**
- Only show "Import from Outlook" if user has a Microsoft mailbox connected
- Handle "missing scope" case: if token lacks `Contacts.Read`, show "Please reconnect your Microsoft account to enable contact import" with a reconnect action
- When Outlook contacts appear in `contacts:get-available`, use `source: "outlook"` (not `"contacts_app"` which is hardcoded on line 527 of `contact-handlers.ts`)

## Files to Modify

- `electron/services/db/externalContactDbService.ts` — Add 'outlook' source type, sync function
- `electron/contact-handlers.ts` — Add IPC handler
- `electron/preload/contactBridge.ts` — Add preload bridge method
- `src/components/shared/SourcePill.tsx` — Add "Outlook" variant
- `src/components/contact/components/ImportContactsModal.tsx` — Add sync trigger (or separate button)
- `src/window.d.ts` — Add type for new IPC method

## Acceptance Criteria

- [ ] Outlook contacts synced to `external_contacts` table with `source = 'outlook'`
- [ ] Re-sync doesn't create duplicates (upsert by external_record_id + source)
- [ ] Existing iPhone/macOS contacts completely unaffected (source-scoped deletion)
- [ ] "Email" pill/badge displayed in contacts UI (sky blue color) for contacts with `source = "email"`
- [ ] Outlook contacts in `contacts:get-available` use `source: "outlook"` (not "contacts_app")
- [ ] Sync button only visible when Microsoft mailbox is connected
- [ ] "Reconnect required" message when token lacks Contacts.Read scope
- [ ] Preload bridge and window.d.ts types updated
- [ ] All type casts and function signatures updated for 'outlook' source
- [ ] Unit tests for sync function and SourcePill variant
- [ ] No TypeScript errors

## Branch Information

**Branch From:** develop (after TASK-1920 merges)
**Branch Name:** feature/task-1921-outlook-contacts-ui

## Agent ID

**Engineer Agent ID:** _[To be filled by implementing agent]_

## Implementation Summary

_[To be completed by implementing agent after work is done]_
