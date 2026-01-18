# BACKLOG-158: Decompose AuditTransactionModal Component

## Summary

`AuditTransactionModal.tsx` is 1,187 lines - the largest component in the codebase. It should be decomposed into smaller, focused components.

## Problem

The component handles too many concerns:
- Transaction form fields
- Address input with autocomplete
- Contact assignment UI
- Validation logic
- API interactions
- Modal state management

This violates single responsibility principle and makes the code hard to maintain and test.

## Proposed Decomposition

| New File | Responsibility | Est. Lines |
|----------|---------------|------------|
| `AuditTransactionForm.tsx` | Form fields and layout | ~200 |
| `AddressInput.tsx` | Address autocomplete component | ~150 |
| `ContactAssignment.tsx` | Contact selection UI | ~150 |
| `useAuditTransaction.ts` | Business logic hook | ~200 |
| `AuditTransactionModal.tsx` | Orchestrator only | <300 |

## Acceptance Criteria

- [ ] Parent component reduced to <300 lines
- [ ] 4-5 new files extracted
- [ ] All existing functionality preserved
- [ ] All existing tests pass
- [ ] New components are individually testable

## Priority

**MEDIUM** - Important for maintainability but not blocking

## Estimate

~60K tokens

## Category

refactor

## Dependencies

Should have good test coverage before refactoring (BACKLOG-112, 113)
