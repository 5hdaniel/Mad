# BACKLOG-152: Split TransactionDetails.tsx into Tab Components

## Priority: Medium

## Category: refactor

## Summary

Split `TransactionDetails.tsx` (832 lines) into tab-specific components and extract API logic to service abstractions.

## Problem

`src/components/transaction/components/TransactionDetails.tsx` at 832 lines is a large modal component containing:
- Multiple tabs (details, communications, attachments, etc.)
- Direct `window.api` calls (architecture violation)
- Mixed presentation and data fetching logic
- Complex state management

This violates architecture guardrails from `.claude/docs/shared/architecture-guardrails.md`:
- Direct `window.api` calls should use service abstractions
- Large components should be split into focused sub-components

## Solution

### Phase 1: Extract Tab Components

```
src/components/transaction/
+-- components/
    +-- TransactionDetails.tsx      # Main modal (target: <400 lines)
    +-- tabs/
        +-- index.ts                # Barrel export
        +-- TransactionInfoTab.tsx  # Basic transaction info
        +-- CommunicationsTab.tsx   # Emails/texts display
        +-- AttachmentsTab.tsx      # File attachments
        +-- ContactsTab.tsx         # Associated contacts
        +-- TimelineTab.tsx         # Transaction timeline (if exists)
```

### Phase 2: Extract API Logic to Services

Replace direct `window.api` calls with service abstractions:

```typescript
// Before (architecture violation)
const data = await window.api.getTransactionDetails(id);

// After (uses service abstraction)
import { transactionService } from '@/services';
const data = await transactionService.getDetails(id);
```

## Implementation Steps

### Step 1: Analysis (~30 min)
1. Identify all tabs in the modal
2. Map `window.api` calls and their purposes
3. Identify shared state between tabs
4. Plan extraction boundaries

### Step 2: Tab Extraction (~2 hours)
1. Extract each tab to its own component
2. Pass required props from parent
3. Keep tab switching logic in main component
4. Create barrel exports

### Step 3: API Service Migration (~1 hour)
1. Identify or create service abstractions
2. Replace direct `window.api` calls
3. Add proper error handling
4. Add TypeScript types for API responses

### Step 4: Cleanup (~30 min)
1. Update imports
2. Verify all tests pass
3. Manual testing of all tabs

## Acceptance Criteria

- [ ] `TransactionDetails.tsx` reduced to <400 lines
- [ ] All tabs extracted to dedicated components
- [ ] No direct `window.api` calls in components
- [ ] Service abstractions used for all API calls
- [ ] All functionality preserved (no behavior changes)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual testing of transaction details modal

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Tokens | ~50K | Medium refactor with API migration |
| Duration | 4-6 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Tokens | ~25K |

## Dependencies

- BACKLOG-111 (Migrate Components to Service Abstractions) addresses the API migration pattern
- Can be done independently, but benefits from service abstraction work being done first

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking tab navigation | Keep tab state in parent component |
| API call regressions | Integration tests for each tab |
| State sharing issues | Use context or props carefully |

## Notes

**This item is SR Engineer sourced from architecture review (2026-01-04).**

This task combines two concerns:
1. Component size reduction (tab extraction)
2. Architecture compliance (API call migration)

Consider splitting into two tasks if preferred:
- TASK-A: Tab extraction (pure refactor)
- TASK-B: API migration (depends on BACKLOG-111 patterns)

## Related Items

- BACKLOG-111: Migrate Components to Service Abstractions (establishes patterns)
- BACKLOG-098: Split AuditTransactionModal.tsx (similar refactor pattern)
