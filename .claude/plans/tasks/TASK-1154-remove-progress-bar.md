# TASK-1154: Remove Progress Bar from Audit Package Exporter

**Backlog ID:** BACKLOG-361
**Sprint:** SPRINT-048
**Phase:** 1 (Track A - Export Modal, Last Task)
**Branch:** `feature/task-1154-remove-progress-bar`
**Estimated Turns:** 2-4
**Estimated Tokens:** 4K-8K

---

## Objective

Remove the progress bar and "X/X" count display from the Audit Package export process. Keep only a spinning animation and status text to indicate export is in progress.

---

## Context

The current Audit Package export shows a detailed progress bar with count:
```
Exporting...
[====>                    ]
15 / 47
```

User feedback suggests this detailed progress creates anxiety if it seems slow, and the current implementation may not accurately reflect actual progress. A simple animation is cleaner and sets appropriate expectations.

---

## Requirements

### Must Do:
1. Remove progress bar from Audit Package (folder) export
2. Remove "X / X" count display
3. Keep spinning/loading animation
4. Keep "Exporting..." or similar status text
5. Keep the stage message (e.g., "Exporting emails...")

### Must NOT Do:
- Remove progress tracking from PDF export (only affects Audit Package)
- Change the export logic or timing
- Remove all visual feedback (keep spinner + text)

---

## Acceptance Criteria

- [ ] Progress bar removed from Audit Package export
- [ ] X/X count removed
- [ ] Spinning/loading animation remains
- [ ] Status text with stage message remains
- [ ] PDF export (if it has progress) is unchanged

---

## Files to Modify

- `src/components/ExportModal.tsx` - Modify Step 3 (Exporting) UI for folder export

## Files to Read (for context)

- `src/components/ExportModal.tsx` - Step 3 implementation (lines 498-526)

---

## Technical Notes

### Current Implementation (lines 498-526)
```tsx
{/* Step 3: Exporting */}
{step === 3 && (
  <div className="py-8 text-center">
    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
    <h4 className="text-lg font-semibold text-gray-900 mb-2">
      {exportFormat === "folder" ? "Creating Audit Package..." : "Exporting..."}
    </h4>
    <p className="text-sm text-gray-600">
      {exportProgress
        ? exportProgress.message
        : "Creating your compliance audit export. This may take a moment."}
    </p>
    {exportProgress && exportFormat === "folder" && (
      <div className="mt-4 max-w-xs mx-auto">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{
              width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {exportProgress.current} / {exportProgress.total}
        </p>
      </div>
    )}
  </div>
)}
```

### Target Implementation
Remove the conditional block that shows progress bar when `exportFormat === "folder"`:
```tsx
{/* Step 3: Exporting */}
{step === 3 && (
  <div className="py-8 text-center">
    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
    <h4 className="text-lg font-semibold text-gray-900 mb-2">
      {exportFormat === "folder" ? "Creating Audit Package..." : "Exporting..."}
    </h4>
    <p className="text-sm text-gray-600">
      {exportProgress
        ? exportProgress.message
        : "Creating your compliance audit export. This may take a moment."}
    </p>
    {/* Progress bar removed for folder export - only spinner and message */}
  </div>
)}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI-only change)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Start Audit Package export
- [ ] Verify only spinner and text shown (no progress bar)
- [ ] Verify stage messages still update
- [ ] Complete export and verify success flow works

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(export): remove progress bar from audit package export`
- **Branch:** `feature/task-1154-remove-progress-bar`
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

- **Before**: Progress bar with X/X count during Audit Package export
- **After**: Only spinner and status text
- **Actual Turns**: X (Est: 2-4)
- **Actual Tokens**: ~XK (Est: 4-8K)
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
- Previous Track A tasks (1150, 1151, 1153) are not merged yet
- You need to modify the progress event emission logic
- You encounter blockers not covered in the task file
