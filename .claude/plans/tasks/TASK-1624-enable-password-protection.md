# Task TASK-1624: Enable Leaked Password Protection

**Status: N/A (Not Applicable)**

**Reason:** This task does not apply to Magic Audit because:
1. **OAuth-only authentication**: The app uses Microsoft and Google OAuth providers exclusively - there is no email/password login
2. **No password storage**: Since users authenticate via OAuth, Supabase never stores or validates user passwords
3. **Feature requires Pro plan**: Leaked password protection is a Pro plan feature, but even with Pro, it's irrelevant for OAuth-only apps
4. **Security advisor warning expected**: The `auth_leaked_password_protection` advisory will persist but is acceptable given the OAuth-only auth strategy

**Decision:** Do not implement. The security advisory warning is expected and not actionable.

---

## Original Goal (For Reference)

Enable Supabase Auth's leaked password protection feature to prevent users from using compromised passwords that appear in the HaveIBeenPwned.org database.

## Non-Goals

- Do NOT implement client-side password strength indicators (separate UX task)
- Do NOT modify existing users' passwords (they can still sign in with current passwords)
- Do NOT change minimum password length requirements (unless specifically requested)
- Do NOT implement MFA (separate feature)

## Deliverables

1. **Dashboard Configuration**: Enable leaked password protection via Supabase Dashboard
2. **Documentation**: Update any password-related documentation if it exists
3. **Error Handling**: Verify weak password errors are handled gracefully in the app

## Acceptance Criteria

- [ ] Leaked password protection is enabled in Supabase Dashboard
- [ ] New user signups with compromised passwords are rejected with clear error message
- [ ] Password changes with compromised passwords are rejected with clear error message
- [ ] Existing users can still sign in with their current passwords (backward compatible)
- [ ] Security advisor no longer shows "Leaked Password Protection Disabled" warning

## Implementation Notes

### Why This Matters

- **Security Advisory**: Supabase security linter currently flags this project with:
  ```
  WARN: Leaked Password Protection Disabled
  Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org.
  Enable this feature to enhance security.
  ```

- **Credential Stuffing Protection**: Malicious actors use lists of leaked passwords to automate login attempts

- **Pro Plan Feature**: Leaked password protection is available on Pro Plan and above (this project qualifies)

### How It Works

1. When a user signs up or changes their password, Supabase Auth sends a **hash prefix** (first 5 characters of SHA-1 hash) to HaveIBeenPwned's k-Anonymity API
2. HIBP returns all hash suffixes matching that prefix
3. Supabase compares locally to check if the password is compromised
4. This is **privacy-preserving** - the actual password never leaves Supabase

### Configuration Method

**CRITICAL: This CANNOT be done via SQL migration or API.** It MUST be configured through the Supabase Dashboard.

**Steps:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/_/auth/providers
2. Select your project
3. Navigate to: **Authentication > Providers > Email**
4. Find the **"Reject Leaked Passwords"** setting
5. Toggle it **ON**
6. Click **Save**

**Dashboard Path:** `Authentication > Providers > Email`

**Alternative via Management API (if needed):**
```bash
# PATCH /v1/projects/{ref}/config/auth
# Note: This requires the Management API endpoint to support the auth.hibp_enabled setting
# As of 2026-01, the setting name may vary - verify in API documentation
```

### User Experience Implications

| Scenario | Behavior Before | Behavior After |
|----------|-----------------|----------------|
| **New signup with leaked password** | Accepted | Rejected with `WeakPasswordError` |
| **Existing user sign-in with leaked password** | Works normally | Works normally (no change) |
| **Existing user changes to leaked password** | Accepted | Rejected with `WeakPasswordError` |
| **Password reset with leaked password** | Accepted | Rejected with `WeakPasswordError` |

### Error Handling

When a password is rejected, Supabase Auth returns a `WeakPasswordError` with reasons. The app should display a user-friendly message:

