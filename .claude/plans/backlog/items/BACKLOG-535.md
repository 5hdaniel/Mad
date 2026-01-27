# BACKLOG-535: Encrypt Session File with safeStorage

**Created**: 2026-01-27
**Priority**: P2 - Medium Security
**Category**: Security
**Status**: Pending

---

## Problem Statement

The `session.json` file contains user session data and authentication tokens stored in plain JSON format.

## Security Risk

**Severity**: Medium

- Session tokens can be extracted by malware or unauthorized users
- If device is compromised, attacker can impersonate user
- Violates principle of defense in depth
- Inconsistent with DB encryption approach (we encrypt the database key with safeStorage)

## Current State

```
userData/
  session.json  <- Plain JSON with session tokens
  database.key  <- Encrypted with safeStorage (correct approach)
  *.db         <- Encrypted with key from database.key
```

## Solution

Use Electron's `safeStorage` API to encrypt session data, matching our approach for the database encryption key.

### Implementation

```typescript
import { safeStorage } from 'electron';

// Writing session
const sessionData = JSON.stringify(session);
const encrypted = safeStorage.encryptString(sessionData);
fs.writeFileSync(sessionPath, encrypted);

// Reading session
const encrypted = fs.readFileSync(sessionPath);
const decrypted = safeStorage.decryptString(encrypted);
const session = JSON.parse(decrypted);
```

### Migration Path

1. Check if session.json exists and is unencrypted
2. Read existing session
3. Re-encrypt with safeStorage
4. Write encrypted version
5. Future reads use safeStorage.decryptString

## Platform Considerations

`safeStorage` uses:
- **macOS**: Keychain
- **Windows**: DPAPI
- **Linux**: Secret Service API (or libsecret)

All platforms are supported.

## Acceptance Criteria

- [ ] Session data encrypted with safeStorage
- [ ] Migration handles existing plain JSON sessions
- [ ] App functions correctly after migration
- [ ] safeStorage availability checked before use
- [ ] Fallback for systems without secret storage (warn user)

## Estimated Effort

~20K tokens (implementation + migration + testing on all platforms)

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/sessionService.ts` | Add encryption/decryption |
| `electron/main.ts` | Ensure safeStorage available |

## References

- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- Current implementation: `electron/services/encryptionService.ts` (for database key)
