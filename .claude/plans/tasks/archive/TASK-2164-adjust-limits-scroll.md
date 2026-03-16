# TASK-2164: Adjust Limits Button Scroll-to-Highlight

**Backlog ID:** BACKLOG-835
**Sprint:** SPRINT-128
**Batch:** 1 (parallel with TASK-2162, TASK-2163)
**Branch:** `feature/BACKLOG-835-adjust-limits-scroll`
**Status:** Completed
**Estimated Tokens:** ~20K
**Token Cap:** 60K
**PR:** #1137 (Merged)

---

## Objective

Make the "Adjust Limits" button in `SyncStatusIndicator` scroll to and highlight the relevant settings card (message/transaction limits) when clicked, instead of just opening the Settings panel at the top. Follow the existing scroll-to-highlight pattern used by `handleContinueSetup` in `AppRouter.tsx`.

---

## Context

The `SyncStatusIndicator` component shows a warning when some messages weren't synced due to limits. It includes an "Adjust Limits" button that calls `onOpenSettings()` (a prop callback). Currently, this just opens the Settings panel at the top. The user then has to manually scroll to find the limits settings.

An identical UX pattern already exists: `handleContinueSetup` in `src/appCore/AppRouter.tsx:136-148` opens Settings AND scrolls to the email connections section with a highlight animation. The implementation uses:
1. `openSettings()` to open the Settings panel
2. `setTimeout()` to wait for the panel to render
3. `document.getElementById("settings-email")` to find the target element
4. `scrollIntoView({ behavior: "smooth", block: "start" })` to scroll
5. CSS class manipulation (`ring-2`, `ring-amber-400`, `ring-offset-2`, `rounded-lg`) for the highlight
6. Another `setTimeout(3000)` to remove the highlight

This task replicates that exact pattern for a different scroll target (the limits/cap settings card in the Settings panel).

---

## Requirements

### Must Do:
1. Use the element ID `settings-messages` for the messages/limits settings card in the Settings panel. If no `id="settings-messages"` exists on the target card, add it. (Note: there is no `settings-limits` ID in the codebase -- use `settings-messages`.)
2. Update the `onOpenSettings` callback in `AppRouter.tsx` to accept an optional scroll target parameter (e.g., `onOpenSettings(scrollTarget?: string)`)
3. When `SyncStatusIndicator` calls `onOpenSettings`, pass the scroll target identifier
4. In `AppRouter.tsx`, implement the scroll-to-highlight logic (following `handleContinueSetup` pattern) when a scroll target is provided
5. Apply the same highlight animation CSS classes used in `handleContinueSetup`
6. Remove the highlight after 3 seconds (same as existing pattern)

### Must NOT Do:
- Do not modify the `handleContinueSetup` function itself (it works fine as-is)
- Do not change the Settings panel layout or content
- Do not add new dependencies for scroll/animation behavior
- Do not break the existing `onOpenSettings()` call without a scroll target (it should still open Settings at the top)

---

## Acceptance Criteria

- [ ] Clicking "Adjust Limits" in the sync warning opens Settings AND scrolls to the limits card
- [ ] The limits card gets a visible highlight animation (ring effect) that auto-removes after ~3 seconds
- [ ] Calling `onOpenSettings()` without a scroll target still opens Settings at the top (backward compatible)
- [ ] The existing `handleContinueSetup` email scroll behavior is unaffected
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/appCore/AppRouter.tsx` - Update `onOpenSettings` to accept optional scroll target; add scroll-to-highlight logic
- `src/components/dashboard/SyncStatusIndicator.tsx` - Pass scroll target when calling `onOpenSettings`
- Settings panel component (likely in `src/components/settings/`) - Add `id="settings-messages"` attribute to the messages/limits settings card if not present

### Full `onOpenSettings` Prop Chain (SR Engineer Review)

The `onOpenSettings` callback is threaded through multiple layers. All of these must be updated to accept the optional scroll target parameter:

1. `src/appCore/state/types.ts:179` - Type definition for `onOpenSettings`
2. `src/appCore/state/returnHelpers.ts:109` - Return helper that constructs the callback
3. `src/appCore/state/flows/useModalFlow.ts:74` - Flow hook that exposes the callback
4. `src/components/Dashboard.tsx:35` - Passes prop to child components
5. `src/components/Profile.tsx:40` - Passes prop to child components
6. `src/components/SystemHealthMonitor.tsx:11` - Receives/uses the prop
7. `src/appCore/AppShell.tsx:125` - Wires the prop through the shell
8. `src/appCore/AppModals.tsx:81` - May reference the callback
9. `src/components/LLMErrorDisplay.tsx:18` - Uses the prop

## Files to Read (for context)

- `src/appCore/AppRouter.tsx:136-148` - Existing `handleContinueSetup` scroll pattern (the model to follow)
- `src/components/dashboard/SyncStatusIndicator.tsx:314-329` - Current "Adjust Limits" button implementation
- Settings panel component(s) - Identify the limits settings card element

---

## Implementation Notes

### Pattern to Follow (from AppRouter.tsx:136-148)

```typescript
const handleContinueSetup = () => {
  openSettings();
  setTimeout(() => {
    emailSectionRef.current = document.getElementById("settings-email");
    if (emailSectionRef.current) {
      emailSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      emailSectionRef.current.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "rounded-lg");
      setTimeout(() => {
        emailSectionRef.current?.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-lg");
      }, 3000);
    }
  }, 150); // Wait for settings panel to render (NOTE: actual code uses 150ms, not 300ms)
};
```

### Recommended Approach

1. Add a utility function or generalize the scroll-highlight pattern to accept a target element ID
2. Update `onOpenSettings` prop type: `onOpenSettings?: (scrollTarget?: string) => void`
3. In `SyncStatusIndicator`, change `onClick={onOpenSettings}` to `onClick={() => onOpenSettings?.('settings-messages')}`
4. In `AppRouter.tsx`, when `onOpenSettings` is called with a scroll target, use the same `setTimeout` + `scrollIntoView` + highlight pattern

---

## Testing Expectations

### Unit Tests
- **Required:** No -- this is a UI scroll behavior that is best verified manually
- **Existing tests to update:** If any tests mock `onOpenSettings`, they may need updating for the new optional parameter

### Manual Verification
- Trigger sync warning (have messages hit the cap limit)
- Click "Adjust Limits" button
- Verify: Settings opens, scrolls to limits card, highlight animation appears, highlight fades after 3 seconds
- Verify: Clicking "Continue Setup" (email warning) still scrolls to email section correctly

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feature(ui): scroll to and highlight limits card when clicking Adjust Limits`
- **Branch:** `feature/BACKLOG-835-adjust-limits-scroll`
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
- **Actual Tokens**: ~XK (Est: ~20K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The Settings panel does not have identifiable sections (no good place to add an `id` attribute)
- The `onOpenSettings` prop chain differs from what the SR Engineer documented above (additional files found that aren't listed)
- The Settings panel renders lazily and the 300ms timeout is not sufficient
- You encounter blockers not covered in the task file
