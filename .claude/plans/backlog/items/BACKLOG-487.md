# BACKLOG-487: Core Lifecycle Events

**Category**: service
**Priority**: P0
**Sprint**: SPRINT-059
**Estimated Tokens**: ~10K
**Status**: Pending

---

## Summary

Implement tracking for core app lifecycle events: app start, close, sign in, sign out.

## Background

These are the foundational events for understanding user sessions and authentication patterns.

## Requirements

### Events to Track

| Event | When | Properties |
|-------|------|------------|
| `app_started` | App launch completes | `version`, `platform`, `license_type` |
| `app_closed` | App closes | `session_duration_seconds` |
| `user_signed_in` | Auth completes | `provider` |
| `user_signed_out` | Logout | - |

### Implementation

1. **App Lifecycle** (electron/main.ts):
   ```typescript
   app.on('ready', () => {
     initTelemetry();
     track('app_started', {
       version: app.getVersion(),
       platform: process.platform,
     });
   });

   app.on('before-quit', () => {
     track('app_closed', {
       session_duration_seconds: getSessionDuration(),
     });
   });
   ```

2. **Auth Events**:
   ```typescript
   // After successful auth
   track('user_signed_in', { provider: 'google' });
   identify(userId, {
     license_type: licenseStatus.licenseType,
     platform: process.platform,
   });
   ```

3. **Session Duration**:
   - Track app start time
   - Calculate duration on quit

## Acceptance Criteria

- [ ] `app_started` fires on launch with version and platform
- [ ] `app_closed` fires on quit with session duration
- [ ] `user_signed_in` fires after successful auth with provider
- [ ] `user_signed_out` fires on logout
- [ ] User identified with license type after sign in
- [ ] Events appear in PostHog dashboard

## Dependencies

- BACKLOG-486: PostHog SDK must be integrated

## Related Files

- `electron/main.ts`
- `electron/services/telemetryService.ts`
- `src/appCore/state/flows/useAuthFlow.ts`
