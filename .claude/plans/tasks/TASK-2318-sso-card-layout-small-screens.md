# TASK-2318: Fix SSO Post-Login Card Layout on Small Screens

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Fix the onboarding card that appears after SSO/OAuth redirect so it does not stretch edge-to-edge on small screens. The white card should have proper padding/margin from the viewport edges.

## Non-Goals

- Do NOT redesign the onboarding flow or step content
- Do NOT change the progress indicator or navigation buttons
- Do NOT modify any step logic or state management
- Do NOT change anything for larger screens where it already looks fine

## Deliverables

1. Update: `src/components/onboarding/shell/OnboardingShell.tsx` -- Ensure card has minimum edge margin on small screens

## File Boundaries

### Files to modify (owned by this task):
- `src/components/onboarding/shell/OnboardingShell.tsx`

### Files this task must NOT modify:
- `src/components/onboarding/steps/AccountVerificationStep.tsx` -- Owned by TASK-2323 (conditional)
- `src/appCore/AppShell.tsx` -- Owned by TASK-2312

## Context

The `OnboardingShell` component currently uses:
```tsx
<div className={`${maxWidth} w-full mx-auto px-4`}>
  <div className="mt-4 sm:mt-6">
    <div className="bg-white rounded-2xl shadow-xl p-6">
```

The `px-4` (16px) padding may not be enough on very small screens (320px width), and the card could appear to stretch nearly edge-to-edge. The fix should ensure comfortable breathing room.

## Acceptance Criteria

- [ ] White card has at least 16px margin from viewport edges on screens as small as 320px wide
- [ ] Card looks identical to current design on screens 640px and wider
- [ ] No layout shift or visual regression on standard screen sizes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

Possible approaches (choose the simplest):

1. **Increase minimum padding:** Change `px-4` to `px-5` or `px-6` on the container
2. **Add max-width constraint:** Add `max-w-[calc(100%-2rem)]` to the card
3. **Add responsive padding:** `px-5 sm:px-4` (more on mobile, normal on desktop)

The simplest approach that works is preferred. Test by temporarily resizing the Electron window to a very narrow width.

## Do / Don't

### Do:
- Keep the fix minimal -- CSS/className changes only
- Test at 320px, 375px, and 640px+ widths
- Preserve the existing `maxWidth` prop behavior

### Don't:
- Add JavaScript or state changes
- Restructure the shell component layout
- Change padding/margin on other components

## When to Stop and Ask

- If the card stretching is actually caused by a child component overflowing (not the shell)
- If you discover the `maxWidth` prop is being overridden somewhere

## Testing Expectations

### Unit Tests
- Required: No (CSS-only change)

### Manual Testing
- Resize Electron window to ~320px width and verify card has margin from edges
- Resize to normal width and verify no visual regression

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `fix: add proper edge margins to onboarding card on small screens (BACKLOG-1349)`
- **Branch:** `fix/task-2318-sso-card-layout`
- **Target:** `int/identity-provisioning`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file (OnboardingShell.tsx) | +3K |
| Code volume | ~5 lines CSS change | +2K |
| Test complexity | None | +0K |
| Exploration | Read shell + verify | +3K |

**Confidence:** High

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
- [ ] src/components/onboarding/shell/OnboardingShell.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Visually verified at 320px width
- [ ] Visually verified at normal width (no regression)
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
**Test Coverage:** N/A (CSS-only)

### Merge Information

**PR Number:** #XXX
**Merged To:** int/identity-provisioning
