# TASK-921: Fix Duplicate Navigation Buttons on SecureStorageStep

**Sprint:** SPRINT-017 (Metrics Workflow Test)
**Category:** fix/ui
**Priority:** Medium

---

## PM Estimate

| Metric | Value |
|--------|-------|
| **Est. Tokens** | ~15K |
| **Token Cap** | 60K |
| **Category Multiplier** | 1.0x (ui) |

---

## Goal

Remove duplicate Back/Continue buttons from the Secure Storage onboarding step. Currently, buttons render twice - once from the step content and once from the OnboardingShell.

## Non-Goals

- Do NOT modify OnboardingFlow.tsx or NavigationButtons
- Do NOT change the navigation behavior
- Do NOT modify other onboarding steps
- Do NOT refactor the step architecture

## Deliverables

| File | Action |
|------|--------|
| `src/components/onboarding/steps/SecureStorageStep.tsx` | Remove duplicate navigation buttons |

## Root Cause

```
OnboardingFlow.tsx (line 204-215):
  └─ NavigationButtons component ← renders Back/Continue based on step.meta.navigation

SecureStorageStep.tsx (line 209-222):
  └─ Also renders Back/Continue buttons inside Content ← DUPLICATE
```

The step's metadata already configures navigation:
```typescript
navigation: {
  showBack: true,
  continueLabel: "Continue",
}
```

The shell reads this and renders appropriate buttons. The step content should NOT also render buttons.

## Implementation Notes

### Code to Remove

In `SecureStorageStep.tsx`, remove lines 209-222 (the navigation buttons div):

```tsx
{/* Navigation buttons - REMOVE THIS BLOCK */}
<div className="flex gap-3">
  <button
    onClick={handleBack}
    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
  >
    Back
  </button>
  <button
    onClick={handleContinue}
    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-colors"
  >
    Continue
  </button>
</div>
```

### Keep These

- `handleContinue` function - still needed, called by shell's NavigationButtons via `onAction`
- `handleBack` function - still needed
- The checkbox and info box - these are step-specific content

### Navigation Flow After Fix

1. User clicks Continue in shell's NavigationButtons
2. Shell calls `goToNext()` which triggers `onAction({ type: 'NAVIGATE_NEXT' })`
3. Hook's `handleAction` calls the step's `onAction` prop
4. For SecureStorage, we need to ensure `SECURE_STORAGE_SETUP` fires with `dontShowAgain`

**WAIT** - There's a problem. The shell's NavigationButtons doesn't know about `dontShowAgain`. Let me check...

Actually, looking at the flow more carefully:
- Shell's `goToNext` → triggers navigation
- But `SecureStorageStep` needs to call `onAction({ type: 'SECURE_STORAGE_SETUP', dontShowAgain })`

**Revised approach:** The step needs to handle Continue differently. Check if other steps use `meta.navigation.onContinue` or if there's a pattern for custom continue behavior.

### Alternative Fix

Keep the Continue button in the step content (to handle custom `dontShowAgain` logic), but tell the shell to hide its Continue button:

```typescript
// In SecureStorageStep meta
navigation: {
  showBack: true,
  hideContinue: true, // Shell won't render Continue
  continueLabel: "Continue",
}
```

Then the step renders its own Continue with the checkbox value. **Only remove the Back button** from step content since shell handles that.

## Acceptance Criteria

- [ ] Exactly one Back button visible
- [ ] Exactly one Continue button visible
- [ ] "Don't show this explanation again" checkbox still works
- [ ] Clicking Continue passes correct `dontShowAgain` value
- [ ] Navigation to next/previous steps works correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (if onboarding tests exist)

## Testing

```bash
# Start dev server
npm run dev

# Navigate to onboarding
# Select iPhone → reach Secure Storage step
# Verify: exactly 2 buttons (Back + Continue)
# Test checkbox toggle
# Test Back navigation
# Test Continue navigation
```

## Stop-and-Ask Triggers

- If removing buttons breaks the `dontShowAgain` functionality
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
- [ ] Tested manually
- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass
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
