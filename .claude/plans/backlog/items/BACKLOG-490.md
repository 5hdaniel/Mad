# BACKLOG-490: Fix EMAIL_CONNECTED Not Updating in Ready State

**Category**: bug
**Priority**: P0
**Sprint**: SPRINT-056
**Estimated Tokens**: ~15K
**Status**: Pending

---

## Summary

Dashboard shows "Complete your account setup" banner even after user connects email from Settings, because the `EMAIL_CONNECTED` action in the reducer only handles the onboarding state.

## Bug Report

**Discovered**: SPRINT-052/053 testing
**Severity**: High (affects user experience, confusing UI state)

### Symptoms

1. User completes onboarding (first-time setup)
2. Later, user connects Microsoft Outlook via Settings
3. Settings shows email as "Connected" (green status)
4. Dashboard still shows "Complete your account setup" banner
5. Banner persists until app restart or manual refresh

### Root Cause

The `EMAIL_CONNECTED` action in the app state reducer only handles the onboarding state:

```typescript
case "EMAIL_CONNECTED": {
  if (state.status !== "onboarding") {
    return state;  // DOES NOTHING if already in "ready" state!
  }
  // ... rest of onboarding logic
}
```

When the user connects email from Settings (after onboarding is complete), `state.userData.hasEmailConnected` is never updated because the reducer returns early.

## Requirements

### Fix the Reducer

1. **Handle EMAIL_CONNECTED in ready state**:
   ```typescript
   case "EMAIL_CONNECTED": {
     if (state.status === "ready") {
       return {
         ...state,
         userData: {
           ...state.userData,
           hasEmailConnected: true,
         },
       };
     }
     if (state.status !== "onboarding") {
       return state;
     }
     // ... existing onboarding logic
   }
   ```

2. **Verify action dispatch**:
   - Confirm `EMAIL_CONNECTED` action is dispatched from Settings email connect
   - Check `src/appCore/state/flows/useEmailHandlers.ts` for dispatch logic

### Verify Dashboard Logic

1. Confirm Dashboard uses `userData.hasEmailConnected` for banner visibility
2. Ensure banner hides immediately when state updates (no stale state)

## Acceptance Criteria

- [ ] Connect email from Settings updates `userData.hasEmailConnected` to true
- [ ] Dashboard "Complete your account setup" banner disappears immediately
- [ ] Works for both Gmail and Microsoft connections
- [ ] No regression in onboarding flow
- [ ] State persists across app restarts

## Files to Modify

- `src/appCore/state/machine/reducer.ts` - Handle EMAIL_CONNECTED in ready state
- `src/appCore/state/flows/useEmailHandlers.ts` - Verify action dispatch (may need changes)

## Testing

1. Complete onboarding without connecting email
2. Dashboard shows "Complete your account setup" banner
3. Go to Settings > Connect Microsoft Outlook
4. Verify Settings shows "Connected" status
5. Return to Dashboard
6. Verify banner is gone
7. Restart app
8. Verify banner stays gone

## Related Files

- `src/appCore/state/machine/reducer.ts`
- `src/appCore/state/flows/useEmailHandlers.ts`
- `src/components/Dashboard.tsx` (verify banner logic)
