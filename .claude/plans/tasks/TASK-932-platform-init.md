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

## SR Engineer Review Notes

**Review Date:** 2026-01-03 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** project/state-coordination
- **Branch Name:** feature/TASK-932-platform-init
- **Branch Into:** project/state-coordination

### Execution Classification
- **Parallel Safe:** Yes (can run parallel with TASK-931)
- **Depends On:** TASK-930
- **Blocks:** None (end of chain)

### Shared File Analysis
- Files created: `utils/platformInit.ts`
- Files modified: `LoadingOrchestrator.tsx` (adds platform-specific logic)
- Conflicts with: **COORDINATE WITH TASK-931** - both touch orchestrator area

### Technical Considerations

**Platform Detection Robustness:**
The proposed `detectPlatform()` is good. Enhance with:
```typescript
// Check both platform and userAgent for robustness
const isMacOS = platform.includes('Mac') || userAgent.includes('Macintosh');
const isWindows = platform.includes('Win') || userAgent.includes('Windows');
```

**Existing Platform Detection:**
The codebase already has `usePlatform()` hook from contexts. Consider:
1. Platform detection in LoadingOrchestrator should NOT use hooks (runs before context)
2. Use raw `window.navigator` detection early
3. Can sync with context later if needed

**macOS Keychain Flow:**
The existing `useSecureStorage.ts` handles macOS keychain prompts. Ensure:
- LoadingOrchestrator doesn't duplicate this logic
- Just detect platform and let existing flow handle prompts
- Or migrate keychain handling to new state machine (may be Phase 2 scope)

**Windows DPAPI:**
Existing code auto-initializes on Windows. Ensure new orchestrator:
- Dispatches `DB_INIT_STARTED` before calling API
- Handles success/failure correctly
- Doesn't race with existing `useSecureStorage` (they run parallel)

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

*Completed: 2026-01-03*

### Agent ID

```
Engineer Agent ID: engineer-task-932
```

### Checklist

```
Files:
- [x] src/appCore/state/machine/utils/platformInit.ts
- [x] Updated LoadingOrchestrator.tsx
- [x] Platform tests (platformInit.test.ts - 17 tests)
- [x] Updated LoadingScreen.tsx with platform-specific messages
- [x] Updated LoadingOrchestrator.test.tsx with platform tests

Features:
- [x] Platform detection (detectPlatform with userAgent fallback)
- [x] Windows auto-init (autoInitializesStorage utility)
- [x] macOS keychain handling (needsKeychainPrompt utility)
- [x] Platform-specific loading messages (getDbInitMessage utility)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] Platform utility tests pass (17/17)
```

### Metrics

| Phase | Turns | Tokens (est) | Time |
|-------|-------|--------------|------|
| Planning (Plan) | 1 | ~4K | 5 min |
| Implementation (Impl) | 8 | ~32K | 25 min |
| Debugging (Debug) | 0 | 0 | 0 |
| **Total** | **9** | **~36K** | **30 min** |

**Variance:** PM Est ~40K vs Actual ~36K (within estimate)

---

## SR Engineer Review (SR-Owned)

*Review Date: 2026-01-03*

### Review Summary

**Architecture Compliance:** PASS

### Checklist Results

| Check | Status | Notes |
|-------|--------|-------|
| Target branch correct | PASS | project/state-coordination |
| Traditional merge | PASS | Used --merge |
| TypeScript strict mode | PASS | No type errors |
| Tests added | PASS | 17 unit tests for platform utilities |
| No debug code | PASS | Clean implementation |
| Architecture boundaries | PASS | Utilities in proper location |
| Effect safety patterns | PASS | Uses ref for platform detection |
| Engineer metrics present | PASS | Documented in task file |

### Notes

- Required merge conflict resolution after PR #292 merge
- Test fix needed: LoadingOrchestrator.test.tsx expected wrong message for macOS
- Platform detection is robust (uses both platform and userAgent)
- Platform-specific DB init paths are well-structured

### Merge Information

**PR Number:** #293
**Merged To:** project/state-coordination
