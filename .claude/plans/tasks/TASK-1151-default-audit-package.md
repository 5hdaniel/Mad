# TASK-1151: Default Export to Audit Package, One PDF as "Coming Soon"

**Backlog ID:** BACKLOG-360
**Sprint:** SPRINT-048
**Phase:** 1 (Track A - Export Modal, First Task)
**Branch:** `feature/task-1151-default-audit-package`
**Estimated Turns:** 4-6
**Estimated Tokens:** 8K-15K

---

## Objective

Update the export modal to default to "Audit Package" format and mark "One PDF" (combined PDF) option as "Coming Soon" and disabled. This prioritizes the more complete Audit Package export as the default user experience.

---

## Context

The export modal currently allows selection between PDF and Audit Package formats. User feedback indicates:
1. Audit Package (folder export) is the preferred format for compliance audits
2. "One PDF" (combined PDF) is not fully implemented yet
3. Users should be guided toward the complete solution by default

Current default is "pdf" format. This should change to "folder" (Audit Package).

---

## Requirements

### Must Do:
1. Change default `exportFormat` from "pdf" to "folder"
2. Rename current "PDF Report" to "Summary PDF" or similar
3. Add "One PDF (Coming Soon)" option that is disabled/grayed out
4. Ensure "Audit Package" shows "(Recommended)" indicator
5. Preserve user preference loading from settings (if format is valid)

### Must NOT Do:
- Remove any existing export functionality
- Change the actual export logic
- Affect Excel, CSV, JSON options (already Coming Soon)

---

## Acceptance Criteria

- [ ] Audit Package is default selected option on modal open
- [ ] Audit Package shows "(Recommended)" label
- [ ] "One PDF" shows "(Coming Soon)" label
- [ ] "One PDF" option is disabled and cannot be selected
- [ ] Clear visual distinction for disabled options
- [ ] User preference still loads if it's for a valid format
- [ ] Summary PDF (formerly "PDF Report") remains selectable

---

## Files to Modify

- `src/components/ExportModal.tsx` - Change default format, add One PDF option

## Files to Read (for context)

- `src/components/ExportModal.tsx` - Current implementation, especially lines 50-62 (format state) and 405-480 (format buttons)

---

## Technical Notes

### Current Format Options (lines 405-480)
```tsx
// Active
"pdf" - PDF Report (single file)
"folder" - Audit Package

// Coming Soon (disabled)
"excel", "csv", "json", "txt_eml"
```

### Proposed Changes
```tsx
// Default should be "folder" instead of "pdf"
const [exportFormat, setExportFormat] = useState("folder");

// Add "One PDF" as Coming Soon
// Keep "pdf" as "Summary PDF" or similar
// "folder" is "Audit Package (Recommended)"
```

### User Preference Loading
Lines 65-88 load saved preference. Ensure "folder" is in `implementedFormats` (it already is).

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI state change)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Open export modal - Audit Package is selected
- [ ] Verify "(Recommended)" appears next to Audit Package
- [ ] Verify "One PDF (Coming Soon)" is grayed out
- [ ] Click One PDF - should not be selectable
- [ ] Verify Summary PDF still works

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(export): default to audit package and mark one pdf coming soon`
- **Branch:** `feature/task-1151-default-audit-package`
- **Target:** `int/sprint-ui-export-and-details`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-ui-export-and-details
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

- **Before**: PDF Report is default, no One PDF option
- **After**: Audit Package default with (Recommended), One PDF (Coming Soon) disabled
- **Actual Turns**: X (Est: 4-6)
- **Actual Tokens**: ~XK (Est: 8-15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- User preferences break when format is not in implementedFormats
- Existing tests fail due to default format change
- You need to modify the export service layer
- You encounter blockers not covered in the task file
