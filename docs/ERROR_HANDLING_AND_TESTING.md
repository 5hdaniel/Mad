# Error Handling & Testing Guide

## Overview

This document explains the comprehensive error handling system and testing infrastructure added to Magic Audit.

## 🔧 Critical Bug Fix: Contacts Retrieval

### Problem
The SQL query in `getContactsSortedByActivity()` had two issues:
1. **NULL email handling**: Joining on `c.email` without NULL check caused issues when contacts had no email
2. **SQLite compatibility**: `NULLS LAST` syntax isn't supported in older SQLite versions

### Solution
```sql
-- Added NULL check in JOIN condition
LEFT JOIN communications comm ON (
  c.email IS NOT NULL  -- ← Added this
  AND (comm.sender = c.email OR comm.recipients LIKE '%' || c.email || '%')
  AND comm.user_id = c.user_id
)

-- Replaced NULLS LAST with CASE statement
ORDER BY
  CASE WHEN last_communication_at IS NULL THEN 1 ELSE 0 END,  -- ← NULL values last
  last_communication_at DESC,
  c.name ASC
```

**Result**: Contacts without emails no longer break the query, and sorting works on all SQLite versions.

---

## 🛡️ Error Handling System

### 1. Permission Monitoring

**File**: `electron/services/permissionService.js`

Monitors macOS permissions that the app needs:

#### Full Disk Access
```javascript
const result = await window.api.system.checkFullDiskAccess();

if (!result.hasPermission) {
  console.log(result.userMessage);
  // "Full Disk Access permission is required to read iMessages."

  console.log(result.action);
  // "Please grant Full Disk Access in System Settings..."
}
```

#### Contacts Permission
```javascript
const result = await window.api.system.checkContactsPermission();
```

#### Check All Permissions
```javascript
const result = await window.api.system.checkAllPermissions();

console.log(result.allGranted);  // false if any permission missing
console.log(result.errors);      // Array of permission errors
```

**Caching**: Results are cached for 30 seconds to avoid excessive file system checks.

---

### 2. OAuth Connection Monitoring

**File**: `electron/services/connectionStatusService.js`

Monitors Gmail and Outlook OAuth connections:

#### Google Connection
```javascript
const result = await window.api.system.checkGoogleConnection(userId);

if (!result.connected) {
  console.log(result.error.userMessage);
  // "Gmail connection expired"

  console.log(result.error.actionHandler);
  // "reconnect-google"
}
```

#### Microsoft Connection
```javascript
const result = await window.api.system.checkMicrosoftConnection(userId);
```

#### Check All Connections
```javascript
const result = await window.api.system.checkAllConnections(userId);

console.log(result.google.connected);     // true/false
console.log(result.microsoft.connected);  // true/false
console.log(result.allConnected);         // Both connected
console.log(result.anyConnected);         // At least one connected
```

**Auto-Refresh**: Service automatically attempts to refresh expired tokens before reporting errors.

---

### 3. Comprehensive Health Check

**Combined Check**: Checks both permissions AND connections

```javascript
const result = await window.api.system.healthCheck(userId);

console.log(result.healthy);  // true if no issues
console.log(result.issues);   // Array of all problems
console.log(result.summary);  // Summary counts

// Example issue object:
{
  type: 'OAUTH_CONNECTION',
  provider: 'google',
  userMessage: 'Gmail connection expired',
  action: 'Reconnect your Gmail account',
  actionHandler: 'reconnect-google',
  severity: 'warning'
}
```

---

## 🔔 User Notifications

**Component**: `src/components/SystemHealthMonitor.jsx`

### Usage

Add to your main App component:

```jsx
import SystemHealthMonitor from './components/SystemHealthMonitor';

function App() {
  const { user } = useAuth();

  return (
    <div>
      {/* Your app content */}

      {/* Add this */}
      <SystemHealthMonitor userId={user?.id} provider={user?.provider} />
    </div>
  );
}
```

### Features

1. **Automatic Checks**: Runs health check every 2 minutes
2. **Dismissible**: Users can dismiss notifications
3. **Actionable**: Buttons to fix issues
4. **Severity Levels**:
   - **Error** (red): Critical issues like lost permissions
   - **Warning** (yellow): Connection expired, needs reconnect
   - **Info** (blue): Optional suggestions

### Action Handlers

| Handler | Action |
|---------|--------|
| `open-system-settings` | Opens macOS System Settings to Privacy & Security |
| `connect-google` | Redirects to Google OAuth flow |
| `reconnect-google` | Re-authenticates with Google |
| `connect-microsoft` | Redirects to Microsoft OAuth flow |
| `reconnect-microsoft` | Re-authenticates with Outlook |
| `retry` | Re-runs health check |

---

## 🧪 Testing Infrastructure

### Setup

Install dependencies:
```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Writing Tests

Example test file structure:

```javascript
import { filterRolesByTransactionType } from './transactionRoleUtils';

