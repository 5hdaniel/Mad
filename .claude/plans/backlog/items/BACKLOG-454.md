# BACKLOG-454: Fix Azure AD OAuth Email Configuration

## Summary

Azure AD OAuth login creates users without email addresses, causing duplicate accounts and requiring the "Allow users without email" workaround in Supabase.

## Category

Authentication / Infrastructure

## Priority

P0 - Critical (Blocks proper user identification)

## Description

### Problem

When users log in via Microsoft OAuth:
1. Azure AD is not returning the email claim in the ID token
2. Supabase creates users with `email: null`
3. This creates duplicate user accounts (same person, different auth providers)
4. Workaround "Allow users without email" masks the real problem

### Evidence

```sql
-- Users created without email from Microsoft OAuth
SELECT id, email, created_at FROM auth.users WHERE email IS NULL;
-- Returns: 67614fc0-1be2-474d-8c99-58305472736a (null email)
```

### Root Cause

Azure AD App Registration needs proper configuration:
1. **API Permissions** - Add `email`, `openid`, `profile` to configured permissions (not just granted)
2. **Token Configuration** - Add `email` as optional claim to ID token
3. **Scopes** - Ensure Supabase requests the correct scopes

### Solution

#### Azure Portal Configuration

1. **App Registrations → Your App → API Permissions**
   - Click "Add a permission"
   - Microsoft Graph → Delegated
   - Add: `email`, `openid`, `profile`
   - Click "Grant admin consent"

2. **App Registrations → Your App → Token configuration**
   - Click "Add optional claim"
   - Token type: ID
   - Select: `email`
   - Save

3. **Verify redirect URI** matches Supabase callback:
   ```
   https://nercleijfrxqcvfjskbc.supabase.co/auth/v1/callback
   ```

#### Supabase Configuration

1. **Authentication → Providers → Microsoft**
   - Disable "Allow users without email" after Azure is fixed
   - Verify Client ID and Secret are correct

#### Cleanup

After fixing, merge duplicate users or remove null-email accounts:
```sql
-- Identify null-email users to clean up
SELECT * FROM auth.users WHERE email IS NULL;
```

## Acceptance Criteria

- [ ] Azure AD returns email in ID token
- [ ] New Microsoft OAuth logins have email populated
- [ ] "Allow users without email" can be disabled
- [ ] No duplicate user accounts created
- [ ] Desktop app Microsoft login still works

## Estimated Effort

~2 hours (mostly Azure Portal configuration)

## Dependencies

- Azure Portal admin access
- Supabase dashboard access

## Related Items

- BACKLOG-453: Multi-org broker auth (workaround for this issue)
- TEST-051-006: RLS testing blocked by this
