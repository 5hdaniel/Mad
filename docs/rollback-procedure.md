# State Machine Rollback Procedure

This document describes how to disable the new state machine if issues are discovered during rollout.

## Quick Reference

| Action | Method |
|--------|--------|
| Check current state | `getFeatureFlagStatus()` in console |
| Disable immediately | `localStorage.setItem('useNewStateMachine', 'false'); location.reload();` |
| Re-enable | `localStorage.setItem('useNewStateMachine', 'true'); location.reload();` |
| Reset to default | `localStorage.removeItem('useNewStateMachine');` |

## Quick Rollback (No Code Change)

If issues are discovered with the new state machine, use one of these methods:

### Option 1: Developer Console

Open DevTools console (F12 or Cmd+Option+I) and run:

```javascript
// Disable the new state machine
localStorage.setItem('useNewStateMachine', 'false');
location.reload();
```

### Option 2: URL Parameter

Add `?newStateMachine=false` to the URL. This takes precedence over localStorage and is useful for testing.

Example: `http://localhost:5173/?newStateMachine=false`

### Option 3: Debug Panel (Development Only)

In development mode, a debug panel appears in the bottom-right corner showing the current state machine status. Click the "Toggle" button to switch between states.

## Verifying Current State

### Check via Console

```javascript
// Import not needed if using window global
const status = {
  localStorage: localStorage.getItem('useNewStateMachine'),
  urlParam: new URLSearchParams(location.search).get('newStateMachine'),
};
console.table(status);
```

### Check via Debug Panel

In development mode, the debug panel shows:
- Current state: ON or OFF
- Source: url, localStorage, or default

## Permanent Rollback (Code Change)

If the feature flag approach isn't sufficient and a code change is required:

1. **Revert App.tsx changes** that wrap with `FeatureFlaggedProvider`
2. **Remove state machine imports** from components
3. **Keep existing hooks unchanged** - they continue to work independently

### Example Revert

Before (with feature flag):
```tsx
import { FeatureFlaggedProvider } from './appCore/state/machine';

function App() {
  return (
    <FeatureFlaggedProvider>
      <AppContent />
    </FeatureFlaggedProvider>
  );
}
```

After (rollback):
```tsx
function App() {
  return <AppContent />;
}
```

## Re-Enable After Fix

Once the issue is resolved:

```javascript
// Clear any explicit setting (returns to default behavior)
localStorage.removeItem('useNewStateMachine');
location.reload();
```

Or explicitly enable:

```javascript
localStorage.setItem('useNewStateMachine', 'true');
location.reload();
```

## Monitoring for Issues

Watch for these symptoms that indicate state machine problems:

### Critical Symptoms (Rollback Immediately)

- **Stuck on loading screen** - App doesn't progress past "Initializing..."
- **Infinite loops** - CPU spikes, browser becomes unresponsive
- **"Database not initialized" errors** - Data layer not ready
- **Onboarding flicker** - Screen flashes between states

### Warning Signs (Investigate)

- Slower than normal startup
- State not persisting correctly
- Actions not updating UI
- Console errors mentioning "state" or "dispatch"

## Default Behavior

| Phase | Default Value | Reason |
|-------|---------------|--------|
| Phase 1 | `false` | Safety - new state machine disabled by default |
| Phase 2 | `true` | Testing - enabled for internal testing |
| Phase 3 | `true` | Production - feature complete |

The default is controlled in `src/appCore/state/machine/utils/featureFlags.ts`.

## Rollback Checklist

When rolling back, verify:

- [ ] Feature flag set to `false` or cleared
- [ ] Page reloaded after change
- [ ] App loads normally
- [ ] No console errors
- [ ] Core functionality works (navigation, data loading)
- [ ] Report issue to PM with:
  - Steps to reproduce
  - Console errors
  - What was being done when issue occurred
