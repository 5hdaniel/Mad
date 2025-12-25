# TASK-604: Renderer Service Layer

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 3 - Service Layer Foundation
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-603

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

---

## Objective

Create a service layer abstraction in `src/services/` to centralize all `window.api` calls, enabling:
1. Consistent error handling
2. Type-safe API access
3. Easier testing (mockable services)
4. Single source of truth for API contracts

---

## Current State

- 37 files have scattered `window.api.*` calls
- `src/services/transactionService.ts` exists as a good pattern
- No consistent error handling across components

---

## Requirements

### Must Do
1. Create service files for each API domain
2. Follow pattern from existing `transactionService.ts`
3. Wrap all `window.api` calls with proper types
4. Add consistent error handling

### Must NOT Do
- Change any existing component behavior yet (Phase 4 will migrate)
- Modify window.api contracts
- Add business logic to services (pure API abstraction)

---

## Proposed Service Structure

```
src/services/
  index.ts                    (barrel export)
  transactionService.ts       (exists - enhance if needed)
  contactService.ts           (new)
  authService.ts              (new)
  communicationService.ts     (new)
  settingsService.ts          (new)
  llmService.ts               (new)
  systemService.ts            (new)
  outlookService.ts           (new)
  syncService.ts              (new)
  exportService.ts            (new)
```

---

## Service Pattern

Follow `transactionService.ts` pattern:

```typescript
// src/services/contactService.ts
import type { Contact, ContactCreateInput, ContactUpdateInput } from "@/types";

export interface ApiResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export const contactService = {
  /**
   * Get all contacts for a user
   */
  async getAll(userId: string): Promise<ApiResult<Contact[]>> {
    try {
      const result = await window.api.contacts.getAll(userId);
      if (result.success) {
        return { success: true, data: result.contacts || [] };
      }
      return { success: false, error: result.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  },

  /**
   * Create a new contact
   */
  async create(input: ContactCreateInput): Promise<ApiResult<Contact>> {
    try {
      const result = await window.api.contacts.create(input);
      if (result.success) {
        return { success: true, data: result.contact };
      }
      return { success: false, error: result.error };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  },

  // ... other methods
};

export default contactService;
```

---

## Files to Create

| File | API Domain | Key Methods |
|------|------------|-------------|
| `src/services/contactService.ts` | contacts | getAll, create, update, delete, import |
| `src/services/authService.ts` | auth | login, logout, getSession, googleConnect |
| `src/services/communicationService.ts` | communications | getAll, getByContact, getThread |
| `src/services/settingsService.ts` | settings | get, set, getAll |
| `src/services/llmService.ts` | llm | analyze, getConfig, setConfig |
| `src/services/systemService.ts` | system | getInfo, openSettings, getPaths |
| `src/services/outlookService.ts` | outlook | connect, getEmails, sync |
| `src/services/syncService.ts` | sync | start, stop, getStatus |
| `src/services/exportService.ts` | export | conversation, allConversations |
| `src/services/index.ts` | - | Barrel export |

---

## Testing Requirements

1. **Unit Tests**
   - Test each service method
   - Mock window.api calls
   - Test error handling

2. **Type Check**
   - All services properly typed
   - ApiResult<T> consistent

---

## Acceptance Criteria

- [ ] All service files created
- [ ] Consistent ApiResult<T> pattern
- [ ] Proper TypeScript types
- [ ] Unit tests for key services
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-604-service-layer
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
