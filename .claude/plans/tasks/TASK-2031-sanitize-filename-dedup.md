# TASK-2031: Extract Duplicated sanitizeFilename() to Shared Utility

**Backlog ID:** BACKLOG-766
**Sprint:** SPRINT-090
**Phase:** 3a (Sequential after Phase 2)
**Branch:** `refactor/task-2031-sanitize-filename-dedup`
**Estimated Tokens:** ~30K
**Token Cap:** ~120K (4x estimate)

---

## Objective

Extract the duplicated `sanitizeFilename()` function from `emailAttachmentService.ts` and `enhancedExportService.ts` into a single shared utility. This is a pure refactoring task -- no logic changes.

---

## Context

During SPRINT-090 closure planning, a deduplication audit found `sanitizeFilename()` implemented in two places with slightly different names but identical purpose: stripping characters that are invalid in filenames.

TASK-2030 (Phase 2b) already created `electron/utils/exportUtils.ts` for export-related utility dedup. The sanitize function could live there or in a new `electron/utils/fileUtils.ts` depending on semantic fit.

---

## Requirements

### Must Do:

1. **Read both implementations** to confirm they are functionally equivalent
   - `electron/services/emailAttachmentService.ts` line ~63: `sanitizeFilename()`
   - `electron/services/enhancedExportService.ts` line ~629: `_sanitizeFileName()`
2. **Pick the more robust implementation** (or merge the best parts of both)
3. **Extract to a shared location** -- either:
   - `electron/utils/fileUtils.ts` (new file, preferred if function is general-purpose)
   - `electron/utils/exportUtils.ts` (existing file from TASK-2030, if it fits semantically)
4. **Update both services** to import from the shared module
5. **Delete the local copies** from each service

### Must NOT Do:

- Do NOT change the sanitization logic or behavior
- Do NOT modify any `src/` renderer files
- Do NOT refactor the services beyond this single extraction
- Do NOT touch any other utility functions in those services

---

## Acceptance Criteria

- [ ] `sanitizeFilename()` (or equivalent) exists in exactly one shared utility file
- [ ] `emailAttachmentService.ts` imports from the shared utility (no local copy)
- [ ] `enhancedExportService.ts` imports from the shared utility (no local copy)
- [ ] Both services produce identical filename output as before
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/emailAttachmentService.ts` (~line 63) | Source implementation #1 |
| `electron/services/enhancedExportService.ts` (~line 629) | Source implementation #2 |
| `electron/utils/exportUtils.ts` | May already exist from TASK-2030; check if sanitizeFilename fits here |

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/emailAttachmentService.ts` | Remove local `sanitizeFilename()`; import from shared module |
| `electron/services/enhancedExportService.ts` | Remove local `_sanitizeFileName()`; import from shared module |

## Files to Create (potentially)

| File | Functions |
|------|-----------|
| `electron/utils/fileUtils.ts` | `sanitizeFilename(name: string): string` |

OR add to existing `electron/utils/exportUtils.ts` if TASK-2030 created it and it fits semantically.

---

## Implementation Notes

### Comparing the Two Implementations

Read both carefully before extracting. They may differ in:
- Character sets replaced (one might be more conservative)
- Handling of edge cases (empty string, very long names, leading dots)
- Return type or default values

Pick whichever handles more edge cases. If they differ materially, document the choice in the Implementation Summary.

### Naming Decision

- If the function is only used by export-related services, put it in `exportUtils.ts`
- If it could be useful for any file I/O (database exports, log files, etc.), create `fileUtils.ts`
- Document your choice in the Implementation Summary

---

## Testing Expectations

### Unit Tests
- **Required:** No new test files required (pure refactoring, small scope)
- **Existing tests to verify:** Any existing tests in emailAttachmentService or enhancedExportService still pass
- **Optional:** Add 2-3 unit tests for the extracted function (special characters, empty string, long filename)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `refactor: extract duplicated sanitizeFilename to shared utility`
- **Branch:** `refactor/task-2031-sanitize-filename-dedup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-21*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: 2026-02-21
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [x] CI passes (gh pr checks --watch)
- [x] SR Engineer review requested

Completion:
- [x] SR Engineer approved and merged
- [x] PM notified for next task
```

### Results

- **Before**: sanitizeFilename() duplicated in emailAttachmentService.ts and _sanitizeFileName() in enhancedExportService.ts with slightly different implementations
- **After**: Single sanitizeFilename() extracted to shared utility, both services import from shared module. Local copies removed.
- **Actual Tokens**: ~20K (Est: ~30K)
- **PR**: #914, merged 2026-02-21

### Notes

**Deviations from plan:**
None. Straightforward extraction as planned.

**Issues encountered:**
**Issues/Blockers:** None

---

## Guardrails

**STOP and ask PM if:**
- The two implementations produce materially different output for any input
- Either service has tests that specifically test the sanitize function with edge cases that differ
- The function signatures are incompatible (different parameter counts or types)
- `electron/utils/exportUtils.ts` does not exist (TASK-2030 not yet merged)
- You encounter blockers not covered in the task file
