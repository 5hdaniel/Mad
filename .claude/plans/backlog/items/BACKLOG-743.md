# BACKLOG-743: Session Timeout with Idle Lock for Desktop App (SOC 2)

**Priority:** High
**Type:** Feature
**Area:** Security
**Status:** Pending

## Description

The desktop app (Electron) currently keeps users logged in indefinitely with no idle timeout. The Supabase session tokens in `session.json` are stored in plaintext (BACKLOG-722 covers encryption) and never expire from inactivity. SOC 2 requires idle session timeout of 15 minutes or less for systems handling sensitive financial data.

Unlike the broker portal (BACKLOG-742), the desktop app should use a **lock screen** pattern rather than full logout — users shouldn't have to re-enter credentials from scratch every 15 minutes on their own machine. This follows the 1Password/banking app model.

## Requirements

### Idle Lock Screen
- After **15 minutes** of inactivity, show a lock screen overlay (not a full logout)
- Lock screen requires re-authentication to continue (password or system biometric via Electron's `systemPreferences.promptTouchID()` on macOS)
- All app content hidden behind the lock screen (no data visible underneath)
- Lock on system events: screen lock, lid close, sleep/hibernate
- Configurable timeout via app settings (default: 15 min, min: 5 min, max: 60 min)

### Server-Side Token Invalidation on Full Logout
- Manual "Sign Out" must call `supabase.auth.signOut({ scope: 'global' })` to revoke server-side
- Delete `session.json` from disk after server-side revocation
- Do NOT just delete the local file — the refresh token must be killed on the server first
- **Why**: If `session.json` was copied (malware, backup, shared disk), the token must be dead server-side so it can't be used elsewhere

### Extended Idle → Full Logout
- After **4 hours** of continuous lock (no unlock), perform full logout:
  - Call `supabase.auth.signOut({ scope: 'global' })`
  - Delete `session.json`
  - Return to login screen on next app focus
- This handles the case where a user closes their laptop Friday and opens it Monday

### Session Event Logging
- Log via IPC to main process logService: lock, unlock, manual logout, timeout logout, failed unlock attempt
- Include: user ID, timestamp, event type
- Sync session events to Supabase `audit_logs` when online

### Token Lifecycle
- On app launch: check `session.json` exists → attempt silent refresh via `supabase.auth.refreshSession()`
  - If refresh succeeds → user is logged in (no login screen)
  - If refresh fails (token expired/revoked) → show login screen
- Reduce Supabase access token lifetime from 3600s to 900s (15 min) — same as BACKLOG-742
- Background token refresh should reset the idle timer (counts as "activity" from auth perspective)

## Relationship to Other Items

- **BACKLOG-722**: Encrypt session.json with safeStorage — should be done first or concurrently
- **BACKLOG-742**: Broker portal session timeout — shares the Supabase token lifetime config change
- Both items together provide SOC 2 session management compliance across all surfaces

## Acceptance Criteria

- [ ] App shows lock screen after 15 minutes of inactivity
- [ ] Lock screen hides all app content
- [ ] User can unlock with password or macOS Touch ID
- [ ] System sleep/screen lock triggers app lock
- [ ] After 4 hours locked, full logout with server-side token revocation
- [ ] Manual "Sign Out" calls `signOut({ scope: 'global' })` and deletes session.json
- [ ] App launch with valid session.json does silent refresh (no login screen)
- [ ] App launch with expired/revoked token shows login screen
- [ ] Session events logged locally and synced to audit_logs
- [ ] Idle timeout configurable in app settings (5-60 min range)
- [ ] Access token lifetime reduced to 15 minutes in Supabase config

## References

- [SOC 2 Software Timeout Requirements](https://compyl.com/blog/soc-2-software-timeout-requirements/)
- [Electron systemPreferences.promptTouchID](https://www.electronjs.org/docs/latest/api/system-preferences#systempreferencespromptfaboretouchidason-macos)
- [Supabase Auth signOut docs](https://supabase.com/docs/reference/javascript/auth-signout)
