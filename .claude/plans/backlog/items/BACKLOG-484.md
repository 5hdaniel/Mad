# BACKLOG-484: License Validation at Auth

**Category**: service
**Priority**: P0
**Sprint**: SPRINT-062
**Estimated Tokens**: ~15K
**Actual Tokens**: ~22K
**Status**: Testing
**Completed**: 2026-01-27
**PR**: #634 (feat(license): add license validation at auth via deep link)
**Task**: TASK-1507

---

## Summary

Integrate license validation immediately after successful authentication to block users before they enter the app.

## Background

License validation should happen as the final step of authentication, not as a separate gate inside the app. This ensures consistent blocking for expired licenses.

## Requirements

### Implementation

```typescript
// In auth callback handler
async function handleAuthSuccess(accessToken: string, refreshToken: string) {
  // 1. Set session
  const { data: { user } } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (!user) {
    showError('Login failed');
    return;
  }

  // 2. Validate license
  const licenseStatus = await validateLicense(user.id);

  if (!licenseStatus.isValid) {
    navigateTo('/license-blocked', { reason: licenseStatus.blockReason });
    return;
  }

  // 3. Register device
  const deviceResult = await registerDevice(user.id);

  if (!deviceResult.success) {
    navigateTo('/device-limit');
    return;
  }

  // 4. Continue to app
  navigateTo('/dashboard');
}
```

### Integration Points

1. **Main Process**:
   - Handle `auth:callback` from deep link
   - Validate license before showing main window

2. **Renderer**:
   - Update app state based on license status
   - Route to appropriate screen

3. **License Context**:
   - Update to read from Supabase
   - Keep local cache for quick access

## Acceptance Criteria

- [ ] License validated immediately after auth
- [ ] Expired license blocks before entering app
- [ ] Device registration happens after license check
- [ ] Device limit shows management screen
- [ ] New users get trial license created
- [ ] License context updated from Supabase

## Dependencies

- BACKLOG-483: Browser auth must work first
- Uses services from SPRINT-057

## Related Files

- `electron/main.ts`
- `src/App.tsx`
- `src/contexts/LicenseContext.tsx`
