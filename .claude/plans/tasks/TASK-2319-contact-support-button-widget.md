# TASK-2319: Wire "Contact Support" Button to Support Widget

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Make the "Contact Support" button on error screens (ErrorScreen.tsx and AccountVerificationStep.tsx) open the SupportWidget ticket dialog instead of opening a mailto: link. The button should trigger the same support interface that the (?) floating button opens.

## Non-Goals

- Do NOT change the SupportWidget component itself
- Do NOT add SupportWidget to error screens (TASK-2312 handles global placement)
- Do NOT change the error screen layout or styling beyond the button behavior
- Do NOT modify the broker-portal SupportWidget

## Deliverables

1. Update: `src/appCore/state/machine/components/ErrorScreen.tsx` -- Add "Contact Support" button that opens support widget
2. Update: `src/components/onboarding/steps/AccountVerificationStep.tsx` -- Change `handleContactSupport` to open widget instead of mailto:

## File Boundaries

### Files to modify (owned by this task):
- `src/appCore/state/machine/components/ErrorScreen.tsx`
- `src/components/onboarding/steps/AccountVerificationStep.tsx`

### Files this task must NOT modify:
- `src/components/support/SupportWidget.tsx` -- Owned by TASK-2312
- `src/appCore/AppShell.tsx` -- Owned by TASK-2312

## Context

### Current Behavior

**ErrorScreen.tsx:** Does NOT have a "Contact Support" button at all. It has:
- "Submit Error Report" (sends to Supabase error logging)
- "Try Again" (retry button)
- "Reset App Data" (nuclear option)

**AccountVerificationStep.tsx (line 275-279):** Has a "Contact Support" button that opens:
```typescript
window.api?.shell?.openExternal?.(
  'mailto:support@keeprcompliance.com?subject=Account%20Setup%20Issue'
);
```

### Desired Behavior

Both screens should have a "Contact Support" button that opens the SupportWidget's ticket creation dialog. The SupportWidget is at `src/components/support/SupportWidget.tsx`.

### How to Trigger the Support Widget

Investigate `src/components/support/SupportWidget.tsx` to determine the best approach:
1. **Global event/callback:** If the widget listens for a custom event, dispatch it
2. **Context/state:** If there is a SupportContext or similar, use it to toggle open
3. **Ref-based:** If the widget exposes an imperative handle
4. **Custom event:** Dispatch a `CustomEvent` on `window` that the widget listens for (may need to add listener to widget -- but check with TASK-2312 owner first)

The preferred approach is to use whatever mechanism the widget already supports. If no mechanism exists, the simplest approach is a `window.dispatchEvent(new CustomEvent('open-support-widget'))` pattern where the widget adds a listener.

**IMPORTANT:** If the widget requires a new event listener, coordinate with TASK-2312 (which places the widget globally). The listener should be added by TASK-2312, and this task just dispatches the event.

## Acceptance Criteria

- [ ] ErrorScreen.tsx has a "Contact Support" button (between "Submit Error Report" and "Try Again")
- [ ] AccountVerificationStep.tsx "Contact Support" button opens widget instead of mailto:
- [ ] Clicking "Contact Support" opens the support ticket creation dialog
- [ ] Fallback to mailto: if widget is not available (e.g., on screens before widget is mounted)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Existing ErrorBoundary tests still pass

## Implementation Notes

### ErrorScreen.tsx -- Add Contact Support Button

Add between the error report section and the action buttons (around line 167):

```tsx
<button
  onClick={handleContactSupport}
  className="w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
  type="button"
>
  Contact Support
</button>
```

### Contact Support Handler (both files)

```typescript
const handleContactSupport = () => {
  // Try to open the support widget first
  const event = new CustomEvent('open-support-widget');
  const handled = window.dispatchEvent(event);

  // Fallback to mailto if widget is not available
  // (CustomEvent always returns true for dispatchEvent, so check another way)
  // Alternative: check if SupportWidget is mounted via a DOM query
  // or just dispatch the event and trust the widget will handle it
};
```

## Do / Don't

### Do:
- Check how SupportWidget currently works before implementing
- Use the simplest integration approach
- Add a mailto: fallback for robustness
- Keep the button styling consistent with existing buttons on each screen

### Don't:
- Import SupportWidget directly into error screens
- Add complex state management for this integration
- Modify the SupportWidget component (coordinate with TASK-2312 if changes needed)

## When to Stop and Ask

- If the SupportWidget has no way to be programmatically opened and adding one requires significant changes
- If TASK-2312 has not yet been implemented and the widget is not globally available
- If the ErrorScreen is rendered outside of the React tree where SupportWidget lives

## Testing Expectations

### Unit Tests
- Required: Update `ErrorBoundary.test.tsx` if it tests ErrorScreen buttons
- Verify existing tests pass

### Manual Testing
1. Trigger an error screen (e.g., corrupt DB or network failure during init)
2. Click "Contact Support" -- verify support dialog opens
3. Test AccountVerificationStep failure -- click "Contact Support"
4. If widget is not mounted (edge case), verify mailto: fallback works

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `fix: wire Contact Support button to support widget on error screens (BACKLOG-1350)`
- **Branch:** `fix/task-2319-contact-support-button`
- **Target:** `int/identity-provisioning`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files | +4K |
| Code volume | ~20 lines per file | +3K |
| Test complexity | Low (update existing test) | +1K |
| Exploration | Read SupportWidget integration | +2K |

**Confidence:** Medium

**Risk factors:**
- SupportWidget may not have a programmatic open mechanism
- ErrorScreen may render outside widget's React tree

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/appCore/state/machine/components/ErrorScreen.tsx
- [ ] src/components/onboarding/steps/AccountVerificationStep.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Notes

**Deviations from plan:** None

**Issues encountered:** [Document any challenges]

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** int/identity-provisioning
