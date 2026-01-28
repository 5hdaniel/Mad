# BACKLOG-532: Enable Leaked Password Protection in Supabase Auth

**Created**: 2026-01-27
**Priority**: P1 - High Security
**Category**: Security
**Status**: Pending

---

## Problem Statement

Supabase Auth's HaveIBeenPwned (HIBP) integration is disabled. This allows users to set passwords that are known to be compromised in data breaches.

## Security Risk

**Severity**: High

- Users can set passwords like "password123" that appear in breach databases
- Credential stuffing attacks are more likely to succeed
- Compromised user accounts can lead to data breaches

## Solution

This is a configuration change in the Supabase Dashboard, not a code change.

### Steps

1. Go to Supabase Dashboard > Authentication > Settings
2. Find "Leaked Password Protection" or "HIBP Integration"
3. Enable the setting
4. Configure rejection behavior (block vs warn)

### Recommended Configuration

- **Mode**: Block (not just warn)
- **Minimum appearances**: 1 (any known breach)

## Acceptance Criteria

- [ ] HIBP integration enabled in Supabase Auth settings
- [ ] Users cannot register with known-breached passwords
- [ ] Users cannot change password to known-breached passwords
- [ ] Appropriate error message shown to users

## Estimated Effort

~2K tokens (dashboard configuration + documentation update)

## Notes

This is a quick win with high security impact. Should be done immediately.

## References

- [Supabase Auth Security Settings](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-policies)
- [Have I Been Pwned](https://haveibeenpwned.com/)
