# TASK-1153: Increase Export Success Popup Visibility Duration

**Backlog ID:** BACKLOG-362
**Sprint:** SPRINT-048
**Phase:** 1 (Track A - Export Modal, After TASK-1150)
**Branch:** `feature/task-1153-popup-duration`
**Estimated Turns:** 3-5
**Estimated Tokens:** 5K-10K

---

## Objective

Increase the display duration of the export success popup to ensure users have ample time to see and click the "Open in Finder" link. Ideally, the popup should persist until manually dismissed.

---

## Context

The export success popup with the Finder link (added in TASK-1150) auto-dismisses too quickly. Users may miss the Finder link before they can click it. This task ensures the popup stays visible long enough.

**Options considered:**
1. Manual dismiss only: Popup stays until user clicks X or "Got it" (PREFERRED)
2. Extended timer: 30 second auto-dismiss
3. Hybrid: 30 seconds with manual dismiss option

**Recommendation:** Manual dismiss only since this is an important action point.

---

## Requirements

### Must Do:
1. Remove auto-dismiss timer from success popup
2. Add clear dismiss button ("Got it" or X button)
3. Success popup persists until user explicitly dismisses
4. Works for both PDF and Audit Package exports

### Must NOT Do:
- Make dismissal difficult (always have clear X button)
- Block other UI elements unnecessarily
- Change the content of the success message (done in TASK-1150)

---

## Acceptance Criteria

- [ ] Success popup with Finder link stays visible until dismissed
- [ ] Clear "Got it" or X button to dismiss
- [ ] No auto-dismiss timer
- [ ] Works for both PDF and Audit Package exports
- [ ] Modal can be closed after dismissing success message

---

## Files to Modify

- `src/components/ExportModal.tsx` - Modify success state handling, remove auto-dismiss

## Files to Read (for context)

- `src/components/ExportModal.tsx` - Current success handling (after TASK-1150 changes)

---

## Technical Notes

### Current Behavior (Estimated)
The success message likely uses a setTimeout to auto-dismiss or the modal closes automatically after export complete callback.

### Target Behavior
```tsx
// Step 4: Success state
{step === 4 && (
  <div className="py-8 text-center">
    <div className="text-green-600 mb-4">
      {/* Success icon */}
    </div>
    <h4 className="text-lg font-semibold text-gray-900 mb-2">
      Export Complete!
    </h4>
    <button
      onClick={() => handleOpenInFinder(exportPath)}
      className="text-purple-600 hover:underline mb-6"
    >
      Open in Finder
    </button>
    <button
      onClick={handleDismissSuccess}
      className="px-6 py-2 bg-purple-500 text-white rounded-lg"
    >
      Got it
    </button>
  </div>
)}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI timing behavior)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Export completes - success popup appears
- [ ] Wait 30+ seconds - popup should NOT auto-dismiss
- [ ] Click "Got it" - popup dismisses
- [ ] Click X button (if present) - popup dismisses
- [ ] Test with both PDF and Audit Package exports

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(export): persist success popup until user dismisses`
- **Branch:** `feature/task-1153-popup-duration`
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

- **Before**: Success popup auto-dismisses after few seconds
- **After**: Success popup persists until user clicks dismiss
- **Actual Turns**: X (Est: 3-5)
- **Actual Tokens**: ~XK (Est: 5-10K)
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
- TASK-1150 is not yet merged (this task depends on it)
- The success state design from TASK-1150 differs significantly
- You encounter blockers not covered in the task file
