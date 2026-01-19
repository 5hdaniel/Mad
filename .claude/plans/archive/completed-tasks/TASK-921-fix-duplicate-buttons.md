# TASK-921: Fix Duplicate Navigation Buttons on SecureStorageStep

**Sprint:** SPRINT-017 (Metrics Workflow Test)
**Category:** fix/ui
**Priority:** Medium
**SR Review:** Approved 2026-01-03

---

## PM Estimate

| Metric | Value |
|--------|-------|
| **Est. Tokens** | ~15K |
| **Token Cap** | 60K |
| **Category Multiplier** | 1.0x (ui) |

---

## Goal

Fix duplicate Back/Continue buttons on the Secure Storage onboarding step. Currently, buttons render twice - once from the shell and once from the step content.

## Non-Goals

- Do NOT modify OnboardingFlow.tsx or NavigationButtons
- Do NOT change the navigation behavior
- Do NOT modify other onboarding steps
- Do NOT refactor the step architecture

## Deliverables

| File | Action |
|------|--------|
| `src/components/onboarding/steps/SecureStorageStep.tsx` | Add `hideContinue: true` to meta, remove Back button div only |

## Root Cause

```
OnboardingFlow.tsx (line 204-215):
  └─ NavigationButtons ← renders Back/Continue based on step.meta.navigation

SecureStorageStep.tsx (line 209-222):
  └─ Also renders Back/Continue buttons inside Content ← DUPLICATE
```

**Critical Detail:** The step's Continue button passes `dontShowAgain` checkbox value via the `SECURE_STORAGE_SETUP` action. The shell's Continue button does NOT have access to this value - it just calls `goToNext()`.

## Implementation (SR Engineer Approved)

### Step 1: Update Step Metadata

Add `hideContinue: true` to prevent shell from rendering its Continue button:

```typescript
// In SecureStorageStep.tsx, update meta.navigation
export const meta: OnboardingStepMeta = {
  id: "secure-storage",
  progressLabel: "Secure Storage",
  platforms: ["macos"],
  navigation: {
    showBack: true,
    hideContinue: true,  // ADD THIS - shell won't render Continue
    continueLabel: "Continue",
  },
  skip: undefined,
  shouldShow: (context) => !context.isDatabaseInitialized,
};
```

### Step 2: Remove ONLY the Back Button

Remove the Back button from step content (lines 210-215), but **KEEP the Continue button**:

```tsx
{/* REMOVE THIS - Back button (shell handles this) */}
<button
  onClick={handleBack}
  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
>
  Back
</button>
```

### Step 3: Adjust Layout

The remaining Continue button needs full width since Back is removed. Update the container:

```tsx
{/* Change from flex gap-3 to just the Continue button */}
<button
  onClick={handleContinue}
  className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
>
  Continue
</button>
```

### What to Keep

- `handleContinue` function - dispatches `SECURE_STORAGE_SETUP` with `dontShowAgain`
- `handleBack` function - may still be called by shell's Back button
- The Continue button in step content - handles checkbox value
- The checkbox and info box - step-specific content

## Acceptance Criteria

- [ ] Exactly one Back button visible (from shell)
- [ ] Exactly one Continue button visible (from step content)
- [ ] Toggle checkbox ON → click Continue → `dontShowAgain: true` passed to handler
- [ ] Toggle checkbox OFF → click Continue → `dontShowAgain: false` passed to handler
- [ ] Back button navigates to Phone Type selection
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Testing

```bash
# Start dev server
npm run dev

# Navigate to onboarding (or reset onboarding state)
# Select iPhone → reach Secure Storage step

# Verify:
# 1. Exactly 2 buttons visible (Back + Continue)
# 2. Toggle "Don't show again" checkbox
# 3. Click Continue - verify preference is saved
# 4. Click Back - verify navigation works
```

## Stop-and-Ask Triggers

- If `hideContinue` option doesn't exist in navigation types
- If other steps have similar duplicate button issues
- If the fix requires changing OnboardingFlow.tsx

---

## Implementation Summary (Engineer-Owned)

*Completed by engineer*

### Agent ID

```
Engineer Agent ID: Opus 4.5 (direct execution - no subagent wrapper)
```

### Checklist

- [x] Read task file
- [x] Created branch from develop
- [x] Implemented fix
- [ ] Tested manually (checkbox + navigation) - requires dev server
- [x] Type check passes
- [x] Lint passes
- [x] PR created with metrics

### Metrics

| Phase | Turns | Est. Tokens | Time |
|-------|-------|-------------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 2 | ~8K | 5 min |
| Debugging (Debug) | 0 | ~0K | 0 min |
| **Total** | **2** | **~8K** | **5 min** |

**Variance:** PM Est ~15K vs Actual ~8K (53% of estimate - under budget)

### Notes

**Approach taken:**
1. Added `hideContinue: true` to step metadata (line 34)
2. Removed Back button from step content (lines 209-215)
3. Updated Continue button to `w-full` styling
4. Kept `handleBack` function (unused but retained per task instructions)

**Issues encountered:**
None - straightforward fix as documented in SR-approved implementation plan.

**PR:** https://github.com/5hdaniel/Mad/pull/283
