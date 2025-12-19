# BACKLOG-080: Persist Email OAuth Tokens in Database

## Status: Pending
## Priority: High
## Category: service
## Created: 2025-12-18

---

## Summary

Email OAuth tokens (for Gmail/Outlook access) should be persisted in the local database so users don't need to re-authenticate on every app restart. This may already be partially implemented but needs verification and potential fix.

## Problem

After connecting email during onboarding, users may need to re-authorize their mailbox access on subsequent app launches. The OAuth tokens that grant access to the user's email should be stored securely in the local encrypted database.

## Investigation Required

1. Check if email tokens are currently being stored in the database
2. If stored, verify they're being retrieved and used on app startup
3. If not stored, implement secure token storage
4. Handle token refresh logic for expired tokens

## Files to Investigate

- `electron/services/googleAuthService.ts` - Gmail OAuth handling
- `electron/services/microsoftAuthService.ts` - Outlook OAuth handling
- `electron/services/databaseService.ts` - Token storage
- `electron/auth-handlers.ts` - Token management IPC

## Acceptance Criteria

- [ ] Email OAuth tokens are stored in encrypted local database
- [ ] Tokens are retrieved on app startup (no re-auth needed)
- [ ] Token refresh is handled automatically when expired
- [ ] Users only need to re-authenticate if tokens are revoked

## Notes

- May be a bug fix (tokens stored but not retrieved correctly)
- Or a new feature (token storage not implemented)
- Needs investigation to determine scope

---

## Estimation

| Metric | Estimate |
|--------|----------|
| Turns | 10-20 (depends on if fix or feature) |
| Tokens | ~40-80K |
| Time | ~1-2h |
