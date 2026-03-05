# BACKLOG-241: Add Startup Health Checks

## Status: In Progress | Priority: Critical | Area: electron | Sprint: SPRINT-107 | Task: TASK-2101

## Summary

Two-phase startup health checks to catch system-level failures early and give users actionable error messages instead of cryptic crashes.

## Current State (19 checks already covered)

The app has strong post-auth checks but weak pre-auth preflight:
- Single instance lock, Sentry, global error handlers, CSP, context isolation — all covered
- DB cipher integrity, schema migrations, auto-restore on migration failure — all covered
- SystemHealthMonitor checks permissions + OAuth every 2min after boot — covered
- ErrorScreen with diagnostics, retry, and Reset App Data — covered
- Pre-DB auth validation (SOC 2 CC6.1) — covered

## Phase 1: Pre-Auth (in `electron/main.ts` before `createWindow`)

### P0: Native module load validation
- `better-sqlite3-multiple-ciphers` is imported bare at `databaseService.ts:19` with no try/catch
- If the native binary has a NODE_MODULE_VERSION mismatch (known failure mode, documented in CLAUDE.md), the app crashes at module load with no user-facing error
- **Fix:** Wrap import in try/catch. If it fails, show `dialog.showErrorBox()` with "Database engine failed to load. Please reinstall the application." Report to Sentry with version details.

### P1: safeStorage preflight check
- Currently checked at 4 separate point-of-use sites: `databaseEncryptionService:98`, `tokenEncryptionService:76`, `keychainGate:67`, `sessionService:71`
- No single preflight gate — failure surfaces as a cryptic error during DB init
- **Fix:** Single `safeStorage.isEncryptionAvailable()` check in `app.whenReady()`. If unavailable, show clear error: "Encryption not available. Please check your system keychain."

### P1: App data directory writable
- No explicit check that userData directory exists and is writable
- SQLite gives confusing OS-level errors if directory is read-only
- **Fix:** `fs.access(app.getPath('userData'), fs.constants.W_OK)` before DB init. Show diagnostic message with expected path if not writable.

### P1: Disk space check
- `check-disk-space` dependency already installed (used in `deviceSyncOrchestrator.ts` for sync)
- Not checked at startup — SQLite fails with confusing errors on full disk
- **Fix:** Check available space before DB init. Warn at <100MB, block at <10MB.

### P2: OS version compatibility
- `os.release()` collected for diagnostics but never compared against minimum
- **Fix:** Check macOS >= 12 (Monterey), Windows >= 10. Log warning for unsupported versions.

## Phase 2: Post-Auth (mostly done, gaps noted)

### Partial gap: safeStorage centralization
- 4 scattered checks should defer to Phase 1 preflight result

### Partial gap: Network connectivity probe
- Uses `navigator.onLine` which is unreliable (returns `true` on captive portals)
- `NetworkContext.tsx` `checkConnection()` just re-reads `navigator.onLine`
- **Fix:** Ping Supabase health endpoint or lightweight URL for real probe

### Optional (P3): PRAGMA quick_check
- `cipher_integrity_check` (fast, cipher-page-only) runs on every DB open
- Full `integrity_check` only runs during backup verification
- Consider periodic `PRAGMA quick_check` for defense-in-depth

## Key Files

- `electron/main.ts` — Boot sequence at `app.whenReady()` (line 837)
- `electron/services/databaseService.ts` — DB init, migrations, auto-restore
- `electron/services/databaseEncryptionService.ts` — Key management, safeStorage
- `electron/services/keychainGate.ts` — Keychain access gatekeeper
- `electron/handlers/diagnosticHandlers.ts` — Runtime health check handler
- `src/appCore/state/machine/LoadingOrchestrator.tsx` — Renderer-side 4-phase init
- `src/components/SystemHealthMonitor.tsx` — Runtime health monitor

## Estimate

~35K tokens. Phase 1 checks are all small (1-4hr each). Total ~10-15hr engineering time.

## SR Audit Reference

Full audit conducted March 2026 comparing Keepr to VS Code, Slack, 1Password startup patterns.
