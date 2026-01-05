# State Machine Architecture Review

**Date**: 2026-01-05
**File**: `src/appCore/state/useAppStateMachine.ts`
**Rating**: NEEDS IMPROVEMENT

## Summary

The current implementation uses implicit state derivation via React effects rather than an explicit finite state machine pattern. This creates maintainability and testability issues.

## Current Architecture

### Navigation States (`AppStep`)

| State | Description |
|-------|-------------|
| `loading` | Initial app load |
| `login` | Authentication screen |
| `keychain-explanation` | macOS keychain prompt |
| `phone-type-selection` | iPhone vs Android |
| `android-coming-soon` | Android not supported |
| `apple-driver-setup` | Windows iPhone driver |
| `email-onboarding` | Connect Gmail/Outlook |
| `microsoft-login` | Microsoft OAuth |
| `permissions` | macOS permissions |
| `dashboard` | Main app |
| `outlook` | Email export |
| `complete` | Export finished |
| `contacts` | Contact selection |

### State Variables Determining Navigation

| Variable | Type | Purpose |
|----------|------|---------|
| `isAuthenticated` | boolean | User logged in |
| `pendingOAuthData` | object/null | OAuth in progress, DB not ready |
| `pendingOnboardingData.termsAccepted` | boolean | Terms accepted (pre-DB) |
| `pendingOnboardingData.phoneType` | string/null | Phone selected (pre-DB) |
| `pendingOnboardingData.emailConnected` | boolean | Email done (pre-DB) |
| `hasSelectedPhoneType` | boolean | Phone selected (post-DB) |
| `needsDriverSetup` | boolean | Windows iPhone driver needed |
| `hasCompletedEmailOnboarding` | boolean | Email step done (post-DB) |
| `hasEmailConnected` | boolean | Email account linked |
| `hasPermissions` | boolean | macOS permissions granted |
| `isMacOS` / `isWindows` | boolean | OS detection |

## Issues Identified

### Critical

| Issue | Description |
|-------|-------------|
| No explicit transitions | Transitions scattered across effects/handlers, not in a transition table |
| 17-dependency effect | Main navigation effect runs on nearly every state change |
| Implicit state derivation | Dashboard requires 9 conditions to all be true |
| Untestable | Requires mocking 8+ dependencies for integration tests |

### Medium

| Issue | Description |
|-------|-------------|
| Boolean flag soup | 10+ boolean flags = 2^10 implicit state combinations |
| Pre-DB/Post-DB duplication | Every handler has two code paths that must stay in sync |
| 900-line file | TODO says 600, now 900 and growing |
| Race conditions | Multiple effects can set `currentStep` simultaneously |

## Backlog Items

### High Priority

1. **Split useAppStateMachine.ts** (Medium effort)
   - Extract `useAuthFlow.ts` (login, logout, pending OAuth)
   - Extract `usePhoneOnboardingFlow.ts` (phone selection + drivers)
   - Extract `usePermissionsFlow.ts` (macOS permissions)
   - Extract `useExportFlow.ts` (conversations, Outlook)
   - Keep orchestrator under 200 lines

2. **Create explicit transition table** (Medium effort)
   - Define `transitions.ts` with allowed state transitions
   - Replace 80+ lines of nested conditionals
   - Enable visualization and debugging

3. **Separate modal state** (Low effort)
   - Extract `useModalState.ts`
   - Use single `activeModal` instead of 9 boolean flags
   - Prevent invalid modal combinations

### Medium Priority

4. **Unify Pre-DB/Post-DB flows** (High effort)
   - Create unified action handlers
   - Queue actions during pre-DB, execute after DB init
   - Eliminate duplicated code paths in 6+ handlers

5. **Add transition logging** (Low effort)
   - Log state transitions for debugging
   - Track transition history

### Future Consideration

6. **Evaluate XState migration** (High effort)
   - Proper FSM semantics
   - Visual state chart editor
   - Time-travel debugging
   - Auto-generated TypeScript types

## Recommended File Structure

```
src/appCore/state/
├── flows/
│   ├── useAuthFlow.ts
│   ├── useSecureStorageFlow.ts    # exists
│   ├── usePhoneOnboardingFlow.ts
│   ├── useEmailOnboardingFlow.ts  # exists
│   ├── usePermissionsFlow.ts
│   └── useExportFlow.ts
├── useModalState.ts
├── useAppStateMachine.ts          # orchestrator only
└── transitions.ts                 # explicit transition map
```

## Industry Comparison

| Aspect | Current | XState | Redux Toolkit |
|--------|---------|--------|---------------|
| Transitions | Implicit | Explicit map | Explicit reducers |
| Testing | Integration | Pure functions | Pure functions |
| Debugging | console.log | Time-travel | DevTools |
| Visualization | None | Auto state graph | Action history |
