# BACKLOG-097: Relocate Root-Level Test Files to Feature __tests__/ Folders

## Priority: Medium

## Category: refactor

## Summary

Move 17 root-level test files in `src/components/__tests__/` to their respective feature module `__tests__/` folders for better co-location of tests with their source code.

## Problem

There are approximately 17 test files sitting at `src/components/__tests__/` that test components which now live in feature-specific modules. This violates the principle of co-locating tests with their source code.

Current structure:
```
src/components/
+-- __tests__/
|   +-- ContactDetailsModal.test.tsx  # Should be in contact/__tests__/
|   +-- TransactionList.test.tsx      # Should be in transaction/__tests__/
|   +-- ...
+-- contact/
|   +-- ContactDetailsModal.tsx       # Source lives here
+-- transaction/
    +-- TransactionList.tsx           # Source lives here
```

## Solution

Relocate test files to their respective feature `__tests__/` folders:

```
src/components/
+-- contact/
|   +-- __tests__/
|   |   +-- ContactDetailsModal.test.tsx  # Moved here
|   +-- ContactDetailsModal.tsx
+-- transaction/
    +-- __tests__/
    |   +-- TransactionList.test.tsx      # Moved here
    +-- TransactionList.tsx
```

## Implementation

1. Inventory all test files in `src/components/__tests__/`
2. For each test file:
   a. Identify the source component it tests
   b. Determine the feature module where the source lives
   c. Create `__tests__/` folder in that module if needed
   d. Move the test file
   e. Update any relative imports in the test file
3. Verify all tests still pass
4. Delete empty `src/components/__tests__/` if all files moved

## Test Files to Relocate

Expected relocations (verify actual files before executing):

| Test File | Source Component | Target Location |
|-----------|------------------|-----------------|
| `ContactDetailsModal.test.tsx` | `contact/` | `contact/__tests__/` |
| `ContactList.test.tsx` | `contact/` | `contact/__tests__/` |
| `TransactionList.test.tsx` | `transaction/` | `transaction/__tests__/` |
| `TransactionCard.test.tsx` | `transaction/` | `transaction/__tests__/` |
| ... | ... | ... |

**Note:** Exact file list should be verified by examining `src/components/__tests__/` before execution.

## Acceptance Criteria

- [ ] All 17 test files relocated to appropriate feature `__tests__/` folders
- [ ] Relative imports in test files updated
- [ ] Root `__tests__/` folder removed or contains only truly shared tests
- [ ] `npm test` passes with all tests
- [ ] Test coverage unchanged

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 6-8 | Many files to move, imports to update |
| Tokens | ~30K | |
| Time | 45-60 min | |

## Dependencies

- Should be executed AFTER module creation tasks (BACKLOG-093 through BACKLOG-096)
- Tests for components in new modules need those modules created first

## Execution Order

Recommended to execute after:
1. BACKLOG-093 (common/ module)
2. BACKLOG-094 (llm/ module)
3. BACKLOG-095 (email/ module)
4. BACKLOG-096 (system/ module)

This ensures target `__tests__/` folders exist before moving tests.
