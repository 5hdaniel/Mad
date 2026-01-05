# TASK-974: Decompose AuditTransactionModal Component

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-158
**Status:** Ready
**Estimate:** ~60K tokens
**Token Cap:** 150K
**Depends On:** TASK-970, TASK-972 (tests protect refactoring)

---

## Context

`AuditTransactionModal.tsx` is 1,187 lines - the largest component in the codebase. It violates single responsibility principle and is difficult to maintain.

## Current Structure Analysis

Before refactoring, analyze the component to identify:
1. Form field sections
2. Event handlers
3. State management
4. API calls
5. Validation logic

## Proposed Decomposition

| New File | Lines | Responsibility |
|----------|-------|---------------|
| `components/audit/AuditTransactionForm.tsx` | ~200 | Form fields, layout |
| `components/audit/AddressInput.tsx` | ~150 | Address autocomplete |
| `components/audit/ContactAssignment.tsx` | ~150 | Contact selection |
| `hooks/useAuditTransaction.ts` | ~200 | Business logic |
| `AuditTransactionModal.tsx` | <300 | Orchestration only |

## Extraction Order

1. **Extract hook first** - `useAuditTransaction.ts`
   - Move state and handlers
   - Keep UI in modal temporarily

2. **Extract AddressInput** - Standalone component
   - Address field with autocomplete
   - Props: value, onChange, onSelect

3. **Extract ContactAssignment** - Standalone component
   - Contact multi-select
   - Props: selected, onChange, contacts

4. **Extract AuditTransactionForm** - Form container
   - Combines all form fields
   - Uses extracted components

5. **Final cleanup** - Modal as orchestrator
   - Only modal chrome and composition
   - <300 lines

## Branch

```bash
git checkout -b refactor/TASK-974-decompose-audit-modal develop
```

## Testing Strategy

```bash
# Run existing tests before each extraction
npm test -- --testPathPattern=AuditTransaction

# Verify no functionality changes
npm run type-check
```

## Acceptance Criteria

- [ ] AuditTransactionModal.tsx <300 lines
- [ ] 4-5 new files created
- [ ] All existing tests pass
- [ ] No functionality changes
- [ ] Each component is independently testable

## PR Structure

Single PR with clear commit history:
1. `refactor: extract useAuditTransaction hook`
2. `refactor: extract AddressInput component`
3. `refactor: extract ContactAssignment component`
4. `refactor: extract AuditTransactionForm component`
5. `refactor: clean up AuditTransactionModal orchestrator`

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 60K) / 60K × 100]_%
