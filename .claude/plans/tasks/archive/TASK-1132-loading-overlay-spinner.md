# TASK-1132: Add Loading Overlay with Spinner to EditContactsModal

**Backlog ID:** BACKLOG-318
**Sprint:** SPRINT-045
**Phase:** N/A (standalone polish task)
**Branch:** `fix/task-1132-loading-overlay-spinner`
**Estimated Tokens:** ~5K

---

## Objective

Eliminate layout shift when opening EditContactsModal by replacing the current "Loading contacts..." text with a semi-transparent overlay and centered spinner that covers the modal content area without affecting layout.

---

## Context

When clicking "Edit Contacts", the modal currently shows "Loading contacts..." text that pushes content down. When loading completes, this text disappears causing content to shift up - a jarring user experience.

The selected solution (Option 1 from BACKLOG-318) uses a loading overlay approach:
- Semi-transparent overlay covering the modal content area
- Centered spinner on the overlay
- Content stays in place behind overlay (no layout shift)

---

## Requirements

### Must Do:
1. Add a semi-transparent overlay that covers the modal content area during loading
2. Center a spinner on the overlay
3. Keep existing content layout in place behind the overlay (no shift)
4. Ensure smooth visual transition when loading completes (overlay fades out)
5. Maintain the loading indicator so users know data is loading

### Must NOT Do:
- Modify the `useContactsLoader` hook loading logic
- Change the existing modal structure/layout beyond adding the overlay
- Remove or hide the content during loading (it should remain visible but dimmed)

---

## Acceptance Criteria

- [ ] No visible layout shift when opening EditContactsModal
- [ ] Loading spinner is visible and centered while contacts load
- [ ] Semi-transparent overlay dims the content area during loading
- [ ] Smooth transition from loading to loaded state
- [ ] Works consistently regardless of load time (fast or slow)
- [ ] Existing functionality unchanged (contact editing still works)

---

## Files to Modify

- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Add overlay component with spinner during loading state

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Understand current loading state rendering (around lines 420-428 in useContactsLoader hook area)

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI polish, visual change only)
- **New tests to write:** None required
- **Existing tests to update:** None expected (loading state behavior unchanged)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(contacts): add loading overlay to EditContactsModal`
- **Branch:** `fix/task-1132-loading-overlay-spinner`
- **Target:** `claude/real-estate-archive-app-011CUStmvmVNXPNe4oF321jJ`

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
- **Actual Tokens**: ~XK (Est: ~5K)
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
- The loading state is managed differently than expected (not via useContactsLoader)
- There are accessibility concerns with the overlay approach
- The overlay affects modal scroll behavior unexpectedly
- You encounter blockers not covered in the task file

---

## Implementation Hints

Example overlay pattern:
```tsx
{isLoading && (
  <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
    <Spinner />
  </div>
)}
```

The parent container may need `position: relative` to properly contain the absolute-positioned overlay.
