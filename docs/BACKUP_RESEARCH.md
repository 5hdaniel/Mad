# Backup Research: idevicebackup2 Domain Filtering

## Executive Summary

**Domain filtering is NOT supported by idevicebackup2** for backup creation. The iOS backup protocol and available tools (idevicebackup2, pymobiledevice3) only support full device backups. Domain-based operations are limited to post-backup file extraction.

## Research Conducted

### 1. idevicebackup2 CLI Options

Source: [idevicebackup2.c source code](https://github.com/libimobiledevice/libimobiledevice/blob/master/tools/idevicebackup2.c)

Available backup options:
- `-u, --udid UDID` - Target specific device by UDID
- `-s, --source UDID` - Use backup data from device specified by UDID
- `-n, --network` - Connect to network device
- `--full` - Force full backup from device
- `--skip-apps` - Do not backup application data (USEFUL FOR SIZE REDUCTION)
- `--password PWD` - Supply password for encrypted backup
- `encryption on|off` - Enable/disable backup encryption

**No domain filtering options exist.** There is no `--domain`, `--include`, `--exclude`, or similar flag.

### 2. iOS Backup Domain Structure

iOS backups are organized by domains:
- `HomeDomain` - Contains Messages (sms.db), Contacts (AddressBook.sqlitedb)
- `CameraRollDomain` - Photos/Videos (largest domain, 50-100+ GB)
- `AppDomain` - Application data (10-30 GB typically)
- `MediaDomain` - Music, podcasts, etc.
- `SystemPreferencesDomain` - System settings

The domain structure is recorded in `Manifest.db` (SQLite database) within the backup.

### 3. Alternative Tool: pymobiledevice3

Source: [pymobiledevice3 GitHub](https://github.com/doronz88/pymobiledevice3)

pymobiledevice3 is a Python implementation of libimobiledevice. It supports:
- `backup2 backup --full DIRECTORY` - Full device backup
- Domain-based file **extraction** from existing backups

**Same limitation:** No selective domain backup creation is supported.

### 4. Why Domain Filtering Doesn't Exist

The iOS backup protocol (MobileBackup2) is designed by Apple to create complete device backups. The protocol:
1. Negotiates with the device about what to backup
2. Device sends a manifest of files to backup
3. Files are transferred in device-determined order

The device controls what gets backed up - the client cannot request specific domains only.

## Recommended Approach

Since domain filtering is not possible, we recommend:

### Option 1: Full Backup with `--skip-apps` (Recommended)

```bash
idevicebackup2 -u <UDID> backup --skip-apps <path>
```

**Estimated reduction:**
- Full backup: 50-150 GB, 30-90 minutes
- With `--skip-apps`: 20-60 GB, 15-45 minutes

**Trade-off:** Still includes CameraRollDomain (photos), which is the largest domain.

### Option 2: Full Backup + Post-Processing

1. Create full backup
2. Extract only HomeDomain files using Manifest.db
3. Delete the rest of the backup

**Problem:** User still waits for full backup before extraction.

### Option 3: Use iTunes/Finder Backup (Out of Scope)

Users could create backups via iTunes/Finder and we parse the existing backup.

**Problem:** Requires manual user action, different workflow.

## Expected Backup Sizes and Times

| Scenario | Backup Size | Time | Notes |
|----------|-------------|------|-------|
| Full backup | 50-150 GB | 30-90 min | Depends on camera roll |
| With --skip-apps | 20-60 GB | 15-45 min | Excludes app data |
| HomeDomain only | ~1-2 GB | 3-5 min | **NOT POSSIBLE** |

## Implementation Decision

Given the research findings, the backup service implements a **post-backup extraction** approach:

### Final Approach: Backup + Extract + Cleanup

1. **Create backup with `--skip-apps`** - Reduces initial backup by ~40%
2. **Parse Manifest.db** - SQLite database listing all files and their domains
3. **Extract HomeDomain files only** - Keep only messages, contacts, etc.
4. **Delete non-HomeDomain files** - Remove CameraRoll, Media, etc.
5. **Final storage: ~1-2 GB** - Down from 20-60 GB

### How Commercial Tools Do It

Research confirmed that **iMazing** and **TouchCopy** use the same approach:
- They create a full backup first (no way around this)
- Then extract/display only the data user needs
- "Data Access Only" mode = full backup + cleanup

From iMazing documentation:
> "iMazing leverages Apple's own backup protocol. It does not control the backup process itself, nor does it decide which files to backup."

From TouchCopy documentation:
> "TouchCopy requires a backup of your device to read from, in order to access certain content like Messages and Contacts"

### Alternative Investigated: Microsoft Phone Link

Phone Link for iPhone was investigated but rejected:
- Only shows messages sent/received WHILE connected via Bluetooth
- **No access to message history**
- No pictures or group messages
- Unreliable syncing

## Files of Interest in HomeDomain

After backup completes, keep these files (identified via Manifest.db):
- `HomeDomain/Library/SMS/sms.db` - Messages database
- `HomeDomain/Library/AddressBook/AddressBook.sqlitedb` - Contacts database
- `HomeDomain/Library/AddressBook/AddressBookImages.sqlitedb` - Contact photos
- `HomeDomain/Library/CallHistoryDB/CallHistory.storedata` - Call history
- `HomeDomain/Library/Voicemail/` - Voicemail files

## API Implementation

The backup service provides:

```typescript
// Start backup (creates full backup with --skip-apps)
await api.backup.start({ udid: 'device-udid' });

// Extract only HomeDomain and delete rest (20-60 GB → 1-2 GB)
await api.backup.extractHomeDomain(backupPath);
```

## Conclusion

**Domain filtering is NOT possible at the protocol level.** All commercial tools (iMazing, TouchCopy) use the same workaround: full backup + post-processing extraction. Our implementation follows this proven approach, reducing final storage from 20-60 GB to ~1-2 GB.

## References

- [libimobiledevice GitHub](https://github.com/libimobiledevice/libimobiledevice)
- [idevicebackup2 man page](https://man.archlinux.org/man/idevicebackup2.1.en)
- [pymobiledevice3 GitHub](https://github.com/doronz88/pymobiledevice3)
- [idevicebackup2 source code](https://github.com/libimobiledevice/libimobiledevice/blob/master/tools/idevicebackup2.c)
