# BACKLOG-498: Disk Space Check Before iPhone Sync

## Type
Enhancement / UX

## Priority
Medium

## Status
Open

## Description

When users initiate iPhone sync (message import), the app should check available disk space before starting the backup process. iPhone backups can be very large (10+ GB for full backups), and if the system doesn't have enough space, the backup will fail partway through, leaving users confused and potentially with corrupted partial data.

## Problem Statement

### Current Behavior
- User clicks "Sync iPhone"
- Backup process starts immediately
- If disk runs out of space mid-backup, process fails
- User gets unclear error message
- Partial backup files may be left behind

### Desired Behavior
- User clicks "Sync iPhone"
- App checks available disk space
- App estimates required space based on iPhone storage
- If insufficient space, shows clear alert with:
  - Required space estimate
  - Currently available space
  - Suggestion to free up space
- Only proceeds if enough space is available

## Implementation Approach

### 1. Get Available Disk Space

```typescript
// Use Node.js fs.statfs or os module
import { statfs } from 'fs/promises';

async function getAvailableDiskSpace(path: string): Promise<number> {
  const stats = await statfs(path);
  return stats.bavail * stats.bsize; // Available bytes
}
```

### 2. Estimate Required Space

Options:
- Query iPhone storage via libimobiledevice
- Use conservative estimate (e.g., 1.5x iPhone used storage)
- Allow user override with "Proceed anyway" option

### 3. Show Alert

```typescript
if (availableSpace < requiredSpace) {
  dialog.showMessageBox({
    type: 'warning',
    title: 'Insufficient Disk Space',
    message: `Not enough disk space for iPhone backup.\n\n` +
      `Required: ~${formatBytes(requiredSpace)}\n` +
      `Available: ${formatBytes(availableSpace)}\n\n` +
      `Please free up disk space and try again.`,
    buttons: ['OK']
  });
  return;
}
```

## Acceptance Criteria

- [ ] App checks disk space before starting iPhone backup
- [ ] App estimates required space (conservative estimate is fine)
- [ ] Clear error message shown if insufficient space
- [ ] Message includes required vs available space
- [ ] Backup does not start if insufficient space
- [ ] Works on both macOS and Windows

## Edge Cases

- External drive as backup location (check correct volume)
- Very large iPhones (256GB+)
- Multiple users on same machine
- Network drives (may not report space accurately)

## Estimated Effort

Low-Medium (~20K tokens)
- Disk space check: ~5K
- Space estimation logic: ~5K
- UI alert integration: ~5K
- Testing: ~5K

## Related Files

- `electron/services/iphoneSyncService.ts` - Main sync logic
- `electron/handlers/iphone-handlers.ts` - IPC handlers
- `src/components/Settings.tsx` - Sync UI (if triggered from there)

## Created
2026-01-25