```typescript
// Example error response structure
{
  "code": "weak_password",
  "message": "Password is too weak",
  "reasons": ["password_in_hibp_database"]
}
```

**Recommended user-facing message:**
> "This password has appeared in a data breach and cannot be used. Please choose a different password."

### Current Password Settings (for reference)

Check current settings in Dashboard under Authentication > Providers > Email:
- Minimum password length (recommended: 8+)
- Required characters (options: lowercase, uppercase, digits, symbols)
- Leaked password protection (currently: DISABLED - needs to be enabled)

## Integration Notes

- **No code changes required** for basic enablement
- **Error handling** may need updates in:
  - `src/components/auth/` - signup forms
  - `src/components/settings/` - password change forms (if any)
  - Any place that calls `supabase.auth.signUp()` or `supabase.auth.updateUser({ password: ... })`

## Do / Don't

### Do:
- Enable via Dashboard first (fastest, safest)
- Test with a known compromised password (e.g., "password123")
- Verify error messages are user-friendly
- Check the security advisor after enabling to confirm the warning is gone

### Don't:
- Assume this can be done via SQL migration (it cannot)
- Force existing users to change passwords immediately
- Block existing users from signing in
- Try to set this via environment variables

## When to Stop and Ask

- If the Dashboard option is not available (may indicate plan limitation)
- If existing auth flows break after enabling
- If error messages are not being handled properly in the UI
- If the security advisor still shows the warning after enabling

## Testing Expectations

### Manual Testing:
1. **Before enabling**: Try signing up with "password123" - should succeed
2. **Enable the feature** via Dashboard
3. **After enabling**: Try signing up with "password123" - should fail with clear message
4. **Existing user test**: Sign in with existing credentials - should still work
5. **Security advisor check**: Run `mcp__supabase__get_advisors` - should not show leaked password warning

### Verification Query:
```bash
# Use Supabase MCP tool to verify
mcp__supabase__get_advisors --type security

# Should NOT contain:
# "auth_leaked_password_protection" advisory after enabling
```

## PR Preparation

- **Title:** `feat(auth): enable leaked password protection`
- **Labels:** `security`, `supabase`, `configuration`
- **Depends on:** None (independent task)
- **No PR needed if**: Dashboard-only change with no code modifications

## Estimated Tokens

- **If Dashboard-only**: ~3K (verification and documentation)
- **If error handling needs updates**: ~15K (code changes + testing)

---

## Research Summary

### Documentation References

1. **Supabase Password Security Guide**: https://supabase.com/docs/guides/auth/password-security
2. **HaveIBeenPwned Pwned Passwords API**: https://haveibeenpwned.com/Passwords

### Key Findings

| Question | Answer |
|----------|--------|
| Can this be done via SQL migration? | **NO** - Dashboard only |
| Can this be done via Management API? | **Maybe** - via PATCH `/v1/projects/{ref}/config/auth` |
| Is this a Pro Plan feature? | **YES** - Pro Plan and above |
| Does it affect existing users? | **NO** - They can still sign in with current passwords |
| What error is returned? | `WeakPasswordError` with `reasons: ["password_in_hibp_database"]` |

### Privacy Considerations

- Uses k-Anonymity model - password never sent to HIBP
- Only SHA-1 hash prefix (5 chars) is transmitted
- Comparison happens locally on Supabase servers

---

## Implementation Summary (Engineer-Owned)

**NOTE: This is a Dashboard configuration task. No PR may be required if only Dashboard changes are made.**

*Completed: <DATE>*

### Checklist

```
Dashboard configuration:
- [ ] Enabled "Reject Leaked Passwords" in Auth settings
- [ ] Verified setting is saved

Verification:
- [ ] Tested signup with leaked password - correctly rejected
- [ ] Tested existing user login - still works
- [ ] Security advisor no longer shows warning

Code changes (if needed):
- [ ] Error handling updated for WeakPasswordError
- [ ] User-friendly error messages added
```

### Notes

**Deviations from plan:**
<If you deviated from the plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
