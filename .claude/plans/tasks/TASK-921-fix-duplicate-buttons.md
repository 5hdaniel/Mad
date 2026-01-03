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

*To be completed by engineer after implementation*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

- [ ] Read task file
- [ ] Created branch from develop
- [ ] Implemented fix
- [ ] Tested manually (checkbox + navigation)
- [ ] Type check passes
- [ ] Lint passes
- [ ] PR created with metrics

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | |
| Duration | |
| API Calls | |

**Variance:** PM Est ~15K vs Actual (calculate after)

### Notes

**Approach taken:**
**Issues encountered:**
