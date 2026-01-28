# BACKLOG-553: Fix Contact Import FK Constraint (User ID Validation)

## Status
- **Priority**: P1
- **Type**: Bug
- **Status**: open
- **Created**: 2026-01-27
- **Sprint**: SPRINT-062
- **Related**: BACKLOG-551 (parent user ID unification issue)

## Problem

Contact import fails with FK constraint error when user ID from Supabase auth (`auth.uid()`) doesn't match local `users_local` table. This is the same pattern as issues fixed in:

- `outlookHandlers.ts`
- `messageImportHandlers.ts`
- `microsoftAuthHandlers.ts`
- `googleAuthHandlers.ts`
- `sharedAuthHandlers.ts`

The `contact-handlers.ts` file has an **inline implementation** of user ID validation in the `contacts:import` handler (lines 416-434), but:

1. It does NOT use the `getValidUserId()` helper from `electron/utils/userIdHelper.ts`
2. Other handlers in the file do NOT have this validation at all

## Affected Handlers

| Handler | Has Validation? | Notes |
|---------|-----------------|-------|
| `contacts:import` | Partial (inline) | Should use `getValidUserId()` helper |
| `contacts:create` | No | Needs validation before `databaseService.createContact()` |
| `contacts:get-all` | No | Needs validation |
| `contacts:get-available` | No | Needs validation |
| `contacts:get-sorted-by-activity` | No | Needs validation |
| `contacts:search` | No | Needs validation |

## Proposed Fix

Apply the `getValidUserId()` pattern consistently across all handlers in `contact-handlers.ts`:

1. Import `getValidUserId` from `../utils/userIdHelper`
2. Replace inline validation in `contacts:import` with helper call
3. Add validation to all other handlers that accept `userId`
4. Return appropriate error if no valid user found

## Example Implementation

```typescript
import { getValidUserId } from "./utils/userIdHelper";

// In each handler:
const validatedUserId = await getValidUserId(userId, "Contacts");
if (!validatedUserId) {
  return {
    success: false,
    error: "No valid user found in database",
  };
}
```

## Files Involved

- `electron/contact-handlers.ts` - Primary file to modify
- `electron/utils/userIdHelper.ts` - Helper to import (already exists)

## Acceptance Criteria

- [ ] Import `getValidUserId` from `../utils/userIdHelper`
- [ ] `contacts:import` uses helper instead of inline implementation
- [ ] `contacts:create` has user ID validation
- [ ] `contacts:get-all` has user ID validation
- [ ] `contacts:get-available` has user ID validation
- [ ] `contacts:get-sorted-by-activity` has user ID validation
- [ ] `contacts:search` has user ID validation
- [ ] All handlers return proper error when no valid user found
- [ ] TypeScript compiles without errors

## Estimated Effort

~8K tokens (straightforward pattern application)

## Testing

1. Import contacts with mismatched Supabase vs local user IDs
2. Create contacts with mismatched user IDs
3. Verify FK constraint errors no longer occur
4. Verify existing functionality still works when IDs match
