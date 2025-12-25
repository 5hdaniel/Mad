# TASK-615: Duplicate Types Removal

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

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

Consolidate duplicate type definitions into centralized locations.

---

## Current State

Duplicate types found:
- `ExtendedContact` - defined in multiple component files
- `TransactionWithRoles` - defined locally in multiple places
- `Communication` - defined locally vs imported

---

## Requirements

### Must Do
1. Audit all type definitions
2. Identify duplicates
3. Consolidate to `src/types/` or `electron/types/`
4. Update all imports

### Must NOT Do
- Change type definitions
- Break existing code

---

## Audit Targets

| Type | Locations | Target |
|------|-----------|--------|
| `ExtendedContact` | Multiple components | `src/types/contact.ts` |
| `TransactionWithRoles` | Multiple components | `src/types/transaction.ts` |
| `Communication` | Local definitions | Import from `src/types/` |

---

## Files to Modify

- `src/types/*.ts` - Add consolidated types
- Component files - Update imports

---

## Acceptance Criteria

- [ ] No duplicate type definitions
- [ ] Types centralized in types/
- [ ] All imports updated
- [ ] `npm run type-check` passes

---

## Branch

```
feature/TASK-615-duplicate-types
```