describe('transactionRoleUtils', () => {
  describe('filterRolesByTransactionType', () => {
    it('should filter roles for purchase transaction', () => {
      const roles = [/* ... */];
      const result = filterRolesByTransactionType(roles, 'purchase', 'Client & Agents');

      expect(result.length).toBe(3);
      expect(result.map(r => r.role)).toContain('seller_agent');
    });
  });
});
```

### Test Coverage

Current coverage requirements (can be adjusted in `jest.config.js`):
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

---

## 🚀 CI/CD Pipeline

**File**: `.github/workflows/ci.yml`

### Triggered On

- **Push** to `main`, `dev`, or any `claude/**` branch
- **Pull requests** to `main` or `dev`

### Jobs

#### 1. Test & Lint
- Runs on: Ubuntu & macOS
- Node versions: 18.x, 20.x
- Steps:
  1. Checkout code
  2. Install dependencies
  3. Run ESLint
  4. Run Jest tests
  5. Upload coverage to Codecov

#### 2. Build
- Runs on: Ubuntu, macOS, Windows
- Steps:
  1. Build Vite app
  2. Upload dist artifacts

#### 3. Security Audit
- Runs npm audit
- Checks for outdated dependencies

#### 4. Package (main branch only)
- Builds macOS .dmg and .zip
- Code signs with Apple Developer certificate
- Uploads packages as artifacts

### Status Badges

Add to your README.md:

```markdown
![CI/CD](https://github.com/5hdaniel/Mad/workflows/CI%2FCD/badge.svg)
```

---

## 📋 Checklist for Users

### When Permission Issues Occur

1. **Full Disk Access Lost**:
   - Notification appears with error icon
   - Click "Open System Settings"
   - Navigate to Privacy & Security > Full Disk Access
   - Toggle MagicAudit off and back on
   - Restart the app

2. **Contacts Permission Lost**:
   - Usually fixed by Full Disk Access
   - Same steps as above

### When OAuth Connections Expire

1. **Gmail Expired**:
   - Yellow notification appears
   - Click "Reconnect your Gmail account"
   - Complete Google OAuth flow
   - Connection restored automatically

2. **Outlook Expired**:
   - Similar flow for Microsoft account
   - Click "Reconnect your Outlook account"

### Preventing Issues

- Don't revoke permissions manually in System Settings
- Keep the app updated (auto-updates handle token refresh improvements)
- If you see warnings, act on them before they become errors

---

## 🔍 Debugging

### Enable Detailed Logs

Check console for:

```javascript
// Permission checks
[PermissionService] Checking Full Disk Access...
[PermissionService] Result: {hasPermission: false}

// Connection checks
[ConnectionStatus] Checking Google connection...
[ConnectionStatus] Token expired, attempting refresh...

// Database queries
[DatabaseService] Error getting sorted contacts:
[DatabaseService] SQL: SELECT c.*, MAX(comm.sent_at)...
[DatabaseService] Params: ['%123 Main St%', 'user-id']
```

### Common Issues

**"No contacts appearing"**:
- Check console for SQL errors
- Verify `c.email IS NOT NULL` in query
- Check that `communications` table has data

**"Permission notification keeps appearing"**:
- Full Disk Access may not be properly granted
- Try: Settings > Privacy > Full Disk Access > Remove app > Re-add app
- Restart Mac after granting permission

**"OAuth connection fails immediately"**:
- Token may be corrupted in database
- Clear token: Delete from `oauth_tokens` table
- Re-authenticate completely

---

## 📊 Metrics & Monitoring

### Health Check Response

```javascript
{
  success: true,
  healthy: false,  // Issues detected
  permissions: {
    allGranted: false,
    permissions: {
      fullDiskAccess: { hasPermission: false, error: {...} },
      contacts: { hasPermission: true }
    },
    errors: [...]
  },
  connections: {
    google: { connected: false, error: {...} },
    microsoft: { connected: true, email: 'user@outlook.com' },
    allConnected: false,
    anyConnected: true
  },
  issues: [
    {
      type: 'FULL_DISK_ACCESS_DENIED',
      userMessage: '...',
      action: '...',
      actionHandler: 'open-system-settings',
      severity: 'error'
    }
  ],
  summary: {
    totalIssues: 1,
    criticalIssues: 1,
    warnings: 0
  }
}
```

### Issue Severity Guidelines

- **error**: Blocks core functionality (can't read messages)
- **warning**: Degrades functionality (can't fetch new emails)
- **info**: Optional features unavailable (contacts sync disabled)

---

## 🎯 Future Improvements

1. **Retry Logic**: Auto-retry failed permission checks
2. **Background Sync**: Periodic token refresh before expiry
3. **Notification Preferences**: Let users disable certain warnings
4. **Analytics**: Track permission/connection issue frequency
5. **Offline Mode**: Queue operations when connections are down

---

## 📚 Related Documentation

- [Refactoring Summary](./REFACTORING_SUMMARY.md)
- [Transaction Role Utils Tests](../tests/transactionRoleUtils.test.md)
- [Contact Sorting Tests](../tests/contactSorting.test.md)
- [Database Schema](../electron/database/schema.sql)

---

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the console for detailed error logs
2. Run health check manually: `await window.api.system.healthCheck(userId)`
3. Review GitHub Actions logs for CI/CD failures
4. Open an issue with:
   - Error message
   - Steps to reproduce
   - Console logs
   - Health check result
