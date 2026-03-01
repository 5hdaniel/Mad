# Onboarding Single-Queue Architecture Proposal

**Author:** SR Engineer / System Architect
**Date:** 2026-02-28
**Status:** DRAFT
**Related Backlog:** BACKLOG-829, BACKLOG-830

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Step Definition Interface](#3-step-definition-interface)
4. [Flow Builder](#4-flow-builder)
5. [Completion Logic](#5-completion-logic)
6. [Progress Bar](#6-progress-bar)
7. [Reducer Changes](#7-reducer-changes)
8. [Migration Plan](#8-migration-plan)
9. [Adding a New Step](#9-adding-a-new-step)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Problem Statement

### The Dual-System Divergence

The current onboarding system has two independent systems that determine flow, completion, and progression, and they disagree:

**System A -- The State Machine Reducer** (`src/appCore/state/machine/reducer.ts`)

- `isOnboardingComplete()` checks 4 conditions: phoneType, hasCompletedEmailOnboarding, hasPermissions (macOS), needsDriverSetup (Windows+iPhone)
- `getNextOnboardingStep()` knows about 5 steps: phone-type, secure-storage, email-connect, permissions, apple-driver
- Determines whether to enter `ready` state or stay in `onboarding` state
- Pure function, runs in the state machine layer

**System B -- The Flow Engine** (`src/components/onboarding/`)

- `macosFlow.ts` defines 7 steps: phone-type, secure-storage, account-verification, contact-source, email-connect, data-sync, permissions
- `windowsFlow.ts` defines 6 steps: phone-type, apple-driver, account-verification, contact-source, email-connect, data-sync
- Each step has a `shouldShow` predicate that hides it from the visible flow when its condition is met
- `useOnboardingFlow` hook manages step navigation, filtering, and action handling

### How They Diverge

The reducer was written first as part of BACKLOG-142 (unified state machine). The flow engine was built later for richer UI navigation. Over time, new steps were added only to the flow engine:

| Step | In Reducer | In Flow Engine | Notes |
|------|-----------|----------------|-------|
| phone-type | Yes | Yes | Consistent |
| secure-storage | Yes | Yes | Consistent |
| email-connect | Yes | Yes | Consistent |
| permissions | Yes | Yes | Consistent |
| apple-driver | Yes | Yes | Consistent |
| **account-verification** | **No** | Yes | Added to flow only |
| **contact-source** | **No** | Yes | Added to flow only |
| **data-sync** | **No** | Yes | Added to flow only |

### Concrete Bugs This Causes

**Bug 1: Premature Completion.** The reducer's `isOnboardingComplete()` checks only its 4 conditions. A returning user who has phoneType set, email connected, and permissions granted will be routed to `ready` state immediately -- skipping account-verification, contact-source, and data-sync. These steps only run if the flow engine renders them, but the flow engine never gets a chance because the reducer already decided "done."

**Bug 2: Completion Patching in OnboardingFlow.** The `OnboardingFlow.tsx` component has a 50-line `handleComplete` function that manually dispatches `ONBOARDING_STEP_COMPLETE` for steps that were hidden (already satisfied) but never formally completed. This patching bridges the two systems but is fragile -- if a new step is added, the patching function must be manually updated.

**Bug 3: All-Steps-Filtered-Out Edge Case.** When a returning user has all conditions met, all steps are filtered out by `shouldShow` predicates, leaving `steps.length === 0`. The component then dispatches email-connect completion as a side-effect in a `useEffect`, creating a race condition with the reducer's own completion check.

**Bug 4: Progress Bar Disappearing Steps.** Steps that are complete disappear from the progress bar (because `shouldShow` returns `false`), rather than showing a green checkmark. A user who selected their phone type and comes back sees a progress bar starting at "Secure Storage" with no indication that phone selection was already done.

### Root Cause

The root cause is architectural: two independent systems share responsibility for "is onboarding done?" and "what step is next?" without a shared data model. The reducer uses its own hardcoded step list and completion function. The flow engine uses its own step list and `shouldShow` predicates. Neither consults the other.

---

## 2. Proposed Architecture

### Design Principle: Single Queue, Single Authority

The flow engine becomes the sole authority for onboarding. The reducer defers to it entirely. There is one ordered queue of steps, built once at startup (or after login), and that queue drives everything: the current step, the progress bar, and the "is complete?" decision.

### Architecture Diagram

```
                        +---------------------+
                        |   Step Registry     |
                        | (all step defs)     |
                        +----------+----------+
                                   |
                                   v
+------------------+    +---------------------+     +------------------+
| Platform Flow    |--->|   Flow Builder      |<----| User Data        |
| (step order)     |    | buildOnboardingQueue|     | (from DB/cloud)  |
+------------------+    +----------+----------+     +------------------+
                                   |
                                   v
                        +---------------------+
                        |  Onboarding Queue   |
                        |  StepQueueEntry[]   |
                        |                     |
                        | Each entry has:     |
                        |  - step definition  |
                        |  - status: pending  |
                        |    | active         |
                        |    | complete       |
                        |    | skipped        |
                        +----------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                     |
              v                    v                     v
    +------------------+  +------------------+  +------------------+
    |  Progress Bar    |  |  Step Renderer   |  |  Completion      |
    |  (reads all      |  |  (renders the    |  |  Check           |
    |   entries with   |  |   active entry)  |  |  (all applicable |
    |   their status)  |  |                  |  |   entries are    |
    +------------------+  +------------------+  |   complete/skip) |
                                                +------------------+
                                                         |
                                                         v
                                                +------------------+
                                                | Reducer          |
                                                | ONBOARDING_DONE  |
                                                | -> ready state   |
                                                +------------------+
```

### Key Changes from Current Architecture

| Aspect | Current | Proposed |
|--------|---------|----------|
| Step list ownership | Reducer has its own list, flow has its own list | Flow builder is the single source |
| Completion check | `isOnboardingComplete()` in reducer with hardcoded conditions | Queue-based: all applicable entries must be complete or skipped |
| Step visibility | `shouldShow` hides steps from the progress bar | `isApplicable` determines inclusion; completed steps stay visible |
| Progress bar | Shows only incomplete steps | Shows all applicable steps with status indicators |
| Reducer knowledge of steps | Hardcodes 5 steps, knows their order | Knows only "onboarding" or "done", delegates everything else |
| Adding a step | Modify flow file + possibly reducer + possibly `isOnboardingComplete` + possibly `handleComplete` | Add step file + add to flow file (2 files) |

### Core Data Structures

```typescript
/**
 * Status of a step in the queue.
 * - pending: not yet reached
 * - active: currently displayed to the user
 * - complete: user completed this step (or it was pre-satisfied)
 * - skipped: user explicitly skipped, or step was not applicable
 */
type StepStatus = "pending" | "active" | "complete" | "skipped";

/**
 * An entry in the onboarding queue. Built by the flow builder
 * at queue construction time. Immutable except for status transitions.
 */
interface StepQueueEntry {
  /** The step definition (meta + component) */
  step: OnboardingStep;
  /** Current status of this entry */
  status: StepStatus;
  /** Whether this step applies to the current user/platform.
   *  Non-applicable steps get status "skipped" at build time
   *  and are excluded from the progress bar. */
  applicable: boolean;
}
```

---

## 3. Step Definition Interface

The step definition interface is deliberately similar to the current `OnboardingStep` + `OnboardingStepMeta` to minimize migration effort, but with two key changes: `shouldShow` is replaced by `isApplicable` (evaluated once) and `isComplete` (evaluated at build time and on transitions), and a new `completionKey` field enables the reducer to check completion without knowing step details.

### Proposed Interface

```typescript
// src/components/onboarding/types/config.ts (modified)

/**
 * Metadata for an onboarding step definition.
 * This is the ONLY thing a developer needs to define to create a step.
 */
export interface OnboardingStepMeta {
  /** Unique step identifier */
  id: OnboardingStepId;

  /** Label shown in the progress bar */
  progressLabel: string;

  /** Platforms where this step exists. Empty/undefined = all platforms. */
  platforms?: Platform[];

  /** Navigation config (back/next buttons) */
  navigation?: StepNavigationConfig;

  /** Skip config. Undefined = step cannot be skipped. */
  skip?: SkipConfig;

  /**
   * Determines if this step is applicable to the current user at queue
   * build time. Unlike the old `shouldShow`, this is evaluated ONCE
   * when the queue is built (and optionally re-evaluated on explicit
   * queue rebuilds after state changes).
   *
   * Examples:
   * - apple-driver: applicable only if Windows + iPhone selected
   * - permissions: applicable only on macOS
   * - secure-storage: applicable only on macOS
   *
   * Steps that are not applicable are excluded from the progress bar
   * and get status "skipped" in the queue.
   *
   * If undefined, the step is always applicable.
   */
  isApplicable?: (context: OnboardingContext) => boolean;

  /**
   * Determines if this step is already complete at queue build time.
   * Used to set initial status for returning users who have already
   * completed some steps.
   *
   * Examples:
   * - phone-type: complete if context.phoneType !== null
   * - email-connect: complete if context.emailConnected === true
   * - permissions: complete if context.permissionsGranted === true
   *
   * If undefined, the step starts as "pending".
   */
  isComplete?: (context: OnboardingContext) => boolean;

  /**
   * Optional: controls whether the "Next" button is enabled.
   * Checked on every render (reactive).
   */
  canProceed?: (context: OnboardingContext) => boolean;
}

/**
 * Complete step definition. Same as current -- meta + Content component.
 */
export interface OnboardingStep {
  meta: OnboardingStepMeta;
  Content: ComponentType<OnboardingStepContentProps>;
}
```

### What Changed from Current Interface

| Field | Old | New | Reason |
|-------|-----|-----|--------|
| `shouldShow` | Evaluated every render, hides step | Removed | Replaced by `isApplicable` + `isComplete` |
| `isApplicable` | Did not exist | Evaluated at build time | Determines if step is in the queue at all |
| `isComplete` | Existed but only used for button state | Evaluated at build time for initial status | Allows pre-marking steps as complete for returning users |
| `isStepComplete` | Existed | Renamed to `isComplete` | Cleaner naming |

### Backward Compatibility

Existing step files need only rename `shouldShow` to the split functions. In most cases, a step's `shouldShow` logic is either "not applicable to this platform/config" (maps to `isApplicable`) or "already done" (maps to `isComplete`). Some steps have a mix -- those get split into both functions.

Current `shouldShow` migration map:

| Step | Current `shouldShow` | `isApplicable` | `isComplete` |
|------|---------------------|----------------|--------------|
| phone-type | `phoneType === null` | always applicable | `phoneType !== null` |
| secure-storage | `!isDatabaseInitialized` | `platform === 'macos'` | `isDatabaseInitialized` |
| account-verification | `isDatabaseInitialized && !isUserVerifiedInLocalDb` | always applicable (when DB ready) | `isUserVerifiedInLocalDb` |
| contact-source | always shown | always applicable | (no current completion check) |
| email-connect | `emailConnected !== true` | always applicable | `emailConnected === true` |
| data-sync | `isDatabaseInitialized && userId !== null` | always applicable (when DB ready) | auto-completes |
| permissions | `permissionsGranted !== true` | `platform === 'macos'` | `permissionsGranted === true` |
| apple-driver | `phoneType === 'iphone' && !driverSetupComplete` | `platform === 'windows' && phoneType === 'iphone'` | `driverSetupComplete` |

---

## 4. Flow Builder

The flow builder is a pure function that takes the platform, the step order, and the current user context, and produces the onboarding queue. It runs once at startup (or after login) and can be re-run when critical context changes (like phone type selection changing which steps are applicable).

### Pure Function Signature

```typescript
// src/components/onboarding/queue/buildQueue.ts

import type { OnboardingStep, OnboardingContext, Platform } from "../types";
import type { StepQueueEntry, StepStatus } from "./types";
import { getFlowSteps } from "../flows";

/**
 * Build the onboarding queue for a given platform and context.
 *
 * This is the ONLY place where step order, applicability, and initial
 * status are determined. It is a pure function with no side effects.
 *
 * @param platform - Current platform (macos, windows)
 * @param context - Current onboarding context (user data, permissions, etc.)
 * @returns Ordered array of queue entries with initial statuses set
 */
export function buildOnboardingQueue(
  platform: Platform,
  context: OnboardingContext
): StepQueueEntry[] {
  // 1. Get the ordered step definitions for this platform
  const steps: OnboardingStep[] = getFlowSteps(platform);

  // 2. Build queue entries with initial status
  const queue: StepQueueEntry[] = steps.map((step) => {
    // Check applicability
    const applicable = step.meta.isApplicable
      ? step.meta.isApplicable(context)
      : true;

    if (!applicable) {
      return { step, status: "skipped" as StepStatus, applicable: false };
    }

    // Check if already complete (for returning users)
    const alreadyComplete = step.meta.isComplete
      ? step.meta.isComplete(context)
      : false;

    const status: StepStatus = alreadyComplete ? "complete" : "pending";

    return { step, status, applicable };
  });

  // 3. Set the first pending entry to "active"
  const firstPending = queue.find(
    (entry) => entry.applicable && entry.status === "pending"
  );
  if (firstPending) {
    firstPending.status = "active";
  }

  return queue;
}

/**
 * Check if the queue represents a completed onboarding.
 * Complete = no applicable entries are "pending" or "active".
 *
 * This replaces the reducer's isOnboardingComplete().
 */
export function isQueueComplete(queue: StepQueueEntry[]): boolean {
  return queue
    .filter((entry) => entry.applicable)
    .every((entry) => entry.status === "complete" || entry.status === "skipped");
}

/**
 * Get the currently active entry in the queue.
 * Returns null if no active entry (queue is complete or empty).
 */
export function getActiveEntry(queue: StepQueueEntry[]): StepQueueEntry | null {
  return queue.find((entry) => entry.status === "active") ?? null;
}

/**
 * Advance the queue after a step is completed or skipped.
 * Returns a NEW queue (immutable update) with the next pending
 * entry set to active.
 *
 * @param queue - Current queue state
 * @param completedStepId - The step that was just completed/skipped
 * @param newStatus - "complete" or "skipped"
 * @returns New queue with updated statuses
 */
export function advanceQueue(
  queue: StepQueueEntry[],
  completedStepId: string,
  newStatus: "complete" | "skipped" = "complete"
): StepQueueEntry[] {
  const newQueue = queue.map((entry) => ({ ...entry }));

  // Mark the completed step
  const completedEntry = newQueue.find(
    (e) => e.step.meta.id === completedStepId
  );
  if (completedEntry) {
    completedEntry.status = newStatus;
  }

  // Find and activate the next pending applicable entry
  const nextPending = newQueue.find(
    (e) => e.applicable && e.status === "pending"
  );
  if (nextPending) {
    nextPending.status = "active";
  }

  return newQueue;
}
```

### Queue Rebuild Triggers

The queue must be rebuilt when context changes that affect applicability:

| Event | Reason | Action |
|-------|--------|--------|
| Phone type selected | apple-driver applicability changes | Rebuild queue |
| DB initialization completes | account-verification, data-sync applicability may change | Rebuild queue |
| Login completes (returning user) | All `isComplete` checks need fresh data | Build initial queue |

Rebuilds preserve the status of already-completed entries. Only "pending" entries are re-evaluated for applicability.

```typescript
/**
 * Rebuild the queue after a context change, preserving completed entries.
 * Only re-evaluates pending/active entries.
 */
export function rebuildQueue(
  currentQueue: StepQueueEntry[],
  platform: Platform,
  newContext: OnboardingContext
): StepQueueEntry[] {
  const steps = getFlowSteps(platform);

  return steps.map((step) => {
    const existing = currentQueue.find((e) => e.step.meta.id === step.meta.id);

    // If already completed, preserve that status
    if (existing && existing.status === "complete") {
      return { ...existing };
    }

    // Re-evaluate applicability and completion
    const applicable = step.meta.isApplicable
      ? step.meta.isApplicable(newContext)
      : true;

    if (!applicable) {
      return { step, status: "skipped" as StepStatus, applicable: false };
    }

    const alreadyComplete = step.meta.isComplete
      ? step.meta.isComplete(newContext)
      : false;

    return {
      step,
      status: alreadyComplete ? ("complete" as StepStatus) : ("pending" as StepStatus),
      applicable,
    };
  }).map((entry, _index, arr) => {
    // Set first pending to active (only if no entry is already active)
    const hasActive = arr.some((e) => e.status === "active");
    if (!hasActive && entry.applicable && entry.status === "pending") {
      // Only set the first one
      const firstPending = arr.find((e) => e.applicable && e.status === "pending");
      if (firstPending === entry) {
        return { ...entry, status: "active" as StepStatus };
      }
    }
    return entry;
  });
}
```

### Testability

The flow builder is a pure function. It takes platform and context, returns a queue. No React, no hooks, no side effects. Testing is straightforward:

```typescript
describe("buildOnboardingQueue", () => {
  it("builds full macOS queue for new user", () => {
    const queue = buildOnboardingQueue("macos", newUserContext);
    expect(queue.filter((e) => e.applicable)).toHaveLength(7);
    expect(queue[0].status).toBe("active"); // phone-type
    expect(queue[1].status).toBe("pending"); // secure-storage
  });

  it("pre-completes steps for returning user", () => {
    const queue = buildOnboardingQueue("macos", returningUserContext);
    const phoneEntry = queue.find((e) => e.step.meta.id === "phone-type");
    expect(phoneEntry?.status).toBe("complete");
  });

  it("marks apple-driver as not applicable on macOS", () => {
    const queue = buildOnboardingQueue("macos", newUserContext);
    const driverEntry = queue.find((e) => e.step.meta.id === "apple-driver");
    expect(driverEntry).toBeUndefined(); // Not in macOS flow at all
  });

  it("marks permissions as not applicable on Windows", () => {
    const queue = buildOnboardingQueue("windows", newUserContext);
    const permEntry = queue.find((e) => e.step.meta.id === "permissions");
    expect(permEntry).toBeUndefined(); // Not in Windows flow at all
  });
});

describe("isQueueComplete", () => {
  it("returns true when all applicable entries are complete", () => {
    const queue = buildOnboardingQueue("macos", allCompleteContext);
    expect(isQueueComplete(queue)).toBe(true);
  });
});
```

---

## 5. Completion Logic

### Current Problem

Currently, two separate functions decide "is onboarding done?":

1. `isOnboardingComplete()` in the reducer -- checks 4 hardcoded conditions
2. Implicit check in `useOnboardingFlow` -- `steps.length === 0` (all filtered out)

These can disagree, causing either premature completion (reducer says done, flow engine has more steps) or stuck state (flow engine says done, reducer still waiting).

### Proposed: Queue-Based Completion

Completion is derived from the queue state. No separate function, no hardcoded checks:

```typescript
// The ONLY completion check in the entire system:
function isOnboardingDone(queue: StepQueueEntry[]): boolean {
  return isQueueComplete(queue);
}
```

A step is "done" when:
- Its status is `"complete"` (user completed it, or `isComplete` returned true at build time)
- Its status is `"skipped"` (user skipped it, or `isApplicable` returned false)

Onboarding is done when every applicable entry in the queue is complete or skipped. There is no separate list of conditions to maintain.

### How Completion Flows to the Reducer

When the flow engine determines the queue is complete, it dispatches a single action:

```typescript
// NEW action type
interface OnboardingQueueDoneAction {
  type: "ONBOARDING_QUEUE_DONE";
  /** Summary data extracted from the queue for the ready state */
  userData: UserData;
}
```

The reducer handles this simply:

```typescript
case "ONBOARDING_QUEUE_DONE": {
  if (state.status !== "onboarding") return state;
  return {
    status: "ready",
    user: state.user,
    platform: state.platform,
    userData: action.userData,
  };
}
```

This eliminates the reducer's need to understand onboarding steps at all. It just knows: "I was told onboarding is done. Here's the user data. Transition to ready."

### Race Condition Prevention

The current system has race conditions because:
1. `useEffect` hooks fire asynchronously
2. Multiple `shouldShow` predicates re-evaluate on every render
3. The reducer can transition to `ready` while the flow engine is still processing

The proposed system prevents this because:
1. Queue state is managed synchronously via `useReducer` (not `useState` with effects)
2. Completion is checked after each step transition, not reactively
3. The `ONBOARDING_QUEUE_DONE` dispatch happens exactly once, from a single location

```typescript
// In the queue hook (replaces useOnboardingFlow):
function handleStepComplete(stepId: string) {
  const newQueue = advanceQueue(queue, stepId, "complete");
  setQueue(newQueue);

  if (isQueueComplete(newQueue)) {
    // Single, deterministic completion point
    dispatch({ type: "ONBOARDING_QUEUE_DONE", userData: buildUserData(newQueue) });
  }
}
```

---

## 6. Progress Bar

### Current Problem

The current progress bar only shows steps where `shouldShow` returns true. This means completed steps disappear, and the user sees a progress bar that changes shape as they advance. A user at step 5 of 7 might see a bar showing 3 steps because 2 were already completed and filtered out.

### Proposed: All Applicable Steps Always Visible

The progress bar renders every entry in the queue where `applicable === true`, regardless of status:

```typescript
// src/components/onboarding/shell/ProgressIndicator.tsx (modified)

interface ProgressIndicatorProps {
  queue: StepQueueEntry[];
}

type VisualStatus = "complete" | "active" | "pending";

function ProgressIndicator({ queue }: ProgressIndicatorProps) {
  // Filter to applicable entries only (non-applicable are truly invisible)
  const visibleEntries = queue.filter((entry) => entry.applicable);

  if (visibleEntries.length === 0) return null;

  return (
    <div className="w-full flex justify-center px-4">
      <div className="flex items-start">
        {visibleEntries.map((entry, index) => {
          const visualStatus: VisualStatus =
            entry.status === "complete" ? "complete" :
            entry.status === "active" ? "active" :
            "pending";

          return (
            <React.Fragment key={entry.step.meta.id}>
              <Step
                status={visualStatus}
                label={entry.step.meta.progressLabel}
              />
              {index < visibleEntries.length - 1 && (
                <ConnectingLine completed={entry.status === "complete"} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
```

### Visual States

| Queue Status | Visual | Color | Icon |
|-------------|--------|-------|------|
| `complete` | Green circle | `bg-green-500` | Checkmark |
| `active` | Blue circle with ring | `bg-blue-500 ring-4 ring-blue-200` | None |
| `pending` | Gray circle | `bg-gray-200` | None |
| `skipped` + applicable | Not shown (non-applicable) | N/A | N/A |

### Example: macOS Returning User (phone selected, email connected)

Current behavior: Progress bar shows `Secure Storage -> Permissions` (2 steps)

Proposed behavior: Progress bar shows `Phone Type [green check] -> Secure Storage -> Account Setup -> Contact Sources -> Email [green check] -> Sync -> Permissions` (7 steps, 2 completed)

The user sees their full journey with clear progress indicators.

---

## 7. Reducer Changes

### Design Goal: Minimal Reducer, Maximum Flow Engine

The reducer should know as little as possible about onboarding steps. Its job is state machine transitions between loading/unauthenticated/onboarding/ready/error. The flow engine handles everything within onboarding.

### What Gets Removed from the Reducer

```typescript
// DELETE: getNextOnboardingStep() - replaced by flow builder
// DELETE: isOnboardingComplete() - replaced by isQueueComplete()
// DELETE: Hardcoded step list in getNextOnboardingStep
// DELETE: userData construction in ONBOARDING_STEP_COMPLETE (complex logic)
// DELETE: precedingSteps logic in ONBOARDING_STEP_COMPLETE
```

### What Gets Added to the Reducer

```typescript
// NEW: Simple action to signal onboarding completion from the flow engine
case "ONBOARDING_QUEUE_DONE": {
  if (state.status !== "onboarding") return state;
  return {
    status: "ready",
    user: state.user,
    platform: state.platform,
    userData: action.userData,
  };
}
```

### What Changes in the Reducer

The `ONBOARDING_STEP_COMPLETE` action becomes a simple passthrough. The reducer no longer computes the next step or checks completion. It just updates `completedSteps` and `selectedPhoneType` for backward compatibility:

```typescript
case "ONBOARDING_STEP_COMPLETE": {
  if (state.status !== "onboarding") return state;

  const completedSteps = state.completedSteps.includes(action.step)
    ? state.completedSteps
    : [...state.completedSteps, action.step];

  const selectedPhoneType =
    action.step === "phone-type" && action.phoneType
      ? action.phoneType
      : state.selectedPhoneType;

  // DO NOT compute next step or check completion.
  // The flow engine handles that and will dispatch
  // ONBOARDING_QUEUE_DONE when all steps are done.
  return {
    ...state,
    completedSteps,
    selectedPhoneType,
  };
}
```

### What Changes in OnboardingState Type

The `step` field in `OnboardingState` becomes optional or is removed entirely. The flow engine tracks the active step via the queue, not the reducer:

```typescript
export interface OnboardingState {
  status: "onboarding";
  user: User;
  platform: PlatformInfo;
  completedSteps: OnboardingStep[];  // Kept for backward compatibility
  selectedPhoneType?: "iphone" | "android";
  hasEmailConnected?: boolean;
  hasPermissions?: boolean;
  deferredDbInit?: boolean;
  // REMOVED: step: OnboardingStep  (flow engine owns this now)
}
```

### Entry into Onboarding

`AUTH_LOADED` and `LOGIN_SUCCESS` still transition to `status: "onboarding"`. But they no longer call `getNextOnboardingStep()` to set an initial step. Instead, they just set the status:

```typescript
case "AUTH_LOADED": {
  // ... existing checks ...
  if (action.isNewUser) {
    return {
      status: "onboarding",
      user: action.user,
      platform: action.platform,
      completedSteps: [],
      deferredDbInit,
    };
  }
  // ... rest unchanged ...
}
```

The flow engine, upon seeing `status === "onboarding"`, builds the queue and takes over.

### USER_DATA_LOADED Changes

The `USER_DATA_LOADED` handler currently has complex logic to determine `completedSteps` and `nextStep`. Under the new architecture, it transitions to `onboarding` status if data indicates onboarding is incomplete, and the flow engine builds the queue:

```typescript
case "USER_DATA_LOADED": {
  // ... existing context extraction ...

  // Simple check: does the user have minimum data to be "ready"?
  // This is a COARSE check. The flow engine does the fine-grained check.
  if (data.phoneType && data.hasCompletedEmailOnboarding &&
      (!platform.isMacOS || data.hasPermissions) &&
      (!platform.isWindows || data.phoneType !== "iphone" || !data.needsDriverSetup)) {
    return {
      status: "ready",
      user, platform, userData: data,
    };
  }

  // Incomplete -- let flow engine handle the details
  return {
    status: "onboarding",
    user, platform,
    completedSteps: [], // Flow engine will compute from context
    deferredDbInit: loadingState.deferredDbInit,
    hasPermissions: data.hasPermissions,
    hasEmailConnected: data.hasEmailConnected,
  };
}
```

**Important caveat:** The coarse check in `USER_DATA_LOADED` must be kept in sync with the flow builder's completion logic. However, the consequence of a false negative (saying "not done" when actually done) is minor -- the flow engine builds the queue, finds all steps complete, and immediately dispatches `ONBOARDING_QUEUE_DONE`. The consequence of a false positive (saying "done" when not done) must be prevented, so the coarse check should be conservative.

---

## 8. Migration Plan

### Phase 1: Introduce Queue Infrastructure (Non-Breaking)

**Files created:**
- `src/components/onboarding/queue/types.ts` -- StepQueueEntry, StepStatus
- `src/components/onboarding/queue/buildQueue.ts` -- buildOnboardingQueue, isQueueComplete, advanceQueue
- `src/components/onboarding/queue/useOnboardingQueue.ts` -- React hook wrapping the pure functions
- `src/components/onboarding/queue/index.ts` -- barrel export

**Files modified:**
- Step files (migrate `shouldShow` to `isApplicable` + `isComplete`): This can be done incrementally. Both the old `shouldShow` and the new functions can coexist during migration.

**Tests added:**
- `src/components/onboarding/queue/__tests__/buildQueue.test.ts`
- `src/components/onboarding/queue/__tests__/advanceQueue.test.ts`

**Risk:** None. New code alongside old code. Nothing changes in production behavior.

### Phase 2: Wire Up Queue Hook (Parallel Path)

**Files modified:**
- `OnboardingFlow.tsx` -- Use `useOnboardingQueue` alongside `useOnboardingFlow`. The queue hook drives the progress bar; the old hook still drives navigation.

**Why parallel:** This lets us validate that the queue produces the same results as the old system before switching navigation to it.

**Validation:** Add logging that compares queue state to old flow state on every transition. Flag any disagreements.

### Phase 3: Switch Navigation to Queue (Breaking Change)

**Files modified:**
- `OnboardingFlow.tsx` -- Remove `useOnboardingFlow`, use `useOnboardingQueue` for everything
- `ProgressIndicator.tsx` -- Accept `StepQueueEntry[]` instead of `OnboardingStep[]`
- Delete `handleComplete` patching function entirely
- Delete all-steps-filtered-out `useEffect` entirely

**Files modified in reducer:**
- `reducer.ts` -- Add `ONBOARDING_QUEUE_DONE`, simplify `ONBOARDING_STEP_COMPLETE`, remove `getNextOnboardingStep` and `isOnboardingComplete`
- `types.ts` -- Add `OnboardingQueueDoneAction`, make `step` optional in `OnboardingState`

### Phase 4: Cleanup

**Files deleted:**
- Nothing deleted, but dead code paths removed from `reducer.ts` and `OnboardingFlow.tsx`

**Files updated:**
- Step files: Remove any remaining `shouldShow` predicates (replaced by `isApplicable` + `isComplete`)
- Remove the old `useOnboardingFlow` hook if fully replaced

### Backward Compatibility: Returning Users

A user who completed onboarding under the old system will have the following data persisted:

| Field | Storage | Value |
|-------|---------|-------|
| phoneType | Local DB + Supabase | "iphone" or "android" |
| hasCompletedEmailOnboarding | Local DB + Supabase | true |
| hasEmailConnected | Local DB + Supabase | true or false |
| hasPermissions | Live OS check (macOS) | true |
| needsDriverSetup | Local DB | false |

When such a user starts the app:
1. Reducer loads user data, sees all conditions met, transitions to `ready`. **This path is unchanged.** The queue is never built because the user never enters `onboarding` state.
2. If for some reason they do enter `onboarding` (e.g., email not connected), the flow builder builds the queue, pre-marks completed steps via `isComplete`, and the user sees only the remaining steps.

**No returning user will be forced through already-completed steps.**

---

## 9. Adding a New Step

### Goal: 2 Files, No Central Function Updates

Adding a new step should require:

1. **Create the step file** (1 file)
2. **Add it to the platform flow** (1 file, one line)

That is it. No reducer changes. No completion function changes. No `handleComplete` patching. No new action types (unless the step has unique behavior).

### Example: Adding a "Notification Preferences" Step

**Step 1: Create the step file**

```typescript
// src/components/onboarding/steps/NotificationPreferencesStep.tsx

import React from "react";
import type {
  OnboardingStep,
  OnboardingStepMeta,
  OnboardingStepContentProps,
} from "../types";

export const meta: OnboardingStepMeta = {
  id: "notification-preferences",
  progressLabel: "Notifications",
  platforms: ["macos", "windows"],
  navigation: {
    showBack: true,
    hideContinue: false,
  },
  skip: {
    enabled: true,
    label: "Skip for now",
    description: "You can configure notifications later in Settings",
  },
  // Applicable to all users on all platforms
  // (no isApplicable needed -- default is "always applicable")

  // Complete if user has already configured notifications
  isComplete: (context) => context.notificationsConfigured === true,
};

function NotificationPreferencesContent({
  onAction,
}: OnboardingStepContentProps) {
  const handleConfigure = () => {
    // Save preferences...
    onAction({ type: "NAVIGATE_NEXT" });
  };

  return (
    <div>
      <h1>Configure Notifications</h1>
      <button onClick={handleConfigure}>Save & Continue</button>
    </div>
  );
}

const NotificationPreferencesStep: OnboardingStep = {
  meta,
  Content: NotificationPreferencesContent,
};

export default NotificationPreferencesStep;
```

**Step 2: Add to flow file(s) and step registry**

```typescript
// src/components/onboarding/flows/macosFlow.ts
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "secure-storage",
  "account-verification",
  "contact-source",
  "email-connect",
  "notification-preferences",  // <-- ADD THIS LINE
  "data-sync",
  "permissions",
] as const;
```

```typescript
// src/components/onboarding/steps/index.ts
import NotificationPreferencesStep from "./NotificationPreferencesStep";

export const STEP_REGISTRY: Record<string, OnboardingStep> = {
  // ... existing entries ...
  "notification-preferences": NotificationPreferencesStep,
};
```

**Step 3 (if needed): Add the step ID to the type union**

```typescript
// src/components/onboarding/types/steps.ts
export type OnboardingStepId =
  | "welcome"
  | "terms"
  | "phone-type"
  // ... existing ...
  | "notification-preferences"  // <-- ADD THIS
  | "complete";
```

**That is it.** No reducer changes. No completion function updates. No `handleComplete` patching. The flow builder sees the new step in the flow, checks `isComplete`, and adds it to the queue.

### What You Do NOT Need to Do

Under the current architecture, adding a step requires:

1. Create the step file
2. Add to flow file
3. Add to step registry
4. **Add to `getNextOnboardingStep()` in reducer.ts** (if it affects completion)
5. **Add to `isOnboardingComplete()` in reducer.ts** (if it has a completion condition)
6. **Add to `ONBOARDING_STEP_COMPLETE` handler's userData construction** (if it writes data)
7. **Add to `handleComplete` in OnboardingFlow.tsx** (if it can be pre-satisfied)
8. **Add the step to OnboardingStep type union in types.ts** (reducer types)

Steps 4-8 are eliminated by this proposal. The OnboardingStepId type union in the onboarding types (step 3 above) is still needed but is purely a type-safety measure in the UI layer.

---

## 10. Risk Assessment

### Risk 1: Queue Rebuild Timing

**Risk:** If the queue is rebuilt at the wrong time (e.g., mid-transition), the user could see a flash of incorrect state or skip a step.

**Mitigation:**
- Queue rebuilds are triggered by explicit events (phone type change, DB init complete), not by reactive effects
- Rebuild preserves completed entries -- only pending entries are re-evaluated
- Use `useReducer` for queue state to ensure synchronous updates

**Severity:** Medium. **Likelihood:** Low with proper implementation.

### Risk 2: False Positive Completion in Reducer

**Risk:** The `USER_DATA_LOADED` coarse check in the reducer could incorrectly route a user to `ready` state, bypassing the flow engine entirely.

**Mitigation:**
- The coarse check should be conservative (only say "done" when ALL known conditions are met)
- Add an assertion in development mode that cross-checks the coarse result with `isQueueComplete(buildOnboardingQueue(...))`
- Document that the coarse check must be a superset of the flow engine's checks (never less strict)

**Severity:** High (user skips steps). **Likelihood:** Low if the coarse check is conservative.

### Risk 3: Migration Regressions

**Risk:** During the migration phases, the old and new systems could produce different results, causing bugs.

**Mitigation:**
- Phase 2 runs both systems in parallel with comparison logging
- Phase 3 (the actual switch) should be behind a feature flag initially
- Comprehensive tests for the pure functions (buildQueue, advanceQueue, isQueueComplete)
- End-to-end test for each user scenario (new macOS, new Windows, returning macOS, returning Windows, partial completion)

**Severity:** High. **Likelihood:** Medium -- this is the highest-risk phase.

### Risk 4: Context Stale Data

**Risk:** The `OnboardingContext` passed to `isApplicable` and `isComplete` could have stale data, leading to incorrect queue state.

**Mitigation:**
- Context is derived from the state machine (same as today)
- Queue rebuilds happen explicitly when context-changing events occur
- The `isComplete` function is called at build time AND can be re-evaluated on rebuild
- Defensive: if `isComplete` returns true but the step was never formally completed, log a warning

**Severity:** Medium. **Likelihood:** Low (same data source as current system).

### Risk 5: "Database Not Initialized" Bugs

**Risk:** Steps that require DB access (account-verification, data-sync) could fail if the queue is built before DB is ready.

**Mitigation:**
- The `isApplicable` function for these steps checks `context.isDatabaseInitialized`
- Steps that are not applicable (DB not ready) are marked "skipped" initially
- When DB becomes ready, a queue rebuild marks them as applicable and pending
- The step's `Content` component should also guard against DB-not-ready state as a defense-in-depth measure

**Severity:** High (blocks onboarding). **Likelihood:** Low with proper guards. This is the same problem the current system has, and the proposed system handles it the same way (checking `isDatabaseInitialized`).

### Risk 6: Increased Bundle Size

**Risk:** The queue infrastructure adds new files and logic.

**Mitigation:**
- The pure functions are small (~100 lines total)
- The hook is similar in size to the current `useOnboardingFlow`
- Dead code from the reducer (`getNextOnboardingStep`, `isOnboardingComplete`) is removed, partially offsetting the addition

**Severity:** Negligible. **Likelihood:** Certain (but impact is minimal).

---

## Appendix A: File Impact Summary

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `src/components/onboarding/queue/types.ts` | StepQueueEntry, StepStatus types | ~30 lines |
| `src/components/onboarding/queue/buildQueue.ts` | Pure functions for queue management | ~120 lines |
| `src/components/onboarding/queue/useOnboardingQueue.ts` | React hook wrapping pure functions | ~100 lines |
| `src/components/onboarding/queue/index.ts` | Barrel export | ~10 lines |
| `src/components/onboarding/queue/__tests__/buildQueue.test.ts` | Unit tests for pure functions | ~200 lines |

### Modified Files

| File | Change | Scope |
|------|--------|-------|
| `reducer.ts` | Remove `getNextOnboardingStep`, `isOnboardingComplete`, simplify `ONBOARDING_STEP_COMPLETE`, add `ONBOARDING_QUEUE_DONE` | Large |
| `types.ts` (machine) | Add `OnboardingQueueDoneAction`, remove `step` from `OnboardingState` | Small |
| `OnboardingFlow.tsx` | Replace `useOnboardingFlow` with `useOnboardingQueue`, remove `handleComplete` and filtered-out effect | Large |
| `ProgressIndicator.tsx` | Accept `StepQueueEntry[]`, show all applicable steps with status | Medium |
| All step files (9 files) | Replace `shouldShow` with `isApplicable` + `isComplete` | Small each |
| `useOnboardingFlow.ts` | Eventually deprecated/deleted | Delete |

### Deleted Code (Net Reduction)

| Removed | Lines (approx) |
|---------|---------------|
| `getNextOnboardingStep()` | ~40 |
| `isOnboardingComplete()` | ~25 |
| Complex `ONBOARDING_STEP_COMPLETE` handler | ~50 |
| `handleComplete` in OnboardingFlow.tsx | ~50 |
| All-steps-filtered useEffect | ~20 |
| **Total removed** | **~185** |

**Net estimate:** ~275 lines added (new queue files) minus ~185 lines removed = ~90 lines net increase, with significantly reduced complexity.

---

## Appendix B: Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Queue built from flow files, not step self-registration | Flow files define order; self-registration cannot define order | Step registry with `order` field -- rejected because ordering would be fragmented across files |
| `isApplicable` evaluated at build time, not reactively | Prevents mid-flow step appearance/disappearance | Reactive evaluation with animation -- rejected as over-complex |
| Reducer keeps `completedSteps` array | Backward compatibility with existing selectors and state restoration | Remove entirely -- rejected because other parts of the app read `completedSteps` |
| Queue is rebuilt on specific events, not on every context change | Prevents unnecessary re-computation and potential flicker | Memoized reactive rebuilds -- rejected because subtle bugs with stale closures |
| `ONBOARDING_QUEUE_DONE` as single completion action | Clean separation: flow engine decides "done", reducer transitions state | Reducer checks completion independently -- rejected because that is the current bug |
