# BACKLOG-516: Encrypt Offline License Cache Using Electron safeStorage

**Category**: security
**Priority**: P1 (High)
**Sprint**: -
**Estimated Tokens**: ~15K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Encrypt the offline license cache using Electron's `safeStorage` API to prevent users from tampering with cached license data when offline.

## Background

Current implementation stores license cache as plain JSON:
```typescript
const cache = { status, userId, cachedAt };
fs.writeFileSync(cachePath, JSON.stringify(cache));
```

A technical user could modify this file to extend their trial or bypass limits while offline.

## Requirements

### Implementation

1. Use `safeStorage.encryptString()` to encrypt cache data
2. Use `safeStorage.decryptString()` to read cache data
3. Fall back to no-cache if safeStorage unavailable (Linux without keychain)
4. Handle migration from unencrypted cache

### Code Changes

```typescript
import { safeStorage } from 'electron';

function cacheLicenseStatus(userId: string, status: LicenseValidationResult): void {
  const data = JSON.stringify({ status, userId, cachedAt: Date.now() });

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(data);
    fs.writeFileSync(cachePath, encrypted);
  } else {
    // Log warning - cache will not be persisted
    logService.warn('safeStorage not available, license cache disabled');
  }
}
```

## Acceptance Criteria

- [ ] License cache encrypted using safeStorage
- [ ] Cache readable only on same machine/user
- [ ] Graceful fallback when encryption unavailable
- [ ] Migration from unencrypted cache handled
- [ ] Unit tests mock safeStorage appropriately

## Dependencies

- BACKLOG-478 (License Validation Service) - IN PROGRESS

## Related Files

- `electron/services/licenseService.ts`
