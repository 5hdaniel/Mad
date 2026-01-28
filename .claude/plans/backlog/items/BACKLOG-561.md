# BACKLOG-561: Use popup browser for upgrade URL instead of system browser

**Created**: 2026-01-28
**Status**: backlog
**Priority**: low
**Type**: enhancement

## Description

When a user clicks the "Upgrade" button on the expired trial or transaction limit screen, it currently opens the upgrade URL in the system browser. This bounces the user out of the app.

## Desired Behavior

Use the same popup BrowserWindow pattern as the email OAuth flow to keep the user in-app. This provides a more seamless upgrade experience.

## Technical Notes

- The popup infrastructure already exists in `electron/auth/` for OAuth flows
- Reuse the same BrowserWindow configuration
- May need to handle the redirect/close after successful purchase

## Acceptance Criteria

- [ ] Upgrade button opens URL in Electron popup window (not system browser)
- [ ] Popup closes after successful purchase or user dismissal
- [ ] License status refreshes after popup closes

## References

- Email OAuth popup: `electron/auth/googleAuth.ts`, `electron/auth/microsoftAuth.ts`
- LicenseGate upgrade button: `src/components/license/UpgradeScreen.tsx`
