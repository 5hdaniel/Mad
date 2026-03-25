# TASK-2318: SSO Post-Login Card Padding on Small Screens

**Backlog ID:** BACKLOG-1349
**Sprint:** SPRINT-P
**Branch:** `fix/task-2318-sso-card-padding`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~10K (ui x1.0)
**Status:** Pending

---

## Objective

Fix the onboarding card (white card shown after OAuth redirect / SSO login) so it has proper padding and margins on small screens instead of stretching edge-to-edge.

---

## Context

- The onboarding flow uses `OnboardingShell` (at `src/components/onboarding/shell/OnboardingShell.tsx`) as its layout wrapper
- The shell already has `px-4` on the content wrapper and `max-w-xl` as default max-width
- The card itself has `rounded-2xl shadow-xl p-6`
- On very small screens (e.g., Electron window resized small, or small laptop), the card may appear to stretch to screen corners because:
  1. `max-w-xl` (36rem = 576px) can still be wider than a very small window
  2. The `px-4` (16px each side) may not be enough visual breathing room
  3. There may be SSO-specific screens that bypass OnboardingShell

The bug report says: "The onboarding card after OAuth redirect needs padding/margin so it doesn't stretch edge-to-edge on small screens."

---

## Requirements

### Must Do:

1. **Investigate first:** Check if the SSO post-login screen (AccountVerificationStep) renders inside `OnboardingShell` or has its own layout. If it bypasses the shell, that's the root cause.

2. **If inside OnboardingShell:** Increase the responsive padding:
   - Change `px-4` to `px-4 sm:px-6` or `px-6` on the content wrapper
   - Add a minimum margin around the card on very small screens
   - Consider adding `max-w-lg` (32rem) for the AccountVerificationStep specifically, since its content is simpler

3. **If bypassing OnboardingShell:** Move the AccountVerificationStep rendering to use OnboardingShell, which already handles the card layout correctly.

4. Ensure the card never touches screen edges on any screen size (min padding of 16px on all sides)

### Must NOT Do:
- Do NOT change the card's internal padding (`p-6`) or appearance
- Do NOT change the progress bar or navigation buttons layout
- Do NOT modify any other onboarding steps
- Do NOT exceed the OnboardingShell line budget

---

## Acceptance Criteria

- [ ] Card has visible padding/margin from screen edges on window width 400px
- [ ] Card has visible padding/margin from screen edges on window width 500px
- [ ] Card looks correct on normal desktop window (1200px+)
- [ ] Card does not stretch edge-to-edge at any window size
- [ ] No visual regression on other onboarding steps
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `src/components/onboarding/shell/OnboardingShell.tsx` -- Adjust responsive padding
- Possibly `src/components/onboarding/steps/AccountVerificationStep.tsx` -- If it has its own layout wrapper

## Files to Read (for context)

- `src/components/onboarding/OnboardingFlow.tsx` -- How steps are rendered
- `src/components/onboarding/shell/OnboardingShell.tsx` -- Current layout structure
- `src/components/onboarding/steps/AccountVerificationStep.tsx` -- The specific step with the issue

---

## Implementation Notes

Current OnboardingShell layout:
```tsx
<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
  {progressSlot}
  <div className={`${maxWidth} w-full mx-auto px-4`}>
    <div className="mt-4 sm:mt-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        {children}
      </div>
      {navigationSlot}
    </div>
  </div>
</div>
```

Suggested fix -- increase horizontal padding and add a small-screen safeguard:
```tsx
<div className={`${maxWidth} w-full mx-auto px-4 sm:px-6 lg:px-8`}>
```

This ensures at least 16px padding on mobile, 24px on small screens, 32px on larger screens.

---

## Testing Expectations

### Unit Tests
- **Required:** No (CSS-only change, no logic changes)

### Manual Testing
1. Open the desktop app in dev mode
2. Resize the window to various small sizes (400px, 500px, 600px width)
3. Navigate to the onboarding flow (may need to reset onboarding state)
4. Verify the white card always has visible breathing room from screen edges
5. Verify normal-sized windows still look correct

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix: add responsive padding to onboarding card on small screens (BACKLOG-1349)`
- **Branch:** `fix/task-2318-sso-card-padding`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Implementation:
- [ ] Investigated OnboardingShell layout
- [ ] Applied responsive padding fix
- [ ] Tested at multiple window sizes
- [ ] Type check passes
- [ ] Lint passes

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested
```

### Results

- **Before**: Card stretches to screen corners on small windows
- **After**: Card always has padding from screen edges
- **Actual Tokens**: ~XK (Est: 10K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- AccountVerificationStep does NOT render inside OnboardingShell (indicates a larger architectural issue)
- The fix would require modifying more than 2 files
- Other onboarding steps are visually affected by the change
