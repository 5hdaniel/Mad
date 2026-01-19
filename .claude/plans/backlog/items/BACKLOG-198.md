# BACKLOG-198: Decompose Large Component Files

## Summary

Review and decompose large component files for better maintainability:
- `AttachMessagesModal.tsx` (826 lines)
- `LLMSettings.tsx` (820 lines)

## Problem

Components over 500 lines typically handle too many concerns:
- Multiple UI states
- Complex business logic
- Nested sub-components
- Multiple data flows

This makes them:
- Hard to understand
- Difficult to test
- Risky to modify
- Slow to render

## Current State

| File | Lines | Location |
|------|-------|----------|
| `AttachMessagesModal.tsx` | 826 | `src/components/transactionDetailsModule/components/modals/` |
| `LLMSettings.tsx` | 820 | `src/components/settings/` |

## Proposed Decomposition

### AttachMessagesModal.tsx (826 lines)

| New File | Responsibility | Est. Lines |
|----------|---------------|------------|
| `AttachMessagesModal.tsx` | Orchestrator, modal shell | ~150 |
| `ContactsList.tsx` | Contact selection view | ~200 |
| `ThreadSelection.tsx` | Thread/message selection | ~200 |
| `useAttachMessages.ts` | Business logic hook | ~150 |
| `AttachMessages.types.ts` | Type definitions | ~50 |

### LLMSettings.tsx (820 lines)

| New File | Responsibility | Est. Lines |
|----------|---------------|------------|
| `LLMSettings.tsx` | Orchestrator | ~150 |
| `ProviderConfig.tsx` | Provider-specific settings | ~200 |
| `ModelSelector.tsx` | Model selection UI | ~150 |
| `CostDisplay.tsx` | Token/cost information | ~100 |
| `useLLMSettings.ts` | Settings state management | ~150 |

## Acceptance Criteria

- [ ] Both parent components reduced to <200 lines
- [ ] New components are individually testable
- [ ] All existing functionality preserved
- [ ] All existing tests pass
- [ ] No performance regressions

## Priority

**LOW** - Maintainability improvement

## Estimate

~60K tokens total
- AttachMessagesModal: ~30K
- LLMSettings: ~30K

## Category

refactor

## Impact

- Improved maintainability
- Easier testing
- Better code reuse
- Clearer component boundaries

## Dependencies

- Consider adding tests first to ensure refactor safety

## Related Items

- BACKLOG-158: Decompose AuditTransactionModal Component
- BACKLOG-098: Split AuditTransactionModal.tsx
