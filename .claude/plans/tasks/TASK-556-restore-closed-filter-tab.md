# Task TASK-556: Restore "Closed" Filter Tab

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Restore the "Closed" filter tab that was removed, allowing users to see historical/archived transactions.

## Non-Goals

- Do NOT change other filter tabs
- Do NOT modify filter logic beyond adding Closed
- Do NOT implement new filter UI patterns

## Deliverables

1. Update: Transaction list/filter component - Add "Closed" tab
2. Update: Filter constants/types - Add "closed" filter option

## Acceptance Criteria

- [ ] "Closed" tab visible in filter bar
- [ ] Clicking shows transactions with status `closed` or `archived`
- [ ] Count badge shows correct number of closed transactions
- [ ] Tab styling matches existing tabs
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Filter Bar Addition

Add "Closed" to the filter tabs, likely after "Active":

```
[All] [Active] [Closed] | [Submitted] [Under Review] ...
```

### Filter Logic

The "Closed" filter should match:
- `status === 'closed'`
- `status === 'archived'` (if this status exists)

```typescript
// Example filter logic
const closedFilter = (transaction: Transaction) =>
  transaction.status === 'closed' || transaction.status === 'archived';
```

### Files to Modify

Look for:
- `src/components/Transactions.tsx` or similar
- Filter constants file (e.g., `src/constants/filters.ts`)
- Filter type definitions

### Verify Status Values

Check valid status values in TypeScript types (from TASK-550):

```bash
grep -n "status.*:" src/types/transaction.ts
```

## Integration Notes

- Depends on: TASK-550 (types), TASK-555 (clean filter logic)
- Used by: TASK-557 (visual separator)
- Conflicts with: TASK-555 (sequential execution required)

## Do / Don't

### Do:
- Match styling of existing filter tabs
- Include count badge
- Handle empty state (no closed transactions)

### Don't:
- Remove other filter tabs
- Change existing filter behavior
- Add complex filtering options

## When to Stop and Ask

- If status values don't include "closed"
- If filter component architecture is different than expected
- If adding the tab requires significant refactoring

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Add test for Closed filter
- Existing tests: Must pass

### Integration Tests

- Verify clicking Closed shows correct transactions

### CI Requirements

- [ ] Unit tests pass
- [ ] Type checking passes

## PR Preparation

- **Title**: `feat(filters): restore Closed filter tab`
- **Labels**: `feature`, `ui`, `filters`
- **Depends on**: TASK-555

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 48K (4x upper estimate)

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Verification

- [ ] Closed tab visible
- [ ] Shows correct transactions
- [ ] Count badge accurate
- [ ] npm test passes

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
