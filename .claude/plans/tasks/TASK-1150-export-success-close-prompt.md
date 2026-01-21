# TASK-1150: Export Success Message with Finder Link + Close Transaction Prompt

**Backlog ID:** BACKLOG-352
**Sprint:** SPRINT-048
**Phase:** 1 (Track A - Export Modal)
**Branch:** `feature/task-1150-export-success-flow`
**Estimated Turns:** 8-12
**Estimated Tokens:** 20K-30K

---

## Objective

Enhance the export success flow to include a hyperlink to open Finder at the exported file location, and prompt the user to optionally mark the transaction as closed. The close prompt MUST appear BEFORE the success message to ensure users don't miss the Finder link.

---

## Context

When exporting from the transaction details window, the current success message is minimal and auto-dismisses quickly. Users have requested:
1. A clickable link to open Finder and navigate to the exported file
2. An option to mark the transaction as closed after exporting (common workflow)

**Important UX Flow:**
1. Export completes
2. Prompt: "Would you like to mark this transaction as closed?" [Yes] [No]
3. User responds
4. Success message with Finder link appears (persists until dismissed)

This order ensures the success message with Finder link is visible for as long as the user needs.

---

## Requirements

### Must Do:
1. Add "Close Transaction" prompt after export completes, before success message
2. Add "Open in Finder" hyperlink to success message
3. Use Electron shell.showItemInFolder() to open Finder at the exported path
4. Handle both PDF and Audit Package exports
5. Persist success message until user dismisses (coordinate with TASK-1153)

### Must NOT Do:
- Change the export logic itself (only UI/UX flow)
- Force transaction closure (always ask)
- Block UI during Finder open operation

---

## Acceptance Criteria

- [ ] Success message includes clickable "Open in Finder" link
- [ ] Close transaction prompt appears BEFORE success message
- [ ] Success message only appears after user responds to close prompt
- [ ] Behavior is consistent for both PDF and Audit Package exports
- [ ] Clicking Finder link opens the correct folder/file
- [ ] Transaction is marked closed if user selects "Yes"

---

## Files to Modify

- `src/components/ExportModal.tsx` - Add close prompt step, success message with link
- `electron/preload.ts` - Expose shell.showItemInFolder if not already available
- `electron/types/window.d.ts` - Add type for shell API if needed

## Files to Read (for context)

- `src/components/ExportModal.tsx` - Current implementation (lines 1-559)
- `electron/services/folderExportService.ts` - Returns export path
- `electron/services/transactionService.ts` - Transaction update API

---

## Technical Notes

### Opening Finder
Use Electron's shell API:
```typescript
// In preload.ts
shell: {
  showItemInFolder: (path: string) => shell.showItemInFolder(path)
}

// In ExportModal.tsx
const handleOpenInFinder = () => {
  window.api.shell.showItemInFolder(exportedPath);
};
```

### State Flow
Current: `exporting (step 3) -> onExportComplete -> close modal`
New: `exporting (step 3) -> success (step 4) with prompt -> onExportComplete`

Add step 4 that shows:
1. Close transaction prompt (if transaction not already closed)
2. After prompt response: success message with Finder link

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI interaction flow, test manually)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Export Audit Package, verify Finder link works
- [ ] Export PDF, verify Finder link works
- [ ] Click "Yes" on close prompt, verify transaction marked closed
- [ ] Click "No" on close prompt, verify transaction unchanged
- [ ] Verify message persists until dismissed

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(export): add close transaction prompt and finder link to success`
- **Branch:** `feature/task-1150-export-success-flow`
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

- **Before**: Export completes and modal closes immediately
- **After**: Export shows close prompt, then success with Finder link
- **Actual Turns**: X (Est: 8-12)
- **Actual Tokens**: ~XK (Est: 20-30K)
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
- The shell API is not accessible from renderer
- You need to modify transaction status logic
- The export path is not available in the success callback
- You encounter blockers not covered in the task file
