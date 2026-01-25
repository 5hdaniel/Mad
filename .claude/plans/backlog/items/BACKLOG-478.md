# BACKLOG-478: License Validation Service

**Category**: service
**Priority**: P0
**Sprint**: SPRINT-057
**Estimated Tokens**: ~30K
**Status**: Pending

---

## Summary

Create a service layer for validating user licenses against Supabase.

## Background

The license validation service will be called at app start and during sensitive operations to ensure the user has a valid license.

## Requirements

### Service Interface

```typescript
// electron/services/licenseService.ts
export interface LicenseStatus {
  isValid: boolean;
  licenseType: 'trial' | 'individual' | 'team';
  trialStatus?: 'active' | 'expired' | 'converted';
  trialDaysRemaining?: number;
  transactionCount: number;
  transactionLimit: number;
  canCreateTransaction: boolean;
  deviceCount: number;
  deviceLimit: number;
  aiEnabled: boolean;
  blockReason?: 'expired' | 'limit_reached' | 'no_license';
}

export async function validateLicense(userId: string): Promise<LicenseStatus>;
export async function incrementTransactionCount(userId: string): Promise<void>;
export async function createUserLicense(userId: string): Promise<void>;
```

### Implementation Requirements

1. Fetch `user_licenses` from Supabase
2. Check trial expiry (14 days from start)
3. Check transaction limit (5 for trial)
4. Return comprehensive status object
5. Handle network failures gracefully (offline mode)

### Offline Behavior

- Cache last known license status locally
- Allow 24-hour grace period if cannot reach Supabase
- Block after grace period expires

## Acceptance Criteria

- [ ] `validateLicense()` returns correct status for all license types
- [ ] `incrementTransactionCount()` updates Supabase
- [ ] `createUserLicense()` creates trial license for new users
- [ ] Offline grace period works correctly
- [ ] All edge cases handled (no license, expired, etc.)

## Dependencies

- BACKLOG-477: Schema must exist first

## Related Files

- `electron/services/licenseService.ts`
- `electron/license-handlers.ts`
