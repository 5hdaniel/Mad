# TASK-2314: Reply Textarea Bigger Default + Resizable

**Backlog ID:** BACKLOG-1166
**Sprint:** SPRINT-O
**Branch:** `fix/task-2314-reply-textarea-resize`
**Branch From:** `int/identity-provisioning`
**Branch Into:** `int/identity-provisioning`
**Estimated Tokens:** ~2K

---

## Objective

Fix the agent reply textarea on the support ticket detail page to have a bigger default height and allow vertical resizing so agents can expand it for longer responses.

---

## Context

- BACKLOG-1166 was previously marked completed but the fix is either not deployed or insufficient
- Current state: the textarea in `ReplyComposer.tsx` has `resize-none` (line ~286) and a small default height
- Agents writing longer responses need more vertical space
- This is a CSS-only fix -- no logic changes needed

---

## Requirements

### Must Do:
1. In `admin-portal/app/dashboard/support/components/ReplyComposer.tsx`:
   - Change `resize-none` to `resize-y` (or use CSS `resize: vertical`)
   - Increase the default height to `min-h-[120px]` (approximately 5-6 lines of text)
2. Ensure the textarea container accommodates the larger default gracefully

### Must NOT Do:
- Do not change the composer's collapse/expand behavior
- Do not change the internal note vs reply toggle logic
- Do not modify any other components
- Do not add auto-resize (just allow manual vertical drag)

---

## Acceptance Criteria

- [ ] Textarea has a visibly larger default height (~120px / 5-6 lines)
- [ ] Textarea is resizable vertically (drag handle visible at bottom-right)
- [ ] Textarea is NOT resizable horizontally (only vertical)
- [ ] Collapsed/expanded composer behavior unchanged
- [ ] Internal note and reply modes both have the larger textarea
- [ ] `npm run type-check` passes
- [ ] Visual appearance is clean (no overflow or layout breakage)

---

## Files to Modify

- `admin-portal/app/dashboard/support/components/ReplyComposer.tsx` -- Change textarea CSS classes (~line 280-290)

## Files to Read (for context)

- `admin-portal/app/dashboard/support/components/ReplyComposer.tsx` -- Current textarea implementation

---

## Implementation Notes

Current code (approximately line 280-286):
```tsx
<textarea
  ...
  className={`w-full border-0 resize-none text-sm text-gray-900 focus:outline-none focus:ring-0 ${
    ...
  }`}
```

Change to:
```tsx
<textarea
  ...
  className={`w-full border-0 resize-y min-h-[120px] text-sm text-gray-900 focus:outline-none focus:ring-0 ${
    ...
  }`}
```

Key changes:
- `resize-none` -> `resize-y` (Tailwind class for `resize: vertical`)
- Add `min-h-[120px]` for bigger default height

---

## Testing Expectations

### Unit Tests
- **Required:** No (CSS-only change)

### Manual Testing
- Open any support ticket detail page
- Verify the reply textarea is taller than before
- Drag the bottom-right corner to resize vertically
- Verify horizontal resize is not possible
- Switch between Reply and Internal Note modes -- both should have the larger textarea
- Collapse and re-expand the composer -- verify it still works

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] Build succeeds

---

## PR Preparation

- **Title:** `fix: make reply textarea bigger and vertically resizable (BACKLOG-1166)`
- **Branch:** `fix/task-2314-reply-textarea-resize`
- **Target:** `int/identity-provisioning`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/identity-provisioning
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Type check passes (npm run type-check)

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

- **Before**: Small textarea with resize disabled
- **After**: Larger textarea with vertical resize enabled
- **Actual Tokens**: ~XK (Est: 2K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- The textarea uses a custom auto-resize hook that conflicts with manual resize
- The collapsed height logic overrides the min-height
- You encounter blockers not covered in the task file
