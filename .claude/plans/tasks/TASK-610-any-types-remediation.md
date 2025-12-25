# TASK-610: Any Types Remediation

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
**Status:** Pending
**Depends On:** TASK-609

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
- Est Turns: 2-3 → Actual: _ (variance: _%)
- Est Wall-Clock: 10-15 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 8-10 | **2-3** | - |
| **Tokens** | ~40K | ~12K | - |
| **Time** | 1-1.5h | **10-15 min** | **10-15 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Replace `any` type usages across the codebase with proper TypeScript types.

SR Engineer audit found 114 occurrences across 37 files.

---

## Current State

High occurrence files:
| File | `any` Count |
|------|-------------|
| `src/components/Contacts.tsx` | 15 |
| `src/components/Transactions.tsx` | 13 |
| `src/components/TransactionDetails.tsx` | 8 |

---

## Requirements

### Must Do
1. Audit all `any` usages
2. Replace with proper types or `unknown` + type guards
3. Reduce to < 10 justified `any` usages
4. Document any remaining `any` with // eslint-disable-line comment explaining why

### Must NOT Do
- Add @ts-ignore
- Weaken type safety elsewhere
- Change runtime behavior

---

## Replacement Strategy

### Pattern 1: Event handlers
```typescript
// Bad
const handleChange = (e: any) => { ... }

// Good
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }
```

### Pattern 2: API responses
```typescript
// Bad
const result: any = await window.api.getData();

// Good
interface DataResult {
  success: boolean;
  data?: SomeType;
  error?: string;
}
const result = await window.api.getData() as DataResult;
```

### Pattern 3: Unknown external data
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (isValidData(data)) {
    // data is now typed
  }
}
```

---

## Files to Modify

Audit and fix all 37 files with `any` usage, prioritizing:
1. Components with highest counts
2. Service files
3. Type definition files

---

## Testing Requirements

1. **Type Check**
   - `npm run type-check` passes
   - No new type errors introduced

2. **Existing Tests**
   - All tests pass
   - No behavior changes

---

## Acceptance Criteria

- [ ] `any` count reduced from 114 to < 10
- [ ] Remaining `any` documented with justification
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Branch

```
feature/TASK-610-any-types-remediation
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
