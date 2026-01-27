# BACKLOG-519: Improve Device Fingerprinting with Composite Hash

**Category**: security
**Priority**: P1 (High)
**Sprint**: -
**Estimated Tokens**: ~25K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Improve device identification by using a composite hash of multiple machine attributes rather than relying solely on `node-machine-id`.

## Background

Current device ID uses `machineIdSync()` which can be:
- Reset on OS reinstall
- Potentially spoofed
- Different between admin/non-admin users on Windows

A composite fingerprint combining multiple attributes is more robust.

## Requirements

### Composite Fingerprint

Combine multiple attributes:
```typescript
import { createHash } from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { cpus, hostname, totalmem, platform, arch } from 'os';

function getDeviceFingerprint(): string {
  const components = [
    machineIdSync(true),           // Primary ID
    hostname(),                     // Machine name
    platform(),                     // OS platform
    arch(),                         // CPU architecture
    cpus()[0]?.model || '',        // CPU model
    totalmem().toString(),         // Total RAM
  ];

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex');

  return hash.substring(0, 32);  // Truncate for readability
}
```

### Migration Path

1. Store both old device_id and new fingerprint
2. Match on either during transition period
3. Deprecate old device_id after 90 days

### Database Changes

```sql
ALTER TABLE devices
ADD COLUMN device_fingerprint TEXT;

CREATE INDEX idx_devices_fingerprint ON devices(device_fingerprint);
```

## Acceptance Criteria

- [ ] Composite fingerprint implemented
- [ ] Migration stores both old and new IDs
- [ ] Device matching works with either ID
- [ ] Unit tests verify fingerprint stability
- [ ] Documentation for fingerprint components

## Dependencies

- BACKLOG-478 (License Validation Service) - IN PROGRESS

## Related Files

- `electron/services/deviceService.ts`
- Supabase migration for new column
