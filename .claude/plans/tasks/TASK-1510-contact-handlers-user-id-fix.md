# Task TASK-1510: Fix Contact Import FK Constraint (User ID Validation)

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-553
**Status**: Ready
**Execution**: Parallel (no file overlap with TASK-1504)

---

## Goal

Apply the `getValidUserId()` pattern consistently across all handlers in `contact-handlers.ts` to prevent FK constraint failures when user ID from Supabase auth (`auth.uid()`) doesn't match local `users_local` table.

## Non-Goals

- Do NOT modify the `getValidUserId()` helper in `userIdHelper.ts` (already exists and works)
- Do NOT modify other handler files (they already have the fix)
- Do NOT add new functionality - just apply the existing pattern

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (or current branch)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1510-contact-handlers-user-id`

---

## Estimated Tokens

**Est. Tokens**: ~8K (straightforward pattern application)
**Token Cap**: ~32K (4x estimate)

---

## Background

We've been fixing FK constraint failures throughout the codebase caused by user ID mismatch between Supabase `auth.uid()` and local `users_local.id`. The fix pattern involves:

1. Import `getValidUserId` from `../utils/userIdHelper`
2. Call `await getValidUserId(userId, "Context")` at the start of each handler
3. Return error if no valid user found

**Files already fixed:**
- `electron/handlers/outlookHandlers.ts`
- `electron/handlers/messageImportHandlers.ts`
- `electron/handlers/microsoftAuthHandlers.ts`
- `electron/handlers/googleAuthHandlers.ts`
- `electron/handlers/sharedAuthHandlers.ts`

---

## Current State

The `contact-handlers.ts` file has **partial inline validation** in the `contacts:import` handler (lines 416-434):

```typescript
// BACKLOG-551: Verify user exists in database (ID may have been migrated)
const userExists = await databaseService.getUserById(validatedUserId);
if (!userExists) {
  logService.warn("[Main] User ID not found in contacts:import, may have been migrated", "Contacts", {
    providedId: validatedUserId.substring(0, 8) + "...",
  });
  // Try to find any user in the database (single-user app)
  const db = databaseService.getRawDatabase();
  const anyUser = db.prepare("SELECT id FROM users_local LIMIT 1").get() as { id: string } | undefined;
  if (anyUser) {
    validatedUserId = anyUser.id;
    // ...
  }
}
```

This is essentially the same logic as `getValidUserId()` but inline. Other handlers in this file do NOT have this validation at all.

---

## Deliverables

### Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `electron/contact-handlers.ts` | Modify | Add consistent user ID validation |

---

## Implementation Steps

### Step 1: Add Import

At the top of `electron/contact-handlers.ts`, add:

```typescript
import { getValidUserId } from "./utils/userIdHelper";
```

### Step 2: Update Handlers

For each handler that accepts `userId`, replace the validation pattern.

#### Handler: `contacts:get-all`

**Before:**
```typescript
const validatedUserId = validateUserId(userId);
if (!validatedUserId) {
  throw new ValidationError("User ID validation failed", "userId");
}
```

**After:**
```typescript
const validatedUserId = await getValidUserId(userId, "Contacts");
if (!validatedUserId) {
  return {
    success: false,
    error: "No valid user found in database",
  };
}
```

#### Handler: `contacts:get-available`

Same pattern as above.

#### Handler: `contacts:import`

Replace the inline validation (lines 416-434) with the helper:

**Before (lines 411-434):**
```typescript
let validatedUserId = validateUserId(userId);
if (!validatedUserId) {
  throw new ValidationError("User ID validation failed", "userId");
}

