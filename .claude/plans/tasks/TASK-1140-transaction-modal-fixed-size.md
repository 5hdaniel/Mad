# TASK-1140: Transaction Details Modal Responsive Size

**Backlog ID:** BACKLOG-331
**Sprint:** SPRINT-046
**Phase:** 1 - Solo task
**Branch:** `fix/TASK-1140-transaction-modal-fixed-size`
**Estimated Turns:** 2-3
**Estimated Tokens:** ~5K

---

## Objective

Fix the Transaction Details modal so it maintains a consistent size when switching between tabs (Details, Contacts, Messages, Emails, etc.). Currently, the modal resizes based on tab content, causing jarring layout shifts.

---

## Context

The Transaction Details modal exhibits size jumping when navigating between tabs because there is no fixed height constraint on the modal container. This is the same issue that was fixed in TASK-1130 for the Contact Select modal.

**Reference Implementation:** TASK-1130 fixed the ContactSelectModal by adding `h-[70vh]` to create a fixed height container with scrollable content. This task applies the same pattern to the Transaction Details modal.

---

## Requirements

### Must Do:
1. Set fixed/responsive dimensions on the Transaction Details modal container
2. Ensure content area scrolls within the fixed container
3. Maintain consistent modal size when switching between all tabs

### Must NOT Do:
- Break existing tab functionality
- Cause horizontal layout issues
- Create TypeScript errors
- Change modal width (only height consistency needed)

---

## Acceptance Criteria

- [ ] Modal maintains consistent size when switching tabs
- [ ] Content scrolls within the fixed container
- [ ] No visible layout shift during tab changes
- [ ] Modal remains usable on various screen sizes (responsive)
- [ ] Scrollbars appear only when content exceeds container height
- [ ] All tabs display correctly (Details, Contacts, Messages, Emails, Attachments)
- [ ] Empty states display properly in fixed container
- [ ] No TypeScript errors
- [ ] No lint errors

---

## Files to Modify

- `src/components/transactionDetailsModule/` - Locate the main modal container component
  - Find the container with modal styling (likely has `max-h-[Xvh]` or similar)
  - Add fixed height class similar to ContactSelectModal: `h-[70vh]`

## Files to Read (for context)

- `src/components/ContactSelectModal.tsx` - Reference implementation (line ~202)
  - Pattern: `h-[70vh] max-h-[80vh]` on modal container
- `src/components/transactionDetailsModule/` - Understand current structure

---

## Implementation Plan

### Step 1: Locate Modal Container

Find the Transaction Details modal container component. Look for:
- A file in `src/components/transactionDetailsModule/` with modal container styling
- The outer `<div>` that wraps the entire modal content
- Likely has classes like `bg-white`, `rounded-xl`, `shadow`, `max-h-[Xvh]`

### Step 2: Apply Fixed Height Pattern

**Pattern from ContactSelectModal (line 202):**
```tsx
<div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[70vh] max-h-[80vh] flex flex-col">
```

Apply similar fixed height to Transaction Details modal:
- Add `h-[70vh]` or similar appropriate fixed height
- Keep or add `max-h-[80vh]` as safety cap
- Ensure `flex flex-col` is present for proper content layout

### Step 3: Verify Content Area Scrolling

Ensure the tab content area has proper scroll handling:
```tsx
<div className="flex-1 overflow-y-auto">
  {/* Tab content renders here */}
</div>
```

The `flex-1` expands to fill remaining space, `overflow-y-auto` enables scrolling.

### Step 4: Test All Tabs

Verify each tab displays correctly:
- Details tab
- Contacts tab
- Messages tab
- Emails tab
- Attachments tab (if present)
- Any other tabs

---

## Testing Expectations

### Unit Tests
- **Required:** No (CSS-only change)
- **New tests to write:** None
- **Existing tests to update:** None

### Manual Testing Checklist

- [ ] Open Transaction Details modal
- [ ] Modal appears at consistent fixed size
- [ ] Switch to each tab - no size change
- [ ] Tab with lots of content (e.g., many messages) scrolls properly
- [ ] Tab with little content displays properly (no awkward spacing)
- [ ] Empty tab states centered/displayed properly
- [ ] Test on smaller viewport (resize browser to ~768px width)
- [ ] Test on larger viewport (~1920px width)
- [ ] Modal closes and reopens correctly

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(ui): transaction details modal consistent size`
- **Branch:** `fix/TASK-1140-transaction-modal-fixed-size`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-01-19*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: 2026-01-19
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Modal resized dynamically based on tab content, causing jarring layout shifts when switching tabs
- **After**: Modal maintains consistent height (70vh) with scrollable content area
- **Actual Turns**: 1 (Est: 2-3)
- **Actual Tokens**: ~3K (Est: 5K)
- **Actual Time**: 5 min
- **PR**: [URL after PR created]

### Implementation Details

**File Modified:** `src/components/TransactionDetails.tsx`

**Change:** Added `h-[70vh]` to the modal container on line 272:
```tsx
// Before:
<div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

// After:
<div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] max-h-[90vh] flex flex-col">
```

**Why this works:**
- `h-[70vh]` sets a fixed height (70% of viewport height)
- `max-h-[90vh]` caps maximum height for smaller screens
- `flex flex-col` already in place for proper flex layout
- Content area already has `flex-1 overflow-y-auto` for scrolling

**Pattern Match:** Same pattern used in ContactSelectModal (TASK-1130).

### Notes

**Deviations from plan:**
None - implementation followed the plan exactly.

**Issues encountered:**
None - straightforward CSS change.

---

## Guardrails

**STOP and ask PM if:**
- Cannot locate the Transaction Details modal container
- Multiple nested containers make the fix unclear
- Modal structure differs significantly from ContactSelectModal pattern
- You encounter blockers not covered in the task file
