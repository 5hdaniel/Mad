# Single-Queue Onboarding Architecture Migration

## Context

The onboarding system has **two independent authorities** that disagree on completion:

1. **Reducer** (`src/appCore/state/machine/reducer.ts`): `isOnboardingComplete()` checks only phoneType + emailOnboarding + permissions. When all met, transitions to `ready` → skips newer steps (`contact-source`, `data-sync`, `account-verification`).
2. **Flow engine** (`useOnboardingFlow` + flow files): Knows 7-8 steps but gets overridden by the reducer's premature completion.

This caused TASK-2098's contact source step to be skipped entirely. The progress bar also hides completed steps instead of showing green checkmarks (dual-purpose `shouldShow` problem).

**Goal:** Replace the dual system with a single queue — a straightforward ordered list that pops the next step each time. Adding a step = 2 files. Queue empty = onboarding done.

**References:** BACKLOG-829 (short-circuit bug), BACKLOG-830 (progress bar), architecture proposal at `.claude/docs/proposals/onboarding-single-queue-architecture.md`

**Risk Level:** HIGH — touches reducer, types, selectors, derivation, UI orchestrator, progress bar, and all 8 step files (~20 files total)

---

## Strategy: Clean Swap (No Feature Flags)

Small user base makes phased migration unnecessary. The existing flow engine already works well — we're promoting it to be the sole authority and demoting the reducer to a thin status switch.

**Migration order:**
1. Add queue infrastructure (pure functions, additive, no breakage)
2. Add `isApplicable`/`isComplete` predicates to step meta (alongside existing `shouldShow`)
3. Create `useOnboardingQueue` hook
4. Swap `OnboardingFlow.tsx` to use new hook
5. Simplify reducer: delete `getNextOnboardingStep`, `isOnboardingComplete`, add `ONBOARDING_QUEUE_DONE`
6. Clean up: remove `shouldShow`, delete `useOnboardingFlow`
7. Update tests

---

## Core Design

### Queue Builder (new: `src/components/onboarding/queue/buildQueue.ts`)

Pure function that builds the ordered queue from flow definitions + context:

```typescript
function buildOnboardingQueue(
  platform: Platform,
  context: OnboardingContext
): StepQueueEntry[]
```

- Gets flow steps from `macosFlow.ts` / `windowsFlow.ts` (existing)
- For each step: checks `isApplicable(context)` → if false, marks `skipped`
- For each applicable step: checks `isComplete(context)` → marks `complete` or `pending`
- First `pending` step = `active`
- Queue is rebuilt when context changes (phone type selected, DB initialized, etc.)

### Step Predicates (added to `OnboardingStepMeta`)

Each step declares two predicates on its existing `meta` object:

| Step | `isApplicable(ctx)` | `isComplete(ctx)` |
|------|--------------------|--------------------|
| phone-type | always | `phoneType !== null` |
| secure-storage | always (macOS flow only) | `isDatabaseInitialized` |
| account-verification | `isDatabaseInitialized` | `isUserVerifiedInLocalDb` |
| contact-source | always | `false` (user must interact) |
| email-connect | always | `emailConnected === true` |
| data-sync | `isDatabaseInitialized && userId !== null` | auto-completes on render |
| permissions | always (macOS flow only) | `permissionsGranted === true` |
| apple-driver | `phoneType === 'iphone'` (Windows flow only) | `driverSetupComplete` |

**Key insight:** Platform filtering stays in the flow arrays (macOS vs Windows). `isApplicable` handles runtime conditions (DB not ready yet, phone type not selected yet). `isComplete` handles progress tracking.

### Queue Types (new: `src/components/onboarding/queue/types.ts`)

```typescript
type StepStatus = "pending" | "active" | "complete" | "skipped";

interface StepQueueEntry {
  step: OnboardingStep;       // existing step component + meta
  status: StepStatus;
  applicable: boolean;
}
```

### Queue Hook (new: `src/components/onboarding/queue/useOnboardingQueue.ts`)

Wraps the pure functions in a React hook:
- Builds queue on mount
- Rebuilds when context changes (memoized)
- Exposes: `queue`, `activeStep`, `goToNext()`, `goToPrevious()`, `isComplete`
- When `isQueueComplete(queue)` → dispatches `ONBOARDING_QUEUE_DONE` to reducer

### Reducer Simplification

**Delete:**
- `getNextOnboardingStep()` (lines 68-107) — replaced by queue builder
- `isOnboardingComplete()` (lines 117-143) — replaced by `isQueueComplete()`

**Add:**
- `ONBOARDING_QUEUE_DONE` action handler — transitions `onboarding` → `ready` (5 lines)

