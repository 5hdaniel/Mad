# BACKLOG-485: Deprecate OAuth Popup Flow

**Category**: refactor
**Priority**: P2
**Sprint**: SPRINT-058
**Estimated Tokens**: ~10K
**Status**: Pending

---

## Summary

Remove or deprecate the old OAuth popup flow in favor of the new browser-based authentication.

## Background

The old OAuth popup approach has issues:
- Password managers don't work well
- Security concerns with Electron popups
- Inconsistent UX across platforms

The new browser-based flow is the standard approach (Figma, Slack, VS Code).

## Requirements

### Deprecation Steps

1. **Update Login UI**:
   - "Login with Google" now opens browser
   - "Login with Microsoft" now opens browser
   - Remove popup-related code from UI

2. **Deprecate (Don't Delete) Services**:
   ```typescript
   // electron/services/googleAuthService.ts
   /**
    * @deprecated Use browser-based auth flow instead
    * This code is kept for reference but should not be used.
    */
   export async function signInWithPopup() {
     throw new Error('Deprecated: Use browser-based auth');
   }
   ```

3. **Update Documentation**:
   - `AUTO_UPDATE_GUIDE.md`
   - Any auth-related docs

### Why Deprecate, Not Delete

- Reference for edge cases
- Rollback capability if browser flow has issues
- Understanding of previous approach

## Acceptance Criteria

- [ ] Login buttons open browser instead of popup
- [ ] Popup code marked as deprecated
- [ ] No popup windows opened during auth
- [ ] Documentation updated
- [ ] Both Google and Microsoft use browser flow

## Dependencies

- BACKLOG-484: Browser auth must be fully working first

## Related Files

- `src/components/LoginScreen.tsx` (or equivalent)
- `electron/services/googleAuthService.ts`
- `electron/services/microsoftAuthService.ts`
- `electron/handlers/googleAuthHandlers.ts`
- `electron/handlers/microsoftAuthHandlers.ts`
