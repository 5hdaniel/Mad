# BACKLOG-742: Session Timeout and Auto-Logout for Broker Portal (SOC 2)

**Priority:** High
**Type:** Feature
**Area:** Security
**Status:** Pending

## Description

The broker portal currently has no session timeout — logged-in users remain authenticated indefinitely. This is a security concern for SOC 2 compliance, especially on shared or public workstations where a user may forget to log out.

SOC 2 requires idle session timeout of 15 minutes or less for systems handling sensitive data. Financial audit data qualifies as sensitive.

## Requirements

### Idle Timeout
- Configurable timeout duration (default: **15 minutes** per SOC 2 guidance)
- Warning modal shown **2 minutes** before expiry ("Your session will expire in X seconds")
- Activity resets the timer (mouse move, click, keypress, scroll, navigation)
- Timeout duration configurable via `SESSION_TIMEOUT_MINUTES` environment variable
- Works across all portal pages (global provider/hook)

### Server-Side Token Invalidation (Critical for SOC 2)
- On timeout: call `supabase.auth.signOut({ scope: 'global' })` to revoke ALL refresh tokens server-side
- Do NOT just clear client-side storage — the token must be dead on the server
- On manual logout: same server-side invalidation
- **Why**: JWTs are stateless — a copied access token remains valid until expiry (~1 hour) even after client-side "logout". Server-side revocation kills the refresh token so the session can't be renewed.
- **Mitigation for the JWT gap**: Reduce Supabase access token lifetime from 3600s to 900s (15 min) so a stolen token has a shorter window. Configured in Supabase dashboard under Auth > Token Expiry.

### Session Event Logging
- Log to audit trail: login, logout (manual), logout (timeout), session refresh, failed refresh
- Include: user ID, timestamp, IP (if available), event type
- Stored in `audit_logs` table for SOC 2 evidence

### Additional Controls
- Concurrent session limit: consider warning if user is logged in from multiple browsers
- On browser tab close: no immediate logout (user may reopen), but token will expire per normal cycle
- "Remember me" option: NOT recommended for SOC 2 — all sessions should timeout

## Acceptance Criteria

- [ ] User is auto-logged out after 15 minutes of inactivity
- [ ] Warning modal appears 2 minutes before logout with countdown
- [ ] Any user interaction dismisses warning and resets timer
- [ ] Timeout calls `supabase.auth.signOut({ scope: 'global' })` (server-side revocation)
- [ ] Manual logout also calls server-side signOut
- [ ] Expired session redirects to login with "Session expired" message
- [ ] Session timeout configurable via environment variable
- [ ] Session events (login, logout, timeout) logged to audit_logs
- [ ] Access token lifetime reduced to 15 minutes in Supabase config

## References

- [SOC 2 Software Timeout Requirements](https://compyl.com/blog/soc-2-software-timeout-requirements/)
- [SOC 2 Session Management Guide](https://hoop.dev/blog/mastering-session-management-for-soc-2-compliance-a-simple-guide-for-tech-managers/)
- [Supabase Auth signOut docs](https://supabase.com/docs/reference/javascript/auth-signout)