**Simplify:**
- `ONBOARDING_STEP_COMPLETE`: Just track `completedSteps`, no more computing nextStep
- `USER_DATA_LOADED`: Keep coarse check for returning users (no regression), remove step computation
- `EMAIL_CONNECTED`: Just set flag, queue detects change automatically
- `AUTH_LOADED` / `LOGIN_SUCCESS`: Remove `getNextOnboardingStep()` call, no `step` field

**`OnboardingState.step`:** Make optional. Queue hook is the authority for current step, not the reducer.

### Progress Bar Fix

`ProgressIndicator` receives `StepQueueEntry[]` instead of `OnboardingStep[]`:
- `complete` → green circle with checkmark (existing style)
- `active` → blue circle with ring (existing style)
- `pending` → gray empty circle (existing style)
- `skipped` / `applicable: false` → not rendered

Completed steps stay visible with green checkmarks instead of disappearing.

---

## Files to Modify

### New Files (4)

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/components/onboarding/queue/types.ts` | `StepQueueEntry`, `StepStatus` | 30 |
| `src/components/onboarding/queue/buildQueue.ts` | `buildOnboardingQueue`, `isQueueComplete`, `getActiveEntry` | 80 |
| `src/components/onboarding/queue/useOnboardingQueue.ts` | React hook wrapping pure functions | 100 |
| `src/components/onboarding/queue/index.ts` | Barrel export | 5 |

### Modified Files (~16)

| File | Change | Size |
|------|--------|------|
| **Reducer layer** | | |
| `src/appCore/state/machine/reducer.ts` | Delete `getNextOnboardingStep`, `isOnboardingComplete`. Add `ONBOARDING_QUEUE_DONE`. Simplify handlers. | Large |
| `src/appCore/state/machine/types.ts` | Add `OnboardingQueueDoneAction`. Expand `OnboardingStep` union to include all step IDs. Make `step` optional. | Medium |
| **Selectors & derivation** | | |
| `src/appCore/state/machine/selectors/userDataSelectors.ts` | Remove `STEP_ORDER`, `getStepIndex`. Update selectors to use `completedSteps`. | Medium |
| `src/appCore/state/machine/derivation/navigationDerivation.ts` | Handle optional `step` field. | Small |
| `src/appCore/state/machine/derivation/stepDerivation.ts` | Deprecate — queue replaces `shouldSkipStep`, `deriveNextStep`, etc. | Medium |
| **Onboarding UI** | | |
| `src/components/onboarding/OnboardingFlow.tsx` | Replace `useOnboardingFlow` → `useOnboardingQueue`. Remove `handleComplete`, `waitingForDbInit`, `steps.length === 0` effect, `initialStepId`. | Large |
| `src/components/onboarding/shell/ProgressIndicator.tsx` | Accept `StepQueueEntry[]`. Remove index-based status. | Medium |
| `src/components/onboarding/types/config.ts` | Add `isApplicable` to `OnboardingStepMeta`. | Small |
| **Step files (8)** | | |
| Each step file (`PhoneTypeStep`, `SecureStorageStep`, `AccountVerificationStep`, `ContactSourceStep`, `EmailConnectStep`, `DataSyncStep`, `PermissionsStep`, `AppleDriverStep`) | Add `isApplicable`/`isComplete` to meta. Remove `shouldShow`. | Small each |

### Deleted Files (1)

| File | Reason |
|------|--------|
| `src/components/onboarding/hooks/useOnboardingFlow.ts` | Replaced by `useOnboardingQueue` |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| `state.step` removal breaks consumers | Make optional first, update all consumers (bounded scope — selectors + derivation files) |
| Mid-onboarding users get stuck | Queue rebuilds from context — pre-marks completed steps. No dependency on `state.step`. |
| DB-not-initialized race | Queue rebuilds when `isDatabaseInitialized` changes. Completed entries preserved. |
| `USER_DATA_LOADED` false positive | Keep current coarse check (no regression). Follow up later if returning users should see new steps. |

---

## Verification

1. `npx tsc --noEmit` — no type errors
2. `npm test` — all existing + new tests pass
3. `npm run lint` — clean
4. **Manual — New user macOS:**
   - All 7 steps appear in progress bar
   - Each step shows green checkmark after completion
   - Contact source step always appears (not skipped)
   - Queue completes → dashboard
5. **Manual — Returning user:**
   - Completed steps show as green in progress bar
   - Resumes at first incomplete step
   - Not sent to dashboard prematurely
6. **Manual — New user Windows:**
   - 6 steps (no secure-storage, no permissions)
   - Apple driver shown only for iPhone selection
