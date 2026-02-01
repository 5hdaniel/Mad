# TASK-1175: Azure AD OAuth Email Config

**Sprint**: SPRINT-052
**Backlog Item**: BACKLOG-454
**Status**: Pending
**Estimated Tokens**: ~20K

---

## Summary

Configure Azure AD OAuth for enterprise email connections, enabling organizations using Microsoft 365 with Azure Active Directory to connect their email accounts for transaction communication sync.

---

## Branch Information

**Branch From**: develop
**Branch Into**: develop
**Branch Name**: feature/task-1175-azure-ad-oauth

---

## Problem Statement

Currently, the app supports Microsoft personal accounts (Outlook.com) via consumer OAuth. Enterprise customers using Microsoft 365 with Azure AD cannot connect their work email accounts because:

1. Azure AD requires organization-specific OAuth configuration
2. Admin consent may be required for certain permissions
3. Different endpoints (login.microsoftonline.com vs login.live.com)

---

## Requirements

### Functional Requirements

1. **Support Azure AD authentication**
   - Use Azure AD OAuth 2.0 endpoints
   - Handle both single-tenant and multi-tenant configurations
   - Support admin consent flow if required

2. **Configure required permissions**
   - `Mail.Read` - Read user's mail
   - `Mail.ReadBasic` - Basic mail read (may be sufficient)
   - `User.Read` - Read user profile

3. **Handle enterprise-specific flows**
   - Tenant-specific authorization URLs
   - Admin consent prompts
   - Token refresh for long-lived access

### Non-Functional Requirements

- Seamless UX alongside existing Microsoft consumer OAuth
- Clear error messages for admin consent requirements
- Documentation for enterprise setup

---

## Technical Approach

### 1. Azure AD App Registration

Register the app in Azure Portal:

```
Application (client) ID: <generate>
Directory (tenant) ID: <customer-specific or 'common'>
Redirect URI: http://localhost:PORT/callback (or app:// for Electron)

API Permissions:
- Microsoft Graph > Mail.Read (Delegated)
- Microsoft Graph > Mail.ReadBasic (Delegated)
- Microsoft Graph > User.Read (Delegated)
```

### 2. OAuth Configuration

```typescript
// Azure AD OAuth config (enterprise)
const azureAdConfig = {
  clientId: process.env.AZURE_AD_CLIENT_ID,
  authority: 'https://login.microsoftonline.com/common', // multi-tenant
  // OR 'https://login.microsoftonline.com/{tenant-id}' for single-tenant
  scopes: ['openid', 'profile', 'email', 'Mail.Read', 'User.Read'],
  redirectUri: 'http://localhost:PORT/callback',
};
```

### 3. Authentication Flow

```typescript
// Detect if user needs Azure AD vs consumer OAuth
async function authenticateMicrosoft(email: string): Promise<AuthResult> {
  // Check if enterprise domain (could be configurable or auto-detected)
  const isEnterprise = await detectEnterpriseDomain(email);

  if (isEnterprise) {
    return authenticateAzureAD();
  } else {
    return authenticateConsumerMicrosoft();
  }
}

async function authenticateAzureAD(): Promise<AuthResult> {
  const authUrl = buildAzureAdAuthUrl();
  // Open in browser/webview
  // Handle callback
  // Exchange code for tokens
}
```

### 4. Token Management

```typescript
// Store Azure AD tokens separately or with provider indicator
interface TokenRecord {
  provider: 'google' | 'microsoft_consumer' | 'microsoft_azure_ad';
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId?: string; // For Azure AD
}
```

### 5. Environment Variables

```env
# Azure AD (Enterprise)
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=common  # or specific tenant
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/microsoftAuthService.ts` | Add Azure AD authentication |
| `electron/services/outlookHandlers.ts` | Handle Azure AD tokens for Graph API |
| `.env.example` | Add Azure AD env vars |
| `src/components/Settings.tsx` | May need enterprise connect option |
| `electron/env.d.ts` | Add type definitions for new env vars |

### New Files (Possibly)

| File | Purpose |
|------|---------|
| `electron/services/azureAuthService.ts` | Dedicated Azure AD auth (if separating concerns) |

---

## Acceptance Criteria

- [ ] Azure AD OAuth flow works for enterprise accounts
- [ ] Tokens are stored and refreshed correctly
- [ ] Email sync works with Azure AD authenticated accounts
- [ ] Clear error handling for admin consent requirements
- [ ] Works alongside existing consumer Microsoft OAuth
- [ ] Environment variables documented
- [ ] Unit tests for Azure AD token handling

---

## Testing Requirements

### Unit Tests
- Azure AD auth URL building
- Token exchange flow
- Token refresh logic
- Enterprise domain detection (if implemented)

### Manual Testing (Requires Azure AD Setup)
1. Register app in Azure Portal
2. Configure env variables
3. Connect enterprise email account
4. Verify token obtained
5. Verify email sync works
6. Test token refresh

---

## Dependencies

- Azure Portal access for app registration
- Microsoft 365 / Azure AD test account

---

## Blocked By

- None (can be developed independently)

---

## Blocks

- None

---

## Azure Portal Setup Guide

### Step 1: Register Application

1. Go to Azure Portal > Azure Active Directory > App registrations
2. Click "New registration"
3. Name: "Magic Audit"
4. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
5. Redirect URI: Web > http://localhost:PORT/callback
6. Register

### Step 2: Configure Permissions

1. Go to API permissions
2. Add permission > Microsoft Graph > Delegated
3. Select: Mail.Read, Mail.ReadBasic, User.Read
4. Grant admin consent (if you have admin rights)

### Step 3: Generate Client Secret

1. Go to Certificates & secrets
2. New client secret
3. Copy secret value immediately (shown only once)

### Step 4: Note IDs

- Application (client) ID
- Directory (tenant) ID (or use "common" for multi-tenant)

---

## Implementation Summary

*To be filled by engineer after implementation*

### Changes Made
-

### Azure Configuration
-

### Tests Added
-

### Manual Testing Done
-

### PR
-
