# BACKLOG-648: DMG vs Dev Mode Keychain Conflict Breaks Database Init

**Status:** Completed
**Priority:** High
**Category:** Bug
**Created:** 2026-02-10
**Completed:** 2026-02-10

## Problem

After testing the packaged DMG app and then switching back to dev mode (`npm run dev`), the app gets stuck on "Starting Magic Audit..." with the error:

```
Encryption not available. Database encryption requires OS-level encryption support.
```

Once the Keychain entry is resolved, a secondary error occurs:

```
file is not a database
```

## Root Cause

Electron's `safeStorage` API stores encryption keys in the macOS Keychain. Keychain entries are **tied to the code-signing identity** of the app that created them.

1. The **DMG (packaged) app** creates a Keychain entry `"magic-audit Safe Storage"` signed with the production certificate
2. The **dev mode Electron** binary has a different (ad-hoc) signature
3. When dev mode tries to access the same Keychain entry, macOS denies access because the signing identity doesn't match
4. `safeStorage.isEncryptionAvailable()` returns `false` (or decryption silently fails)
5. The `db-key-store.json` file still exists (so `hasKeyStore()` returns `true`), but the key inside it can't be decrypted
6. Even after resolving the Keychain issue, the `mad.db` file was encrypted with the DMG's key and can't be opened with a new key → "file is not a database"

## Diagnosis Steps

```bash
# Check for conflicting Keychain entries
security find-generic-password -l "magic-audit Safe Storage"
security find-generic-password -l "Electron Safe Storage"

# Test safeStorage in isolation (will return true even when app fails)
# This is because the test creates its own Keychain entry, not reusing the DMG's
npx electron /tmp/test-safe-storage.js
```

## Fix (Manual Recovery)

```bash
# 1. Delete the DMG-created Keychain entry
security delete-generic-password -l "magic-audit Safe Storage"

# 2. Delete the stale keystore (encrypted with DMG's key, can't be decrypted)
rm ~/Library/Application\ Support/magic-audit/db-key-store.json

# 3. Delete the old database (encrypted with DMG's key)
rm ~/Library/Application\ Support/magic-audit/mad.db

# 4. Restart the app - it will create fresh key + database
npm run dev
```

**Note:** This resets all local data. Cloud data (Supabase) is preserved and will re-sync on login.

## Prevention

- **Do not switch between DMG and dev mode** on the same machine without clearing the Keychain entry first
- If testing DMG builds, use a separate macOS user account or clear Keychain entries before returning to dev mode
- The `message-attachments/` folder can also be deleted to fully clean up: `rm -rf ~/Library/Application\ Support/magic-audit/message-attachments/`

## Future Improvement (Deferred)

Consider adding detection logic in `databaseEncryptionService.ts`:
- If `hasKeyStore()` returns `true` but `isEncryptionAvailable()` returns `false`, show a specific error message explaining the DMG/dev conflict instead of the generic "Encryption not available" message
- Could also detect when decryption fails and offer an automatic reset option
