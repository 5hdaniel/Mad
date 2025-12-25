# TASK-615: Duplicate Types Removal

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 1-2 → Actual: _ (variance: _%)
- Est Wall-Clock: 5-10 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 4-6 | **1-2** | - |
| **Tokens** | ~20K | ~6K | - |
| **Time** | 30-45m | **5-10 min** | **5-10 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

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
