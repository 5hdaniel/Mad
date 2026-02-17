# TASK-2003: Extract Raw SQL from contact-handlers.ts into contactDbService

**Backlog:** BACKLOG-719
**Sprint:** SPRINT-085
**Status:** Pending
**Priority:** High
**Category:** refactor
**Estimated Tokens:** ~12K (refactor x0.5 multiplier applied)
**Token Cap:** ~48K (4x)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Goal

Extract the ~140 lines of raw SQL in the `contacts:update` handler (email/phone sync logic) into proper service methods on `contactDbService`. The handler should validate input, delegate to the service, and return the result -- no SQL in the handler.

## Non-Goals

- Do NOT refactor the entire `contact-handlers.ts` file (only the `contacts:update` handler's SQL)
- Do NOT split `contact-handlers.ts` into multiple files (that is a P2 item)
- Do NOT change the email/phone sync behavior -- only move the code
- Do NOT add new features to the sync logic

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/contact-handlers.ts` | Replace ~140 lines of inline SQL with service calls |
| `electron/services/db/contactDbService.ts` | Add `syncContactEmails()` and `syncContactPhones()` methods |

## Current Code Location

The raw SQL is in the `contacts:update` handler, approximately lines 1019-1140 of `contact-handlers.ts`. It handles two scenarios:

### Email Sync (lines ~1019-1087)
1. **Array payload** (`rawUpdates.emails`): Full sync -- insert new, update existing, delete removed
2. **Legacy single-email** (`validatedUpdates.email`): Backward-compat -- set one email as primary

### Phone Sync (lines ~1089-1140)
1. **Array payload** (`rawUpdates.phones`): Full sync -- insert new, update existing, delete removed

## Implementation Notes

### Service Methods to Create

Add these methods to `electron/services/db/contactDbService.ts`:

```typescript
/**
 * Sync contact email entries. Handles insert/update/delete to match incoming array.
 * Enforces exactly one primary email.
 */
export function syncContactEmails(
  contactId: string,
  emails: Array<{ id?: string; email: string; is_primary: boolean }>
): void {
  // Move the array-payload email sync logic here
  // Uses getContactEmailEntries(), dbRun() -- already available in the service
}

/**
 * Set a single email as primary for a contact (legacy backward-compat path).
 * If email doesn't exist in contact_emails, replaces all emails with this one.
 */
export function setContactPrimaryEmail(
  contactId: string,
  email: string
): void {
  // Move the legacy single-email update logic here
}

/**
 * Sync contact phone entries. Handles insert/update/delete to match incoming array.
 * Enforces exactly one primary phone.
 */
export function syncContactPhones(
  contactId: string,
  phones: Array<{ id?: string; phone: string; is_primary: boolean }>
): void {
  // Move the array-payload phone sync logic here
  // Uses getContactPhoneEntries(), dbRun() -- already available in the service
}
```

### Handler After Extraction

The `contacts:update` handler should become:

```typescript
// After standard validation and databaseService.updateContact()...

if (Array.isArray(rawUpdates.emails)) {
  syncContactEmails(validatedContactId, rawUpdates.emails);
  logService.info("Contact emails synced (multi)", "Contacts", {
    contactId: validatedContactId,
    count: rawUpdates.emails.length,
  });
} else if (validatedUpdates.email !== undefined) {
  setContactPrimaryEmail(validatedContactId, validatedUpdates.email as string);
}

if (Array.isArray(rawUpdates.phones)) {
  syncContactPhones(validatedContactId, rawUpdates.phones);
  logService.info("Contact phones synced (multi)", "Contacts", {
    contactId: validatedContactId,
    count: rawUpdates.phones.length,
  });
}
```

### Dependencies Already in contactDbService

Check that `contactDbService.ts` already imports:
- `dbRun` from `./core/dbConnection`
- `dbGet` from `./core/dbConnection`
- `getContactEmailEntries` (or similar)
- `getContactPhoneEntries` (or similar)
- `randomUUID` from `crypto`

If any of these are only imported in `contact-handlers.ts`, move the imports to the service.

## Acceptance Criteria

- [ ] `syncContactEmails()` method exists in `contactDbService.ts`
- [ ] `setContactPrimaryEmail()` method exists in `contactDbService.ts`
- [ ] `syncContactPhones()` method exists in `contactDbService.ts`
- [ ] `contacts:update` handler has zero raw SQL (`dbRun`, `dbGet`, `dbAll` calls)
- [ ] Handler delegates to service methods and handles logging
- [ ] Input validation (sanitize, normalize, enforce one primary) stays in the service methods
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes -- all existing contact tests pass unchanged
- [ ] No behavioral changes -- same inputs produce same contact email/phone state

## Do / Don't Guidelines

### DO:
- Keep the input filtering/normalization (`.trim()`, `.toLowerCase()`, primary enforcement) in the service methods -- it is business logic, not handler logic
- Keep logging calls in the handler (not the service) for consistency with other handlers
- Import `randomUUID` from `crypto` in the service if not already imported

### DON'T:
- Change the SQL queries themselves -- only move them
- Add transactions/savepoints -- the current code doesn't use them
- Refactor other handlers in `contact-handlers.ts`
- Add new test files (existing tests should cover the behavior)

## Stop-and-Ask Triggers

- If `contactDbService.ts` doesn't already have `getContactEmailEntries` / `getContactPhoneEntries`, ask about where those helpers live
- If the SQL uses tables or columns that aren't obvious, ask before moving
- If existing contact tests fail after extraction, STOP and investigate (do not modify tests)

## Testing Expectations

- No new tests required -- this is a pure extraction refactoring
- All existing contact handler tests must pass unchanged
- `npm run type-check` is the primary structural validation

## PR Preparation

**Title:** `refactor: extract email/phone sync SQL from contact handler into contactDbService`
**Labels:** refactor
**Base:** develop

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | engineer-task-2003 |
| **Branch** | refactor/task-2003-contact-sql-extraction |
| **PR** | TBD |
| **Files Changed** | 2 (`electron/contact-handlers.ts`, `electron/services/db/contactDbService.ts`) |
| **Tests Added** | 0 (pure extraction, existing tests pass) |
| **Issues/Blockers** | None |

### Changes Made

1. **`electron/services/db/contactDbService.ts`**: Added 4 new exported functions:
   - `syncContactEmails()` -- array email sync with insert/update/delete and primary enforcement
   - `setContactPrimaryEmail()` -- legacy single-email backward-compat path
   - `syncContactPhones()` -- array phone sync with insert/update/delete and primary enforcement
   - `setContactPrimaryPhone()` -- legacy single-phone backward-compat path

2. **`electron/contact-handlers.ts`**:
   - Replaced ~140 lines of inline SQL in the `contacts:update` handler with 4 service method calls
   - Added imports for the 4 new service functions
   - Removed `dbRun` from imports (no longer needed)
   - Logging remains in the handler (not moved to service)
   - Zero `dbRun`/`dbGet`/`dbAll` calls remain in the `contacts:update` handler

### Deviations

Added a 4th method `setContactPrimaryPhone()` not listed in the task spec, because the handler also had legacy single-phone SQL (lines 1132-1158) that needed extraction to achieve the acceptance criterion of "zero raw SQL in the handler".
