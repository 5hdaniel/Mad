# BACKLOG-560: Create messageService and Migrate useExportFlow.ts

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BACKLOG-560 |
| **Created** | 2026-01-28 |
| **Priority** | P2 |
| **Category** | Architecture |
| **Status** | Ready |
| **Estimate** | ~15K tokens |
| **Sprint** | TBD |

---

## Summary

Create a `messageService` to wrap `window.api.messages` calls, then migrate `useExportFlow.ts` to use the service instead of calling `window.api.messages.getConversations()` directly.

## Background

During TASK-1612 (Migrate State Hooks to Services), 7 of 8 hooks were successfully migrated to use the service layer. However, `useExportFlow.ts` could not be migrated because it calls `window.api.messages.getConversations()`, and there is no corresponding `messageService`.

This was deferred from TASK-1612 (PR #662) to avoid scope creep.

## Current State

`useExportFlow.ts` still calls `window.api` directly:

```typescript
// useExportFlow.ts
const result = await window.api.messages.getConversations();
```

## Proposed Solution

1. **Create `src/services/messageService.ts`:**
   ```typescript
   export const messageService = {
     getConversations: () => window.api.messages.getConversations(),
     // Add other message-related methods as needed
   };
   ```

2. **Update `src/services/index.ts`:**
   ```typescript
   export { messageService } from './messageService';
   ```

3. **Migrate `useExportFlow.ts`:**
   ```typescript
   import { messageService } from '@/services';

   // Replace:
   // const result = await window.api.messages.getConversations();
   // With:
   const result = await messageService.getConversations();
   ```

4. **Update tests** to mock `messageService` instead of `window.api.messages`

## Acceptance Criteria

- [ ] `messageService.ts` created with `getConversations()` method
- [ ] `useExportFlow.ts` uses `messageService` instead of `window.api`
- [ ] No direct `window.api.messages` calls in `useExportFlow.ts`
- [ ] Tests updated to mock `messageService`
- [ ] All CI checks pass

## Files to Modify

| File | Action |
|------|--------|
| `src/services/messageService.ts` | Create |
| `src/services/index.ts` | Modify (add export) |
| `src/appCore/state/flows/useExportFlow.ts` | Modify (use service) |
| `src/appCore/state/flows/useExportFlow.test.ts` | Modify (update mocks) |

## Related Items

- **Deferred from:** TASK-1612 (PR #662)
- **Blocks:** Complete service layer migration
- **Related:** BACKLOG-549 (Service layer architecture)

## Notes

This is a straightforward extension of the service layer pattern established in TASK-1610/1611/1612. The implementation should follow the same patterns used for `authService`, `settingsService`, and `systemService`.
