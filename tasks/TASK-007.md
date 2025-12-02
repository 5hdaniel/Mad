# TASK-007: Encrypted Backup Handler

## Task Info
- **Task ID:** TASK-007
- **Phase:** 2 - Core Services
- **Dependencies:** TASK-006 (Backup Service)
- **Can Start:** After TASK-006 is complete
- **Estimated Effort:** 4-5 days

## Goal

Add support for encrypted iPhone backups, including password prompt UI integration and backup decryption.

## Background

Users may have "Encrypt iPhone backup" enabled in iTunes/Finder. When this is enabled, all backups (including ours) will be encrypted. We need to:
1. Detect when a device requires encrypted backup
2. Prompt user for their backup password
3. Decrypt the backup files before parsing

## Deliverables

1. Encrypted backup detection
2. Password prompt integration
3. Backup decryption logic
4. Updated backup service to handle encryption

## Technical Requirements

### 1. Create Encryption Types

Add to `electron/types/backup.ts`:

```typescript
export interface BackupEncryptionInfo {
  isEncrypted: boolean;
  needsPassword: boolean;
}

export interface DecryptionResult {
  success: boolean;
  error: string | null;
  decryptedPath: string | null;
}
```

### 2. Detect Encrypted Backup Requirement

Check device settings using `ideviceinfo`:

```typescript
async function checkEncryptionStatus(udid: string): Promise<BackupEncryptionInfo> {
  // Run: ideviceinfo -u <udid> -k WillEncrypt
  // Returns: "true" or "false"

  const ideviceinfo = getExecutablePath('ideviceinfo');
  // Execute and parse output
}
```

### 3. Create Decryption Service

Create `electron/services/backupDecryptionService.ts`:

```typescript
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

export class BackupDecryptionService {

  /**
   * Decrypt an iOS backup using the provided password
   */
  async decryptBackup(
    backupPath: string,
    password: string
  ): Promise<DecryptionResult> {
    try {
      // 1. Read Manifest.plist to get encryption info
      const manifest = await this.readManifest(backupPath);

      // 2. Derive decryption keys using PBKDF2
      const keys = this.deriveKeys(password, manifest);

      // 3. Verify password is correct
      if (!this.verifyPassword(keys, manifest)) {
        return { success: false, error: 'Incorrect password', decryptedPath: null };
      }

      // 4. Decrypt Manifest.db
      const manifestDb = this.decryptManifestDb(backupPath, keys);

      // 5. Decrypt individual files we need (sms.db, AddressBook.sqlitedb)
      const decryptedPath = await this.decryptRequiredFiles(backupPath, keys, manifestDb);

      return { success: true, error: null, decryptedPath };
    } catch (error) {
      log.error('Decryption failed:', error);
      return { success: false, error: error.message, decryptedPath: null };
    }
  }

  private deriveKeys(password: string, manifest: ManifestPlist): EncryptionKeys {
    // iOS uses PBKDF2 with specific parameters
    // See: https://github.com/jsharkey13/iphone_backup_decrypt
  }

  private async decryptRequiredFiles(
    backupPath: string,
    keys: EncryptionKeys,
    manifestDb: ManifestDb
  ): Promise<string> {
    // Only decrypt the files we need:
    // - 3d0d7e5fb2ce288813306e4d4636395e047a3d28 (sms.db)
    // - 31bb7ba8914766d4ba40d6dfb6113c8b614be442 (AddressBook.sqlitedb)

    const outputPath = path.join(backupPath, 'decrypted');
    fs.mkdirSync(outputPath, { recursive: true });

    // Decrypt each file
    for (const fileHash of this.requiredFiles) {
      await this.decryptFile(backupPath, fileHash, keys, manifestDb, outputPath);
    }

    return outputPath;
  }
}
```

### 4. iOS Backup Encryption Details

iOS backups use a multi-layer encryption scheme:

```
Password
    ↓ (PBKDF2)
Key Encryption Key (KEK)
    ↓ (Unwrap)
Class Keys
    ↓ (AES-256)
Per-file Keys
    ↓ (AES-256-CBC)
File Data
```

Key files to understand:
- `Manifest.plist` - Contains keybag with encryption metadata
- `Manifest.db` - Encrypted SQLite database with file list
- Individual files - Encrypted with per-file keys

### 5. Update Backup Service Integration

Modify `BackupService` to handle encryption:

```typescript
async startBackup(options: BackupOptions): Promise<BackupResult> {
  // Check if device requires encryption
  const encryptionInfo = await this.checkEncryptionStatus(options.udid);

  if (encryptionInfo.isEncrypted && !options.password) {
    // Signal UI to prompt for password
    this.emit('password-required', { udid: options.udid });
    return {
      success: false,
      error: 'PASSWORD_REQUIRED',
      // ...
    };
  }

  const result = await this.performBackup(options);

  if (result.success && encryptionInfo.isEncrypted) {
    // Decrypt the backup
    const decryption = await this.decryptionService.decryptBackup(
      result.backupPath,
      options.password
    );

    if (!decryption.success) {
      return { ...result, success: false, error: decryption.error };
    }

    result.backupPath = decryption.decryptedPath;
  }

  return result;
}
```

### 6. IPC Handler Updates

Add password-related handlers:

```typescript
ipcMain.handle('backup:check-encryption', async (_, udid) => {
  return backupService.checkEncryptionStatus(udid);
});

// Renderer can retry with password after prompt
ipcMain.handle('backup:start-with-password', async (_, options) => {
  return backupService.startBackup({ ...options, password: options.password });
});
```

## Files to Create

- `electron/services/backupDecryptionService.ts`
- `electron/services/__tests__/backupDecryptionService.test.ts`

## Files to Modify

- `electron/types/backup.ts` - Add encryption types
- `electron/services/backupService.ts` - Integrate decryption
- `electron/handlers/backupHandlers.ts` - Add encryption handlers
- `electron/preload.ts` - Expose encryption methods

## Reference Implementation

Use this Python library as reference for the decryption logic:
- https://github.com/jsharkey13/iphone_backup_decrypt

## Dos

- ✅ Never store or log the user's password
- ✅ Clear password from memory after use
- ✅ Only decrypt files we actually need (not entire backup)
- ✅ Provide clear error message for wrong password
- ✅ Handle iOS version differences in encryption scheme

## Don'ts

- ❌ Don't cache passwords between sessions
- ❌ Don't log decryption keys or intermediate values
- ❌ Don't attempt brute-force on wrong password
- ❌ Don't leave decrypted files unattended (cleanup after parsing)

## Testing Instructions

1. Create encrypted test backup (manually in iTunes)
2. Test password verification (correct and incorrect)
3. Test decryption of individual files
4. Test integration with backup service
5. Test cleanup of decrypted files

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] No passwords or keys in logs
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added with good coverage
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
