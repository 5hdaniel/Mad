# TASK-2030: Export Service Utility Deduplication

**Backlog ID:** BACKLOG-758, BACKLOG-759, BACKLOG-760, BACKLOG-761
**Sprint:** SPRINT-090
**Phase:** 2b (Parallel with TASK-2029)
**Branch:** `refactor/task-2030-export-dedup`
**Estimated Tokens:** ~60K
**Token Cap:** ~240K (4x estimate)

---

## Objective

Extract 4 groups of duplicated utility functions from `pdfExportService.ts` and `folderExportService.ts` into a shared `electron/utils/exportUtils.ts` module. This is a pure refactoring task -- no logic changes, no new features.

---

## Context

During SPRINT-089 closure, a code duplication audit found multiple utility functions duplicated across the two main export services. Both services generate similar HTML-based output (PDFs and folder exports), so they share many formatting utilities that were copy-pasted. Extracting them improves maintainability and ensures bug fixes apply to both services simultaneously.

---

## Requirements

### Must Do:

1. **Extract `escapeHtml()`** -- 2 functionally identical implementations (different coding styles)
2. **Extract `formatCurrency()`** -- 2 identical copies
3. **Extract `formatDate()` and `formatDateTime()`** -- duplicated in both services despite `electron/utils/dateUtils.ts` existing
4. **Consolidate `getContactNamesByPhones()`** -- duplicated inline SQL in both services; extract into shared helper
5. **Update both export services** to import from the new shared module
6. **Delete the local copies** from each service

### Must NOT Do:

- Do NOT change any function logic or output format
- Do NOT modify any src/ renderer files (that is TASK-2029)
- Do NOT refactor the export services beyond utility extraction
- Do NOT change the export HTML templates or CSS
- Do NOT touch `enhancedExportService.ts` (it does not have these duplicates)

---

## Acceptance Criteria

- [ ] `electron/utils/exportUtils.ts` exists with `escapeHtml()`, `formatCurrency()`, `formatDate()`, `formatDateTime()`
- [ ] No duplicate `escapeHtml()` in pdfExportService.ts or folderExportService.ts
- [ ] No duplicate `formatCurrency()` in pdfExportService.ts or folderExportService.ts
- [ ] No duplicate `formatDate()`/`formatDateTime()` closures in pdfExportService.ts or folderExportService.ts
- [ ] `getContactNamesByPhones()` SQL logic exists in exactly one place (shared helper or one service importing from the other)
- [ ] Export output is byte-identical for the same input data
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Create

| File | Functions |
|------|-----------|
| `electron/utils/exportUtils.ts` | `escapeHtml(text: string): string`, `formatCurrency(amount?: number \| null): string`, `formatDate(dateString?: string \| Date \| null): string`, `formatDateTime(dateString: string \| Date): string` |

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/pdfExportService.ts` | Remove local `escapeHtml` (~line 587), `formatCurrency` (~line 175), `formatDate` (~line 184), `formatDateTime` (~line 195); import from `exportUtils` |
| `electron/services/folderExportService.ts` | Remove local `escapeHtml` (~line 2377), `formatCurrency` (~line 281), `formatDate` (~line 290); import from `exportUtils` |

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/utils/dateUtils.ts` | Existing date utility module; check if `formatDate`/`formatDateTime` should live here instead |
| `electron/services/contactResolutionService.ts` | Already has shared `resolvePhoneNames()` -- check if `getContactNamesByPhones` should delegate here |
| `electron/services/databaseService.ts` | May have relevant query patterns for `getContactNamesByPhones` |

---

## Implementation Notes

### escapeHtml -- Two Different Styles

The two implementations produce identical output but use different approaches:

**pdfExportService.ts (~line 587) -- sequential `.replace()` chains:**
```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**folderExportService.ts (~line 2377) -- single regex with lookup map:**
```typescript
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

Use the **single regex version** (folderExportService style) as it is more efficient. Both produce identical output.

### formatDate / formatDateTime -- Closure vs Module Function

Currently these are defined as closures inside class methods:
```typescript
const formatDate = (dateString?: string | Date | null): string => { ... };
```

When extracting to a module, convert to named exports:
```typescript
export function formatDate(dateString?: string | Date | null): string { ... }
```

Check `electron/utils/dateUtils.ts` first -- if it already has equivalent functions, use those instead of creating new ones.

### getContactNamesByPhones -- Special Handling

This function contains inline SQL queries. Options:

**Option A (Preferred):** Move the SQL query into `contactDbService.ts` or `contactResolutionService.ts` as a new method, then have both export services call it.

**Option B:** Extract to `exportUtils.ts` with a database handle parameter.

**Option C:** If the implementations differ significantly (different SQL, different joins), leave them in place and document why consolidation is not feasible.

Choose the option that minimizes risk. Document your choice in the Implementation Summary.

### formatCurrency -- Identical Copies

Both are identical:
```typescript
const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};
```

Straightforward extraction.

---

## Testing Expectations

### Unit Tests
- **Required:** No new test files required (pure refactoring)
- **Existing tests to verify:** All existing export service tests still pass
- **Optional:** Add unit tests for `exportUtils.ts` (escapeHtml edge cases, formatCurrency edge cases)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `refactor: extract duplicated export utilities into shared module`
- **Branch:** `refactor/task-2030-export-dedup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~60K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `escapeHtml` implementations produce different output for any edge case
- `getContactNamesByPhones` SQL queries differ significantly between the two services
- `electron/utils/dateUtils.ts` already has `formatDate`/`formatDateTime` with incompatible signatures
- Export service tests fail after extraction (may indicate hidden dependencies)
- You encounter blockers not covered in the task file
