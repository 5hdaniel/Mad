# BACKLOG-454: Azure AD OAuth Email Config

## Summary

Configure Azure AD OAuth for enterprise email connections, enabling organizations using Microsoft 365 with Azure Active Directory to connect their work email accounts.

## Category

Auth / Integration

## Priority

P0 - Critical (Enterprise customer requirement)

## Description

### Problem

Currently, the app supports Microsoft personal accounts (Outlook.com) via consumer OAuth. Enterprise customers using Microsoft 365 with Azure AD cannot connect their work email accounts because:

1. Azure AD requires organization-specific OAuth configuration
2. Admin consent may be required for certain permissions
3. Different endpoints (login.microsoftonline.com vs login.live.com)

### Solution

1. Register app in Azure Portal with multi-tenant support
2. Configure OAuth to use Azure AD endpoints
3. Request appropriate Graph API permissions (Mail.Read, User.Read)
4. Handle admin consent flow gracefully
5. Store and refresh Azure AD tokens

## Acceptance Criteria

- [ ] Azure AD OAuth flow works for enterprise accounts
- [ ] Tokens are stored and refreshed correctly
- [ ] Email sync works with Azure AD authenticated accounts
- [ ] Clear error handling for admin consent requirements
- [ ] Works alongside existing consumer Microsoft OAuth
- [ ] Environment variables documented

## Estimated Effort

~20K tokens

## Dependencies

- Azure Portal access for app registration
- Microsoft 365 / Azure AD test account

## Related Items

- BACKLOG-458: Email Connection Status (token validation)
- BACKLOG-457: Sync Emails from Provider (uses authenticated connection)
