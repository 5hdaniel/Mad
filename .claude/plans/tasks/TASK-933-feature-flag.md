# Task TASK-933: Feature Flag and Rollback Mechanism

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Add the ability to disable the new state machine via a feature flag, allowing quick rollback if issues are discovered. This is a safety mechanism for the gradual rollout.

## Non-Goals

- Do NOT implement full A/B testing
- Do NOT add remote feature flag service
- Do NOT modify existing useAppStateMachine hook

## Deliverables

1. New file: `src/appCore/state/machine/FeatureFlag.tsx` - Feature flag wrapper
2. New file: `src/appCore/state/machine/utils/featureFlags.ts` - Flag utilities
3. Update: `src/appCore/state/machine/index.ts` - Add exports
4. New file: `docs/rollback-procedure.md` - Rollback documentation

## Acceptance Criteria

- [ ] Feature flag respected at runtime
- [ ] Can toggle via localStorage
- [ ] Can toggle via URL parameter (for testing)
- [ ] Rollback procedure documented
- [ ] No runtime errors when disabled
- [ ] Existing hooks work when flag is off
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Feature Flag Utilities

```typescript
// src/appCore/state/machine/utils/featureFlags.ts

/**
 * Feature flag for new state machine.
 * Can be controlled via:
 * 1. localStorage: 'useNewStateMachine' = 'true' | 'false'
 * 2. URL param: ?newStateMachine=true
 */
export function isNewStateMachineEnabled(): boolean {
  // URL param takes precedence (for testing)
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('newStateMachine');
    if (urlParam === 'true') return true;
    if (urlParam === 'false') return false;
  }

  // Check localStorage
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('useNewStateMachine');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  }

  // Default: enabled (feature is ready for testing)
  return true;
}

/**
 * Enable the new state machine.
 */
export function enableNewStateMachine(): void {
  localStorage.setItem('useNewStateMachine', 'true');
  // Optionally reload to apply
  window.location.reload();
}

/**
 * Disable the new state machine (rollback).
 */
export function disableNewStateMachine(): void {
  localStorage.setItem('useNewStateMachine', 'false');
  // Optionally reload to apply
  window.location.reload();
}

/**
 * Clear the feature flag (return to default).
 */
export function clearStateMachineFlag(): void {
  localStorage.removeItem('useNewStateMachine');
}
```

### Feature Flag Wrapper

```typescript
// src/appCore/state/machine/FeatureFlag.tsx

import React from 'react';
import { isNewStateMachineEnabled } from './utils/featureFlags';
import { AppStateProvider } from './AppStateContext';
import { LoadingOrchestrator } from './LoadingOrchestrator';

interface FeatureFlaggedProviderProps {
  children: React.ReactNode;
  /** Fallback when new state machine is disabled */
  fallback?: React.ReactNode;
}

/**
 * Wraps children with new state machine if enabled.
 * Falls back to children without wrapper if disabled.
 */
export function FeatureFlaggedProvider({
  children,
  fallback,
}: FeatureFlaggedProviderProps) {
  // Check flag once on mount (don't re-check on every render)
  const [isEnabled] = React.useState(() => isNewStateMachineEnabled());

  if (!isEnabled) {
    // Return fallback or just children (existing hooks will work)
    return <>{fallback ?? children}</>;
  }

  // New state machine enabled
  return (
    <AppStateProvider>
      <LoadingOrchestrator>
        {children}
      </LoadingOrchestrator>
    </AppStateProvider>
  );
}

// Development helper component
export function StateMachineDebugPanel() {
  const isEnabled = isNewStateMachineEnabled();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        padding: '8px 12px',
        background: isEnabled ? '#10b981' : '#ef4444',
        color: 'white',
        borderRadius: 4,
        fontSize: 12,
        zIndex: 9999,
      }}
    >
      State Machine: {isEnabled ? 'ON' : 'OFF'}
    </div>
  );
}
```

### Rollback Procedure Documentation

