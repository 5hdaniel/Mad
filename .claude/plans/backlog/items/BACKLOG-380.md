# BACKLOG-380: hasEmailConnected Returns False Despite Working Email Sync

**Created**: 2026-01-21
**Priority**: High
**Category**: Bug Fix
**Status**: Pending

---

## Description

The `hasEmailConnected` state returns `false` even when email sync is actually working. This causes the "Continue Setup" prompt to appear unnecessarily on the Dashboard and creates confusion about the app's state.

## Current Behavior

1. User has connected their email account
2. Email sync runs successfully (new emails are detected/imported)
3. `hasEmailConnected` returns `false`
4. Dashboard shows "Continue Setup" prompt incorrectly
5. Settings may show "Connected" status (inconsistent)

## Expected Behavior

1. User has connected their email account
2. Email sync works
3. `hasEmailConnected` returns `true`
4. Dashboard shows normal state (no setup prompt)
5. Settings shows "Connected" status (consistent)

## Investigation Areas

1. **State derivation**: Where is `hasEmailConnected` derived from?
2. **Database flag**: Check `email_onboarding_completed` in user settings
3. **Token check**: Is there a valid OAuth token that's not being detected?
4. **State machine**: Is the connected state being properly set in machine context?

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/appCore/state/machine/selectors/userDataSelectors.ts` | May contain hasEmailConnected derivation |
| `electron/handlers/sessionHandlers.ts` | `handleCheckEmailOnboarding` |
| `electron/services/connectionStatusService.ts` | Connection status logic |
| State machine context | Where email connection state is stored |

## Acceptance Criteria

- [ ] `hasEmailConnected` returns `true` when email sync is working
- [ ] Dashboard does not show "Continue Setup" when email is connected
- [ ] State is consistent across Dashboard and Settings
- [ ] No false positives (don't show connected if not actually connected)

## Related

- BACKLOG-211: Email Onboarding State Mismatch (very similar, may be duplicate)
- BACKLOG-379: Continue Setup Button No-Op

## Notes

This may be the same root cause as BACKLOG-211. If so, fixing BACKLOG-211 should resolve this. Recommend investigating together.
