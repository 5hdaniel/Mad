# TASK-2154: Native macOS iPhone Sync (Replace libimobiledevice)

**Backlog:** BACKLOG-928
**Sprint:** SPRINT-125
**Type:** Feature
**Priority:** High
**Status:** Pending
**Estimated Tokens:** ~35K
**Branch:** `feature/task-2154-macos-native-iphone-sync`
**PR Target:** `develop`

---

## Problem

macOS users trying iPhone sync hit a dead end — the app requires `libimobiledevice` CLI tools (`idevice_id`, `ideviceinfo`, `idevicebackup2`) which must be installed via `brew install libimobiledevice`. The app silently fails with no guidance. SR Engineer research confirmed macOS has built-in native APIs for all of this via the `usbmuxd` daemon.

## Solution

Replace libimobiledevice dependency on macOS with native APIs:

### Phase 1: Native Device Detection

Create `electron/services/macNativeDeviceService.ts` that communicates directly with Apple's `usbmuxd` daemon via Unix socket.

**Device listing** (replaces `idevice_id -l`):
```typescript
// Connect to /var/run/usbmuxd Unix socket
// Send ListDevices plist message
// Parse response to get UDIDs
```

**Device info** (replaces `ideviceinfo`):
```typescript
// Connect to device via usbmuxd (port 62078 = lockdownd)
// Send GetValue request
// Parse response for DeviceName, ProductType, ProductVersion, SerialNumber
```

**Key facts:**
- `/var/run/usbmuxd` socket is always available on macOS (world-readable)
- Protocol is plist-based — use `plist` npm package or hand-roll XML plist
- SR Engineer POC confirmed this works from Node.js `net` module
- Zero external dependencies needed

### Phase 2: Finder Backup Integration

Instead of running `idevicebackup2` to create backups, leverage Finder's built-in backup:

**Backup path:** `~/Library/Application Support/MobileSync/Backup/<UDID>/`

**Flow:**
1. Check if Finder backup exists for connected device UDID
2. If yes → use existing extraction pipeline (already parses this format)
3. If no → show guidance: "Back up your iPhone in Finder, then come back"
4. Add "Check Again" / "Refresh" button

**Why this works:**
- Finder backups use identical format to libimobiledevice backups
- Same `Manifest.db`, `sms.db`, `AddressBook.sqlitedb` structure
- Our extraction code (`macOSMessagesImportService`, `backupService`) already handles this

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/macNativeDeviceService.ts` | **NEW** — usbmuxd socket client |
| `electron/services/deviceDetectionService.ts` | On macOS, use `macNativeDeviceService` instead of spawning `idevice_id` |
| `electron/services/backupService.ts` | On macOS, check Finder backup path instead of spawning `idevicebackup2` |
| `electron/services/libimobiledeviceService.ts` | Guard `canUseLibimobiledevice()` to return false on macOS (Windows-only) |
| `src/components/iphone/ConnectionStatus.tsx` | Add macOS guidance: "Back up in Finder first" when no backup found |
| `src/components/iphone/IPhoneSyncFlow.tsx` | Handle macOS backup-not-found state |
| `electron/device-handlers.ts` | May need updates for new detection service |

## usbmuxd Protocol Reference

```
1. Connect to Unix socket /var/run/usbmuxd
2. Send header (16 bytes): version(1), message_type, tag, payload_length
3. Send plist payload (XML)
4. Read response header + plist payload

ListDevices request:
  <plist><dict>
    <key>MessageType</key><string>ListDevices</string>
    <key>ClientVersionString</key><string>keepr</string>
    <key>ProgName</key><string>keepr</string>
  </dict></plist>

Connect request (to reach lockdownd):
  <plist><dict>
    <key>MessageType</key><string>Connect</string>
    <key>DeviceID</key><integer>{device_id}</integer>
    <key>PortNumber</key><integer>32498</integer>  <!-- 62078 in network byte order -->
  </dict></plist>
```

## Acceptance Criteria

- [ ] macOS: Connected iPhone detected without libimobiledevice installed
- [ ] macOS: Device name, iOS version, product type displayed correctly
- [ ] macOS: Existing Finder backup detected and parsed
- [ ] macOS: "Back up in Finder" guidance shown when no backup exists
- [ ] macOS: "Check Again" button works after user creates Finder backup
- [ ] Windows: No regression — still uses libimobiledevice (bundled)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] All existing tests pass (`npm test`)
- [ ] No lint errors (`npm run lint`)

## Testing Notes

- Test with iPhone connected via USB (no libimobiledevice installed)
- Create a Finder backup first: Finder > iPhone sidebar > "Back Up Now"
- Backup location: `~/Library/Application Support/MobileSync/Backup/`
- Existing backup on this machine: UDID `00008110-000964C42144801E`

---

## Agent Tracking

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 0. SR Research | SR Engineer | add32caf39bae20ec | ~71K | Complete |
| 1. Implement | Engineer Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |

## Actual Effort

_To be filled after completion._
