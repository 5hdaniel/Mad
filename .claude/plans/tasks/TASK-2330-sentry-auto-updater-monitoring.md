# TASK-2330: Add Sentry Monitoring for Auto-Update Lifecycle

**Status:** In Progress
**Sprint:** SPRINT-155 (Sentry Auto-Updater Monitoring)
**Backlog Item:** BACKLOG-1554
**Priority:** High
**Estimated Tokens:** ~30K
**Branch:** feature/task-2330-sentry-updater
**PR Target:** int/sprint-155-sentry-updater

---

## Context

v2.15.0/v2.15.2 had a filename mismatch (latest.yml referenced hyphens, assets had dots) that silently broke auto-updates. We had no visibility into this — users were stuck on old versions. Need Sentry telemetry to catch these issues early.

### Current State
- `error` event -> Sentry exception + log
- `update-available` -> breadcrumb only
- `update-downloaded` -> breadcrumb only
- Manual check failure -> Sentry exception + failure log service
- No version context, no download progress tracking, no stall detection
- `Sentry.setUser()` on session restore already exists (line 995 of sessionHandlers.ts) -- verified during PM review

### Incident Reference
v2.15.0/v2.15.2 filename mismatch broke auto-updates silently. Users Madison (2.9.6), Jordan (2.10.1), Vickie (2.14.0) were all stuck on old versions.

---

## Requirements

### File 1: `electron/constants.ts`

1. Add named constant `DOWNLOAD_STALL_TIMEOUT_MS = 60_000` (60 seconds)
   - Place near existing `UPDATE_CHECK_DELAY` and `UPDATE_CHECK_INTERVAL` constants (line ~93-94)

### File 2: `electron/main.ts` (auto-updater section, lines ~844-883)

2. **Add Sentry.setContext for auto-updater** immediately after `Sentry.init()` (line ~159), NOT inside `whenReady`:
   ```typescript
   Sentry.setContext('auto-updater', {
     currentVersion: app.getVersion(),
     platform: process.platform,
     arch: process.arch,
     feedRepo: '5hdaniel/keepr-releases',  // owner/repo only, no full URL
   });
   ```

3. **Add breadcrumb to `checking-for-update`** event (currently has none):
   ```typescript
   Sentry.addBreadcrumb({ category: 'auto-updater', message: 'Checking for update', level: 'info' });
   ```

4. **Add breadcrumb to `update-not-available`** event (currently has none):
   ```typescript
   Sentry.addBreadcrumb({ category: 'auto-updater', message: `Update not available (current: ${info.version})`, level: 'info' });
   ```

5. **Enrich `error` handler** with context tags — current version, platform, arch. Strip query params from any asset URLs before sending to Sentry:
   ```typescript
   autoUpdater.on("error", (err) => {
     log.error("Error in auto-updater:", err);
     // Strip query params from error message URLs for privacy
     const sanitizedMessage = err.message?.replace(/\?[^\s]*/g, '') || 'Unknown error';
     Sentry.captureException(err, {
       tags: {
         component: 'auto-updater',
         currentVersion: app.getVersion(),
         platform: process.platform,
         arch: process.arch,
       },
       extra: { sanitizedMessage },
     });
     // Clear stall timer on error
     if (downloadStallTimer) {
       clearTimeout(downloadStallTimer);
       downloadStallTimer = null;
     }
   });
   ```

6. **Add download stall detection** to `download-progress` handler:
   - Declare `let downloadStallTimer: ReturnType<typeof setTimeout> | null = null;` before the `whenReady` block
   - On each progress event, clear and reset the stall timer
   - If no progress event fires for `DOWNLOAD_STALL_TIMEOUT_MS`, fire `Sentry.captureMessage` (NOT captureException) with warning level
   - Clear the stall timer on BOTH `update-downloaded` AND `error` events

7. **Clear stall timer on `update-downloaded`** event (in addition to existing logic):
   ```typescript
   if (downloadStallTimer) {
     clearTimeout(downloadStallTimer);
     downloadStallTimer = null;
   }
   ```

### File 3: `electron/handlers/updaterHandlers.ts`

8. **Add Sentry breadcrumb on install-update** in the `install-update` IPC handler:
   ```typescript
   Sentry.addBreadcrumb({ category: 'auto-updater', message: 'User triggered install-update', level: 'info' });
   ```

### File 4: `electron/handlers/sessionHandlers.ts`

9. **Sentry.setUser() on session restore** -- ALREADY DONE at line 995. No changes needed. Verified during PM review that `Sentry.setUser({ id: user.id, email: ... })` is called in `handleGetCurrentUser` for returning users.

---

## SR Engineer Recommendations (APPROVED)

The SR Engineer reviewed this plan and approved with these specific recommendations (all incorporated above):

1. **Use `captureMessage` not `captureException` for stalls** -- stalls are diagnostic events, not errors
2. **Strip query params from asset URLs** before sending to Sentry (privacy)
3. **Place `setContext` after `Sentry.init()`** (line ~159), not inside `whenReady` -- context should be set as early as possible
4. **Named constant for 60s stall timeout** -- `DOWNLOAD_STALL_TIMEOUT_MS` in constants.ts
5. **Clear stall timer on BOTH `update-downloaded` AND `error`** -- prevents stale timers
6. **Add feed repo tag** -- owner/repo only (`5hdaniel/keepr-releases`), not full URL
7. **Clear `lastKnownUpdateInfo` on error** -- N/A, no such variable exists in current codebase (verified by PM)

---

## Acceptance Criteria

- [ ] All auto-updater lifecycle events have Sentry breadcrumbs (`checking-for-update`, `update-available`, `update-not-available`, `update-downloaded`, `install-update`)
- [ ] Download failures include current version, platform, arch in Sentry tags
- [ ] Asset URLs in error messages have query params stripped before Sentry
- [ ] Download stalls (>60s no progress) trigger a `Sentry.captureMessage` warning
- [ ] `DOWNLOAD_STALL_TIMEOUT_MS` constant defined in `electron/constants.ts`
- [ ] `Sentry.setContext('auto-updater', ...)` set immediately after `Sentry.init()`
- [ ] Feed repo tag included in auto-updater context
- [ ] Install action tracked with breadcrumb in `updaterHandlers.ts`
- [ ] Stall timer cleared on both `update-downloaded` and `error` events
- [ ] All existing tests pass (`npx jest --bail --no-coverage`)
- [ ] Type check passes (`npm run type-check`)

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/constants.ts` | Add `DOWNLOAD_STALL_TIMEOUT_MS` constant |
| `electron/main.ts` | Add setContext after init, breadcrumbs, enriched error handler, stall detection |
| `electron/handlers/updaterHandlers.ts` | Add install breadcrumb |

**Files NOT modified** (already complete):
| File | Reason |
|------|--------|
| `electron/handlers/sessionHandlers.ts` | `Sentry.setUser()` already present at line 995 |

---

## Agent ID Tracking

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | Pending |

---

## Implementation Summary

_To be filled by Engineer after implementation._