```markdown
// docs/rollback-procedure.md

# State Machine Rollback Procedure

## Quick Rollback (No Code Change)

If issues are discovered with the new state machine:

### Option 1: Developer Console

```javascript
// Open DevTools console and run:
localStorage.setItem('useNewStateMachine', 'false');
location.reload();
```

### Option 2: URL Parameter

Add `?newStateMachine=false` to the URL.

## Permanent Rollback (Code Change)

If the feature flag approach isn't sufficient:

1. Revert the App.tsx changes that wrap with FeatureFlaggedProvider
2. Remove the state machine imports
3. Keep existing hooks unchanged

## Re-Enable After Fix

```javascript
localStorage.removeItem('useNewStateMachine');
location.reload();
```

## Monitoring

Check for these symptoms of state machine issues:
- Stuck on loading screen
- Infinite loops
- "Database not initialized" errors
- Onboarding flicker

If any occur, rollback immediately and report to PM.
```

### Important Details

- Flag is checked once on mount (not reactive)
- URL param overrides localStorage
- Default is enabled (for Phase 1 testing)
- Development panel shows current state

## Integration Notes

- Imports from: `./AppStateContext`, `./LoadingOrchestrator`
- Used by: App.tsx (after Phase 2 migration)
- Depends on: TASK-929, TASK-930

## Do / Don't

### Do:

- Check flag once on mount
- Document rollback clearly
- Provide dev helper panel
- Support multiple toggle methods

### Don't:

- Re-check flag on every render
- Make flag reactive (causes confusion)
- Add external dependencies

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests:
  - Flag respects localStorage
  - Flag respects URL param
  - URL param overrides localStorage
  - Wrapper renders correctly

---

## SR Engineer Review Notes

**Review Date:** 2026-01-03 | **Status:** APPROVED with Recommendation

### Branch Information (SR Engineer decides)
- **Branch From:** project/state-coordination
- **Branch Name:** feature/TASK-933-feature-flag
- **Branch Into:** project/state-coordination

### Execution Classification
- **Parallel Safe:** Yes (can run parallel with TASK-930)
- **Depends On:** TASK-929
- **Blocks:** None

### Shared File Analysis
- Files created: `FeatureFlag.tsx`, `utils/featureFlags.ts`, `docs/rollback-procedure.md`
- Files modified: `index.ts` (add exports)
- Conflicts with: None

### Technical Considerations

**Default Value Recommendation:**
The implementation notes set default to `true` (enabled).

**RECOMMENDATION:** Change default to `false` for Phase 1:
```typescript
// Default: disabled in Phase 1 (safety)
// Change to true in Phase 2 when ready for testing
return false;
```

This ensures the new state machine doesn't activate until explicitly enabled, providing safer rollout.

**URL Parameter Priority:**
The URL param overriding localStorage is correct for testing. Ensure:
- `?newStateMachine=true` enables
- `?newStateMachine=false` disables
- Any other value or missing = use localStorage or default

**Debug Panel:**
The dev-only debug panel is useful. Ensure:
- Only renders in development (`process.env.NODE_ENV === 'development'`)
- Position doesn't conflict with other dev tools
- Consider adding a toggle button for quick testing

**Documentation:**
The rollback procedure doc is good. Also document:
- How to verify flag state (console command)
- How to check which system is active
- Monitoring for state machine issues

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 files | +10K |
| Code volume | ~150 lines | +10K |
| Documentation | Medium | +5K |

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/appCore/state/machine/FeatureFlag.tsx
- [ ] src/appCore/state/machine/utils/featureFlags.ts
- [ ] docs/rollback-procedure.md
- [ ] Updated index.ts

Features:
- [ ] Feature flag utilities
- [ ] FeatureFlaggedProvider
- [ ] Debug panel (dev only)
- [ ] Rollback documentation

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

**Variance:** PM Est ~25K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: 2026-01-04*

### Review Summary

**Architecture Compliance:** PASS
**Test Coverage:** Adequate (30 tests)

### Code Quality Assessment

- Clean separation between utilities and components
- URL parameter override for testing is well-implemented
- Default to `false` (Phase 1 safety) per SR recommendation
- Debug panel is dev-only with process.env check
- Comprehensive test coverage

### SR Metrics

| Phase | Turns | Tokens (est) | Time |
|-------|-------|--------------|------|
| Code Review | 1 | ~8K | 10 min |
| CI Wait/Merge | 1 | ~2K | 5 min |
| **Total** | **2** | **~10K** | **15 min** |

### Merge Information

**PR Number:** #290
**Merged To:** project/state-coordination
**Merge Date:** 2026-01-04
