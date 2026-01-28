# BACKLOG-549: Simplify Database Encryption Key Storage Architecture

## Type
Refactor / Security

## Priority
Medium

## Status
Open

## Description

The current database encryption architecture has an extra layer of complexity that may not be necessary. This backlog item proposes reviewing and potentially simplifying the architecture by storing the database encryption key directly in the OS keychain instead of using an intermediate encrypted file.

## Problem Statement

### Current Architecture (Three-Layer)

```
macOS Keychain / Windows DPAPI / Linux Secret Service
                    |
                    v
        [Wrapping Key via safeStorage]
                    |
                    v
        [db-key-store.json (encrypted)]
        Contains: encryptedKey + metadata
                    |
                    v
        [mad.db (SQLCipher encrypted)]
```

**Current Flow:**
1. Electron's `safeStorage` uses OS keychain to provide a "wrapping key"
2. The wrapping key encrypts the actual DB encryption key
3. The encrypted DB key is stored in `db-key-store.json` alongside metadata
4. At runtime, the key is decrypted and used with SQLCipher

### Current Implementation Files

- `electron/services/databaseEncryptionService.ts` - Manages key generation, storage, retrieval
- `db-key-store.json` (in userData dir) - Stores encrypted key + metadata

### Current Key Store Structure

```typescript
interface KeyStore {
  encryptedKey: string;  // Base64-encoded, safeStorage-encrypted DB key
  metadata: {
    keyId: string;       // UUID
    createdAt: string;   // ISO timestamp
    rotatedAt?: string;  // ISO timestamp (if rotated)
    version: number;     // Currently 1
  };
}
```

## Proposed Simplification

### Direct OS Keychain Storage (Two-Layer)

```
macOS Keychain / Windows DPAPI / Linux Secret Service
        [DB Encryption Key stored directly]
                    |
                    v
        [mad.db (SQLCipher encrypted)]
```

**Simplified Flow:**
1. Store the DB encryption key directly in OS keychain
2. Retrieve key directly from keychain at runtime
3. Use key with SQLCipher

## Benefits of Simplification

| Benefit | Description |
|---------|-------------|
| **Simpler architecture** | Fewer moving parts = fewer failure points |
| **More secure** | No encrypted key file on disk that could be copied |
| **Fewer files** | No `db-key-store.json` to manage/backup/corrupt |
| **Direct OS security** | Full reliance on well-tested OS security |
| **Less code** | Reduced maintenance burden |

## Technical Considerations

### 1. Metadata Storage

The current architecture stores metadata (keyId, createdAt, version). Options:

| Option | Pros | Cons |
|--------|------|------|
| Store metadata as separate keychain entries | Keeps simplicity, uses OS storage | Multiple keychain lookups |
| Store metadata in app preferences | Simple, doesn't need keychain access | Separate from key lifecycle |
| Encode metadata in key entry name | Single lookup | Limited metadata capacity |
| Drop metadata | Simplest | Lose audit trail |

**Recommendation:** If metadata is needed, store it in app preferences (electron-store or similar). Key rotation tracking can be handled separately.

### 2. Key Rotation

Current `rotateKey()` method returns both old and new keys for migration. With direct keychain storage:

| Approach | Implementation |
|----------|---------------|
| **Named entries** | Store keys as `magic-audit-db-key-v1`, `magic-audit-db-key-v2` |
| **Single entry** | One key entry, rotation handled via re-keying database |
| **Backup entry** | Main key + backup/previous key entry |

### 3. Cross-Platform Consistency

| Platform | Current | Proposed |
|----------|---------|----------|
| **macOS** | safeStorage -> Keychain | Direct Keychain via safeStorage |
| **Windows** | safeStorage -> DPAPI | Direct DPAPI via safeStorage |
| **Linux** | safeStorage -> Secret Service | Direct Secret Service via safeStorage |

Electron's `safeStorage` already abstracts cross-platform differences. The simplification maintains this abstraction.

### 4. Migration Path

Existing users have `db-key-store.json`. Migration strategy:

```
1. Check if db-key-store.json exists (returning user)
2. If yes:
   a. Read and decrypt key using current method
   b. Store key directly in keychain (new location)
   c. Verify retrieval works
   d. Delete db-key-store.json
3. If no (new user):
   a. Generate key directly in keychain
```

**Rollback safety:** Keep `db-key-store.json` for one release cycle before deletion.

### 5. Electron safeStorage Limitations

Verify that `safeStorage` can:
- Store arbitrary string data (not just encrypt/decrypt)
- Handle 64-character hex strings (256-bit key)
- Support multiple named entries (if metadata needed)

**Note:** `safeStorage` only provides `encryptString`/`decryptString`. For direct keychain storage, may need `keytar` or native APIs. This needs investigation.

## Alternative: Keep File, Simplify Metadata

If direct keychain storage has limitations, consider:

```typescript
// Simplified KeyStore - just the encrypted key, no metadata
interface KeyStore {
  encryptedKey: string;
  version: number;  // For format changes only
}
```

This reduces complexity while maintaining compatibility.

## Acceptance Criteria

### Investigation Phase
- [ ] Verify Electron safeStorage capabilities for this use case
- [ ] Research keytar or native keychain alternatives if needed
- [ ] Document platform-specific behavior differences
- [ ] Test keychain entry size limits

### Implementation Phase (if simplification viable)
- [ ] Update `databaseEncryptionService.ts` to use direct storage
- [ ] Implement migration path for existing users
- [ ] Add rollback mechanism for first release
- [ ] Update error handling for keychain-specific errors
- [ ] Remove `db-key-store.json` file handling code (after migration period)

### Testing Phase
- [ ] Test on macOS (Keychain)
- [ ] Test on Windows (DPAPI/Credential Manager)
- [ ] Test on Linux (Secret Service)
- [ ] Test migration from old to new format
- [ ] Test fresh install
- [ ] Test key rotation (if supported)
- [ ] Performance comparison (keychain vs file)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Keychain unavailable** | Keep fallback to current file-based approach |
| **Migration data loss** | Phased rollout, keep old file initially |
| **Platform differences** | Thorough cross-platform testing |
| **Performance impact** | Benchmark keychain access vs file read |
| **Keychain prompt fatigue** | Verify no additional prompts vs current |

## Estimated Complexity

**Medium** - Focused change to single service, but requires:
- Cross-platform testing
- Migration logic
- Understanding of keychain APIs

## Estimated Effort

- **Investigation**: ~10K tokens
- **Implementation**: ~25K tokens
- **Migration logic**: ~15K tokens
- **Testing**: ~15K tokens
- **Total**: ~65K tokens

## Related Files

- `electron/services/databaseEncryptionService.ts` - Primary file to modify
- `electron/services/databaseService.ts` - Uses encryption service
- `electron/main.ts` - Initializes encryption service

## Related Documentation

- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [macOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Windows DPAPI](https://docs.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection)
- [keytar npm package](https://www.npmjs.com/package/keytar) (potential alternative)

## Decision Record

**Decision needed:** Should we simplify to direct keychain storage, or keep the current architecture with reduced metadata?

Factors to consider:
1. Does `safeStorage` support our needs, or do we need `keytar`?
2. Is the added complexity of `db-key-store.json` causing real problems?
3. Is the migration risk worth the simplification benefit?

## Created
2026-01-27
