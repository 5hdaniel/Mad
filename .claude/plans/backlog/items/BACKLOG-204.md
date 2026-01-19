# BACKLOG-204: Abstract window.api Calls into Service Layer

## Summary

Migrate direct `window.api` calls from React components to proper service layer abstractions in `src/services/`.

## Problem

Multiple React components make direct calls to `window.api.*` instead of using the service layer. This violates architecture principles:

1. **Coupling** - Components directly depend on Electron IPC structure
2. **Testability** - Harder to mock IPC calls in component tests
3. **Maintainability** - Changes to IPC interface require component updates
4. **Consistency** - Mix of direct calls and service calls creates confusion

## Current State

Components with direct `window.api` calls (partial list):
- `src/components/Settings.tsx`
- `src/components/Transactions.tsx`
- `src/components/TransactionDetails.tsx`
- `src/components/transactionDetailsModule/components/*.tsx`
- `src/components/onboarding/steps/PermissionsStep.tsx`
- `src/components/audit/RoleAssignment.tsx`
- `src/components/transaction/components/EditTransactionModal.tsx`

## Proposed Solution

### Phase 1: Audit and Categorize (~10K tokens)
1. Enumerate all `window.api` calls in components
2. Categorize by domain (auth, transactions, contacts, system, etc.)
3. Map to existing or needed service abstractions

### Phase 2: Extend Service Layer (~30K tokens)
1. Add missing methods to existing services
2. Create new services if needed (e.g., `messageService.ts`)
3. Ensure consistent error handling and typing

### Phase 3: Migrate Components (~40K tokens)
1. Replace direct calls with service methods
2. Update component tests to mock services
3. Verify all functionality still works

## Files to Modify

### Services (extend or create)
- `src/services/authService.ts`
- `src/services/transactionService.ts`
- `src/services/systemService.ts`
- `src/services/deviceService.ts`
- `src/services/contactService.ts` (may need creation)
- `src/services/messageService.ts` (may need creation)

### Components (migrate)
- Multiple components in `src/components/`
- Multiple hooks in `src/components/*/hooks/`

## Acceptance Criteria

- [ ] No direct `window.api` calls in component files
- [ ] All IPC calls routed through service layer
- [ ] Services have proper TypeScript types
- [ ] Existing tests continue to pass
- [ ] Component tests mock services (not window.api)
- [ ] Documentation updated with service patterns

## Priority

**MEDIUM** - Architecture improvement, not blocking features

## Estimate

| Phase | Est. Tokens |
|-------|-------------|
| Phase 1: Audit | ~10K |
| Phase 2: Services | ~30K |
| Phase 3: Migration | ~40K |
| **Total** | ~80K |

## Category

refactor

## Impact

- Improves testability of React components
- Reduces coupling to Electron IPC layer
- Enables future changes to IPC without component updates
- Establishes clear architecture boundaries

## Dependencies

- Should be done after BACKLOG-191 (service layer tests) for better coverage
- Complements BACKLOG-111 (Migrate Components to Service Abstractions)

## Related Items

- BACKLOG-111: Migrate Components to Service Abstractions (similar scope)
- BACKLOG-191: Add Test Coverage for Core Service Layer
- Architecture Guardrails: `.claude/docs/shared/architecture-guardrails.md`

## Technical Notes

### Current Service Pattern
```typescript
// src/services/authService.ts
export const authService = {
  login: async (email: string, password: string) => {
    return window.api.auth.login(email, password);
  },
  // ...
};
```

### Usage Pattern in Components
```typescript
// Before (direct call)
const user = await window.api.auth.getCurrentUser();

// After (service abstraction)
import { authService } from '../services/authService';
const user = await authService.getCurrentUser();
```
