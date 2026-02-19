# BACKLOG-480: License Check at App Start

**Category**: service
**Priority**: P0
**Sprint**: SPRINT-057
**Estimated Tokens**: ~15K
**Status**: Completed

---

## Summary

Integrate license validation into the app startup flow to block users with expired or invalid licenses.

## Background

After authentication, the app must validate the user's license before allowing access to the main application.

## Requirements

### App Start Flow

```typescript
async function initializeLicense(userId: string): Promise<void> {
  // 1. Validate license
  const status = await validateLicense(userId);

  // 2. If blocked, show appropriate screen
  if (!status.isValid) {
    switch (status.blockReason) {
      case 'expired':
        showUpgradeScreen('trial_expired');
        break;
      case 'limit_reached':
        showUpgradeScreen('limit_reached');
        break;
      case 'no_license':
        await createUserLicense(userId);
        break;
    }
    return;
  }

  // 3. Register device if not already
  const deviceResult = await registerDevice(userId);
  if (!deviceResult.success && deviceResult.error === 'device_limit_reached') {
    showDeviceLimitScreen();
    return;
  }

  // 4. Continue to app
}
```

### Integration Points

1. **Main Process** (`electron/main.ts`):
   - Initialize license check after auth callback
   - Send license status to renderer

2. **App Component** (`src/App.tsx`):
   - Add license gate before main app content
   - Show blocking screens when appropriate

3. **Auth Flow**:
   - Integrate with existing useAuthFlow
   - Handle license creation for new users

## Acceptance Criteria

- [ ] License validated on every app start
- [ ] Expired trial blocks access with upgrade prompt
- [ ] Transaction limit shows warning when approaching
- [ ] Device limit blocks with device management option
- [ ] New users get trial license created automatically
- [ ] Offline grace period works

## Dependencies

- BACKLOG-478: License service must exist
- BACKLOG-479: Device service must exist

## Related Files

- `electron/main.ts`
- `src/App.tsx`
- `src/appCore/state/flows/useAuthFlow.ts`
