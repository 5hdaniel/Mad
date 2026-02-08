# BACKLOG-620: Implement session timeout for broker portal

**Status:** Pending
**Priority:** Medium
**Category:** Security
**Created:** 2026-02-05
**Estimate:** ~20K tokens

## Summary

Add automatic session timeout/expiry for the broker portal web app. When a user's session has been idle for a configurable period (e.g., 30 minutes), they should be logged out automatically and redirected to the login page. This is a security best practice for web applications handling sensitive real estate transaction data.

## Description

The broker portal currently relies on Supabase Auth for session management via OAuth (Google/Microsoft). However, there is no automatic timeout mechanism to log out users after periods of inactivity or to enforce absolute session duration limits.

This backlog item covers implementing a comprehensive session timeout system with both idle timeout and absolute duration limits, warning dialogs, and organization-specific configuration for compliance requirements.

## Acceptance Criteria

- [ ] Idle timeout implemented (default 30 minutes)
  - Timer resets on user activity (clicks, navigation, form input)
  - Timer can be paused during critical operations (e.g., file uploads, long-running syncs)
- [ ] Absolute session duration limit implemented
  - Maximum session lifetime regardless of activity (e.g., 8 hours)
  - Logs out user even if continuously active
- [ ] Warning dialog implementation
  - Shows 5-minute warning before timeout
  - Displays countdown timer
  - Offers "Extend Session" button to reset idle timer
  - Gracefully handles if user ignores warning
- [ ] Logout flow
  - Clears Supabase Auth session
  - Redirects to login page
  - Preserves login form state (optional email/domain)
  - No error messages if user manually navigates while timed out
- [ ] Organization configuration
  - Admin can set idle timeout duration (15-120 minutes)
  - Admin can set absolute session duration (1-24 hours)
  - Settings stored in organization table in Supabase
  - Defaults applied if org settings not configured
- [ ] In-progress work handling
  - Warning dialog shows work will be lost
  - Option to extend session (if work still in progress)
  - Consider auto-saving form drafts for less critical pages

## Technical Considerations

### Session Tracking with Supabase Auth
- Supabase Auth provides `session` object with created_at and expires_at
- Use `onAuthStateChange` to detect session changes
- Implement custom timeout logic in React context or hook (Supabase doesn't have built-in idle timeout)

### Implementation Approach
1. Create `useSessionTimeout` hook to track idle time
2. Add `SessionTimeoutProvider` context wrapper in App.tsx
3. Implement `SessionTimeoutWarning` component for modal dialog
4. Add organization settings schema to Supabase
5. Integrate with existing auth flow

### State Management
- Track last activity timestamp
- Monitor user interactions: clicks, navigation, form changes
- Pause idle timer during blocking operations (sync, uploads)
- Store warned flag to avoid duplicate warnings

### Edge Cases
- Handle browser tab focus/blur (don't timeout if tab inactive)
- Handle network disconnection (reconnect should not reset timeout)
- Handle OAuth token refresh near expiry
- Handle mobile app context (if applicable)

## Dependencies

- Supabase Auth session management (existing)
- Organization table schema (BACKLOG-XXX - or add org_session_settings)
- React context for app-wide timeout state

## Non-Dependencies

- Does NOT require changes to Electron (broker portal is web-only)
- Does NOT require changes to Magic Audit desktop app
- Does NOT require changes to authentication mechanisms

## Related Backlog Items

- BACKLOG-619: Admin Portal - would benefit from time-limited sessions
- BACKLOG-612: Error Logging Service - could log timeout events

## Category Mapping

**Security:** Session management, unauthorized access prevention

## Implementation Notes

- Keep timeout duration configurable at runtime (fetch from org settings)
- Use localStorage or IndexedDB to persist timeout settings locally
- Consider "Do Not Disturb" mode for support/admin operations
- Log session timeouts to error_logs for audit trail

## Questions for Implementation

1. Should absolute session duration be enforced server-side (token expiry) or client-side only?
2. Should we show different messages based on whether timeout was idle vs. absolute?
3. Should extending session also extend the absolute duration or only reset idle timer?
4. Should logout clear other browser tabs' sessions? (Supabase broadcasts auth changes)
5. Should we implement offline-first timeout (continue tracking even if network down)?

## References

- Supabase Auth: `.docs/shared/supabase-auth-patterns.md` (if exists)
- Security best practices: OWASP session management
