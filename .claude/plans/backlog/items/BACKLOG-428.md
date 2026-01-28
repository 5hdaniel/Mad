# BACKLOG-428: License Context Provider

## Summary

Create a React Context provider that loads and manages license state from the database, providing license information throughout the application.

## Category

Service / Context

## Priority

P0 - Critical (Required for license-aware UI)

## Description

### Problem

License information needs to be:
- Loaded on app start
- Available throughout the component tree
- Synced between local SQLite and Supabase
- Updated when user joins/leaves organization

### Solution

1. **LicenseContext Provider**:
```tsx
interface LicenseState {
  // Core license info
  licenseType: 'individual' | 'team' | 'enterprise';
  aiDetectionEnabled: boolean;

  // Organization info (if team)
  organizationId: string | null;
  organizationName: string | null;
  userRole: 'agent' | 'broker' | 'admin' | 'it_admin' | null;

  // Loading state
  isLoading: boolean;
  error: Error | null;

  // Actions
  refreshLicense: () => Promise<void>;
  upgradeToTeam: (orgId: string) => Promise<void>;
  enableAIAddon: () => Promise<void>;
}
```

2. **Data Flow**:
```
App Start
    |
    v
Check Local SQLite for license_type
    |
    v
If authenticated, sync with Supabase profiles
    |
    v
Update local cache if needed
    |
    v
Provide via LicenseContext
```

3. **Sync Strategy**:
- Local SQLite is the primary source (offline support)
- On login/refresh, sync with Supabase
- If Supabase has newer data (e.g., admin enabled AI add-on), update local
- Organization membership synced on login

### Integration Points

- **AppStateContext**: LicenseProvider wraps or integrates with app state
- **AuthContext**: License refresh triggered after login
- **Database Service**: New methods for license CRUD
- **Supabase Service**: Profile license fields sync

## Acceptance Criteria

- [ ] LicenseContext provides all license state
- [ ] License loaded on app start from local database
- [ ] License synced with Supabase on authentication
- [ ] Organization membership loaded for team users
- [ ] useLicense hook works in all components
- [ ] License refresh works without app restart
- [ ] Offline mode uses cached license state

## Estimated Effort

~25K tokens

## Dependencies

- BACKLOG-426: License Type Database Schema Support

## Related Items

- BACKLOG-427: License-Aware UI Components
- BACKLOG-429: License Upgrade Flow UI
