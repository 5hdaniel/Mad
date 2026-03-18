# TASK-2246: Electron Data Layer Stability Fixes

**Backlog IDs:** BACKLOG-1083, 1084, 1085, 1086, 1105
**Sprint:** SPRINT-147
**Branch:** `fix/task-2246-electron-data-layer`
**Estimated Tokens:** 30K-45K

---

## Objective

Fix contact phone E.164 mismatch, thread dedup patterns, appleDriverService path validation, TOCTOU race in backupService, and PDF export sandbox/timing.

---

## Requirements

### Must Do:

1. **BACKLOG-1083: Fix contact phone lookup E.164 mismatch**
   - Some paths store phones in E.164 format (+1234567890), others as raw digits (1234567890)
   - This causes lookup mismatches when matching contacts by phone
   - Find the phone lookup/matching code and normalize to a consistent format
   - Best approach: normalize to E.164 on input, strip formatting for comparison

2. **BACKLOG-1084: Fix thread deduplication mixed linking patterns**
   - Some code links threads by `message_id`, some by `thread_id`, some by subject line matching
   - This causes duplicate threads in the UI
   - Audit the thread linking code and establish a single canonical linking pattern
   - Prefer `thread_id` (from email provider) as primary, `message_id` for fallback

3. **BACKLOG-1085: Fix appleDriverService path validation**
   - File: `electron/services/appleDriverService.ts` (~lines 613, 622, 631)
   - Three fallback methods have inconsistent path validation
   - Some validate paths before use, others don't
   - Add consistent path validation to all three methods (check for path traversal, existence)

4. **BACKLOG-1086: Fix TOCTOU race in backupService**
   - File: `electron/services/backupService.ts` (~line 973)
   - Checks file existence then operates on file — race condition
   - Fix: Use atomic operations (e.g., try the operation and handle ENOENT error instead of checking first)

5. **BACKLOG-1105: Sandbox PDF export BrowserWindow**
   - File: `electron/services/pdfExportService.ts`
   - Creates BrowserWindow without `sandbox: true` for PDF rendering from user data
   - Uses fixed 1-second delay (`setTimeout(1000)`) instead of `did-finish-load` event
   - Fix: Add `sandbox: true` and `contextIsolation: true` to BrowserWindow options
   - Fix: Replace setTimeout with `webContents.on('did-finish-load', ...)` event
   - Note: The content loaded may contain user-provided data (transaction details) — sandbox is important

### Must NOT Do:
- Do NOT change database schema
- Do NOT modify admin-portal, broker-portal, or Supabase code
- Do NOT break existing email sync or contact matching — only normalize
- Do NOT change PDF output format or content

---

## Files to Modify

- Contact handling files (search for phone lookup/matching in electron/)
- Thread linking files (search for thread dedup/linking in electron/)
- `electron/services/appleDriverService.ts` — Path validation
- `electron/services/backupService.ts` — Atomic file operations
- `electron/services/pdfExportService.ts` — Sandbox + event-based loading

## Files to Read (for context)

- Search electron/ for phone number handling patterns
- Search electron/ for thread linking/dedup patterns
- Read each target file before modifying

---

## Acceptance Criteria

- [ ] Phone lookups normalize format before comparison
- [ ] Thread linking uses consistent primary pattern
- [ ] appleDriverService validates all paths consistently
- [ ] backupService uses atomic operations (no TOCTOU)
- [ ] PDF BrowserWindow has sandbox + contextIsolation
- [ ] PDF rendering uses did-finish-load event
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

---

## Implementation Summary

**Agent ID:** ad4fab42
**Branch:** `fix/task-2246-electron-data-layer`

### Changes Made

1. **BACKLOG-1083 (Phone E.164):** Updated `electron/utils/phoneUtils.ts` `normalizePhoneNumber` to produce E.164-ish format (`+15551234567`) instead of digits-only (`15551234567`), consistent with `phoneNormalization.ts` and `messageMatchingService.ts`. Added `extractDigits()` helper for when raw digits are needed. Updated `formatPhoneNumber` to use `extractDigits`. Updated `contactsService.ts` country-code fallback logic for the new format. Updated test file.

2. **BACKLOG-1084 (Thread dedup):** Verified all thread linking code uses `thread_id` as primary key. pdfExportService now uses shared `getThreadKey` from `textExportHelpers.ts`. Pattern is consistent across: `autoLinkService`, `communicationDbService`, `folderExportService`, `pdfExportService`, `threadGroupingService`. No additional changes needed.

3. **BACKLOG-1085 (Path validation):** Applied `safeInstallerPath`/`safeOutputDir` (from `validateShellPath()`) to Methods 2, 3, and 4 in `appleDriverService.ts::extractMsiFromInstaller`. Method 1 already used validated paths; now all 4 methods are consistent. Path traversal detection was also added to `validateShellPath` by a concurrent fix.

4. **BACKLOG-1086 (TOCTOU race):** Converted `deleteBackup`, `checkBackupStatus`, and `getBackupInfo` in `backupService.ts` from check-then-act to atomic try/catch with ENOENT handling. `calculateBackupSize` was also fixed by a concurrent change.

5. **BACKLOG-1105 (PDF sandbox):** Added `sandbox: true` to BrowserWindow webPreferences. Replaced `setTimeout(1000)` with `did-finish-load` / `did-fail-load` event-based loading for reliable PDF rendering.

### Deviations

- BACKLOG-1084: Thread dedup was already largely consistent. The pdfExportService was updated by a concurrent agent to use the shared `getThreadKey`. No additional fixes needed beyond confirming consistency.
- Some backupService TOCTOU fixes (calculateBackupSize, listBackups) were already applied by a concurrent agent. I fixed the remaining instances (deleteBackup, checkBackupStatus, getBackupInfo).

### Issues/Blockers

- Type errors from concurrent agent's `backupService.ts` changes (bad `ReturnType<typeof fs.readdir<...>>` generic). Fixed by using `import("fs").Dirent[]` instead.
- Missing `hasStatusPlist` variable after TOCTOU refactor of `checkBackupStatus`. Fixed by removing from log statement.

### Results

- Type-check: PASS
- Tests: 1703 passed, 2 failed (pre-existing failures in transaction-handlers.integration.test.ts, verified on develop)
- Lint: PASS

## PR Preparation

- **Title:** `fix(electron): phone format, thread dedup, path validation, PDF sandbox`
- **Branch:** `fix/task-2246-electron-data-layer`
- **Target:** `develop`
