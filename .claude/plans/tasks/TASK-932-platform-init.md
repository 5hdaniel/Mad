# Task TASK-932: Platform-Specific Initialization Paths

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Implement platform-specific initialization logic in the state machine, handling the differences between macOS (keychain prompts) and Windows (DPAPI auto-init).

## Non-Goals

- Do NOT change the core reducer logic
- Do NOT implement new platform detection
- Do NOT modify existing platform hooks

## Deliverables

1. Update: `src/appCore/state/machine/LoadingOrchestrator.tsx` - Add platform-specific paths
2. New file: `src/appCore/state/machine/utils/platformInit.ts` - Platform utilities
3. Tests for platform-specific behavior

## Acceptance Criteria

- [ ] macOS shows keychain explanation for new users
- [ ] Windows auto-initializes without prompt
- [ ] Returning users on both platforms skip unnecessary steps
- [ ] Platform detected early in loading
- [ ] Platform info available in ready state
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Platform Utilities

```typescript
// src/appCore/state/machine/utils/platformInit.ts

import type { PlatformInfo } from '../types';

/**
 * Detect platform from navigator.
 */
export function detectPlatform(): Omit<PlatformInfo, 'hasIPhone'> {
  const platform = window.navigator.platform || '';
  const userAgent = window.navigator.userAgent || '';

  return {
    isMacOS: platform.includes('Mac') || userAgent.includes('Mac'),
    isWindows: platform.includes('Win') || userAgent.includes('Windows'),
  };
}

/**
 * Determine if platform needs explicit keychain setup.
 * macOS uses Keychain which may prompt for access.
 * Windows uses DPAPI which is silent.
 */
export function needsKeychainPrompt(platform: { isMacOS: boolean; isWindows: boolean }): boolean {
  return platform.isMacOS;
}

/**
 * Determine if platform auto-initializes storage.
 * Windows DPAPI doesn't require user interaction.
 */
export function autoInitializesStorage(platform: { isMacOS: boolean; isWindows: boolean }): boolean {
  return platform.isWindows;
}
```

### Updated LoadingOrchestrator

Key changes for platform-specific logic:

```typescript
// In LoadingOrchestrator.tsx

import { detectPlatform, needsKeychainPrompt, autoInitializesStorage } from './utils/platformInit';

export function LoadingOrchestrator({ children }: LoadingOrchestratorProps) {
  const { state, dispatch } = useAppState();
  const platformRef = useRef(detectPlatform());

  // ============================================
  // PHASE 2: Initialize database (platform-specific)
  // ============================================
  useEffect(() => {
    if (state.status === 'loading' && state.phase === 'initializing-db') {
      const platform = platformRef.current;

      // Windows: Auto-initialize (DPAPI is silent)
      if (autoInitializesStorage(platform)) {
        dispatch({ type: 'DB_INIT_STARTED' });
        window.api.system.initializeSecureStorage()
          .then(result => {
            dispatch({
              type: 'DB_INIT_COMPLETE',
              success: result.success,
              error: result.error,
            });
          })
          .catch(error => {
            dispatch({
              type: 'DB_INIT_COMPLETE',
              success: false,
              error: error.message,
            });
          });
      }
      // macOS: For new users, we need to show keychain explanation
      // This will be handled by the UI - orchestrator just waits
      else if (needsKeychainPrompt(platform)) {
        // Don't auto-init on macOS - wait for user to click Continue
        // The KeychainExplanation component will trigger init
      }
    }
  }, [state.status, state.phase, dispatch]);

  // ... rest of implementation
}
```

### Platform-Specific Loading Screen

```typescript
// Update LoadingScreen to show platform-appropriate message

const PHASE_MESSAGES: Record<LoadingPhase, (platform: { isMacOS: boolean }) => string> = {
  'checking-storage': () => 'Checking secure storage...',
  'initializing-db': (platform) =>
    platform.isMacOS
      ? 'Waiting for Keychain access...'
      : 'Initializing secure database...',
  'loading-auth': () => 'Loading authentication...',
  'loading-user-data': () => 'Loading your data...',
};
```

### Important Details

- Platform detection should happen once at startup
- Windows DPAPI doesn't require user interaction
- macOS Keychain may show system prompt
- Returning users on macOS may have stored keychain access

## Integration Notes

- Imports from: `./types`, `./useAppState`
- Updates: `LoadingOrchestrator.tsx`
- Depends on: TASK-930

## Do / Don't

### Do:

- Detect platform once and cache
- Handle both platforms explicitly
- Test on both platforms

### Don't:

- Change core reducer
- Modify existing platform hooks
- Add platform checks in reducer

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests:
  - Platform detection
  - Windows auto-init path
  - macOS prompt path

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create/update | 3 files | +15K |
| Platform logic | Medium | +15K |
| Tests | Medium | +10K |

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files:
- [ ] src/appCore/state/machine/utils/platformInit.ts
- [ ] Updated LoadingOrchestrator.tsx
- [ ] Platform tests

Features:
- [ ] Platform detection
- [ ] Windows auto-init
- [ ] macOS keychain handling

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~40K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL

### Merge Information

**PR Number:** #XXX
**Merged To:** project/state-coordination