// BACKLOG-551: Verify user exists in database (ID may have been migrated)
const userExists = await databaseService.getUserById(validatedUserId);
if (!userExists) {
  // ... inline lookup logic ...
}
```

**After:**
```typescript
const validatedUserId = await getValidUserId(userId, "Contacts");
if (!validatedUserId) {
  return {
    success: false,
    error: "No valid user found in database",
  };
}
```

Note: Remove the `let` and make it `const` since we're no longer reassigning.

#### Handler: `contacts:get-sorted-by-activity`

Same pattern as `contacts:get-all`.

#### Handler: `contacts:create`

Same pattern as `contacts:get-all`.

#### Handler: `contacts:search`

Same pattern as `contacts:get-all`.

---

## Handlers Summary

| Handler | Has Validation? | Action |
|---------|-----------------|--------|
| `contacts:get-all` | validateUserId only | Add getValidUserId |
| `contacts:get-available` | validateUserId only | Add getValidUserId |
| `contacts:import` | Inline (BACKLOG-551) | Replace with getValidUserId |
| `contacts:get-sorted-by-activity` | validateUserId only | Add getValidUserId |
| `contacts:create` | validateUserId only | Add getValidUserId |
| `contacts:search` | validateUserId only | Add getValidUserId |
| `contacts:update` | Uses contactId | No change (gets userId from contact) |
| `contacts:delete` | Uses contactId | No change (gets userId from contact) |
| `contacts:remove` | Uses contactId | No change needed |
| `contacts:checkCanDelete` | Uses contactId | No change needed |
| `contacts:get-names-by-phones` | No userId | No change needed |

---

## Acceptance Criteria

- [ ] Import `getValidUserId` from `../utils/userIdHelper`
- [ ] `contacts:get-all` uses `getValidUserId()`
- [ ] `contacts:get-available` uses `getValidUserId()`
- [ ] `contacts:import` uses `getValidUserId()` (replaces inline code)
- [ ] `contacts:get-sorted-by-activity` uses `getValidUserId()`
- [ ] `contacts:create` uses `getValidUserId()`
- [ ] `contacts:search` uses `getValidUserId()`
- [ ] All handlers return proper error when no valid user found
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] No new test failures

---

## Testing

### Manual Testing

1. Test contact import with mismatched Supabase vs local user IDs
2. Test contact creation with mismatched user IDs
3. Verify FK constraint errors no longer occur
4. Verify existing functionality still works when IDs match

### Automated Testing

Existing tests should continue to pass. No new tests required as the pattern is already tested via the other handlers.

---

## Do / Don't

### Do:
- Use the existing `getValidUserId()` helper consistently
- Return early with error if no valid user found
- Keep the same error response format as other handlers

### Don't:
- Don't modify the `getValidUserId()` helper
- Don't add new validation logic - just apply the existing pattern
- Don't change handlers that don't accept userId
- Don't remove the `validateUserId()` calls - `getValidUserId()` handles different concerns

---

## PR Preparation

**Title**: `fix: apply getValidUserId pattern to contact-handlers.ts`

**Labels**: `sprint-062`, `bug`, `user-id-fix`

**PR Body Template**:
```markdown
## Summary
- Apply consistent user ID validation pattern to contact-handlers.ts
- Fixes FK constraint failures when Supabase auth.uid() differs from local users_local.id
- Related to BACKLOG-551 (user ID unification)

## Test Plan
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual test: contact import with mismatched user IDs
- [ ] Manual test: contact creation with mismatched user IDs

## Related
- BACKLOG-551: User ID unification
- BACKLOG-553: This specific fix
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | Pending |
| 6. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

### Files Changed
- [x] `electron/contact-handlers.ts` - Modified

### Approach Taken

Applied the `getValidUserId()` pattern consistently across all handlers that accept `userId`:

1. **Added import** for `getValidUserId` from `./utils/userIdHelper`
2. **Removed unused import** `validateUserId` from validation utilities
3. **Updated 6 handlers** to use `getValidUserId()`:
   - `contacts:get-all` (line 69)
   - `contacts:get-available` (line 125)
   - `contacts:import` (line 417) - replaced inline BACKLOG-551 fix
   - `contacts:get-sorted-by-activity` (line 581)
   - `contacts:create` (line 641)
   - `contacts:search` (line 975)

Each handler now:
- Calls `await getValidUserId(userId, "Contacts")` at the start
- Returns early with `{ success: false, error: "No valid user found in database" }` if null

The `contacts:import` handler previously had an inline implementation of this pattern (lines 416-434). This was replaced with the centralized helper for consistency with other handlers.

### Testing Done

- [x] `npm run type-check` passes
- [x] `npm run lint` passes for `electron/contact-handlers.ts`
- [x] Verified all 6 handlers updated with `getValidUserId()`
- [x] Verified unused `validateUserId` import removed

**Note:** Pre-existing lint error in `src/contexts/NotificationContext.tsx` (react-hooks/exhaustive-deps rule definition missing) is unrelated to this change.

### Notes for SR Review

- Pattern matches reference implementations in `microsoftAuthHandlers.ts`, `googleAuthHandlers.ts`, `sharedAuthHandlers.ts`
- All handlers return consistent error format when no valid user found
- No changes to handlers that don't accept userId (`contacts:update`, `contacts:delete`, `contacts:remove`, `contacts:checkCanDelete`, `contacts:get-names-by-phones`)

### Final Metrics

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Implement tokens | ~8K | TBD | TBD |
