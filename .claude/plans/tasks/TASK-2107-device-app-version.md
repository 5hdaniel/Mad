# TASK-2107: Populate app_version on Device Check-in

---

## WORKFLOW REQUIREMENT

**This task MUST follow the 15-step agent-handoff workflow.**
See: `.claude/skills/agent-handoff/SKILL.md`

---

## Goal

Add `app_version` to the device upsert in `registerDevice()` and the heartbeat update in `updateDeviceHeartbeat()`. The `devices` table already has the `app_version TEXT` column — it's just never written to (all rows are NULL).

## Non-Goals

- Do NOT modify the `devices` table schema (column already exists)
- Do NOT add Sentry Release Health session tracking (deferred)
- Do NOT add UI for version display (that's admin portal work)

## Branch

`feature/task-2107-device-app-version`

## Worktree

```bash
git worktree add ../Mad-task-2107 -b feature/task-2107-device-app-version develop
```

## Files to Modify

- `electron/services/deviceService.ts` — only file

## Implementation Details

### 1. `registerDevice()` (line ~86)

Add `app_version` to the upsert object:

```typescript
// electron/services/deviceService.ts:86-95
.upsert(
  {
    user_id: userId,
    device_id: deviceId,
    device_name: deviceName,
    os: osString,
    platform: devicePlatform,
    is_active: true,
    last_seen_at: new Date().toISOString(),
    app_version: app.getVersion(),  // <-- ADD THIS
  },
  {
    onConflict: "user_id,device_id",
  }
)
```

### 2. `updateDeviceHeartbeat()` (line ~163)

Add `app_version` to the heartbeat update:

```typescript
// electron/services/deviceService.ts:163
.update({
  last_seen_at: new Date().toISOString(),
  app_version: app.getVersion(),  // <-- ADD THIS
})
```

### 3. Import `app`

Check if `app` is already imported from `electron` at the top of the file. If not, add:

```typescript
import { app } from "electron";
```

`app.getVersion()` is already used throughout the codebase (Sentry init in `electron/main.ts`, error logging, etc.) — this is a proven pattern.

## Acceptance Criteria

- [ ] `registerDevice()` includes `app_version: app.getVersion()` in the upsert
- [ ] `updateDeviceHeartbeat()` includes `app_version: app.getVersion()` in the update
- [ ] `npx tsc --noEmit` passes
- [ ] After login, `SELECT device_id, app_version FROM devices WHERE user_id = '<id>'` returns a version string (not NULL)

## Integration Notes

- **Enables:** BACKLOG-840 (analytics dashboard version breakdown)
- **No blockers** — standalone change

---

## PM Estimate (PM-Owned)

**Category:** `electron`

**Estimated Tokens:** ~5K (two-line change in one file)

**Token Cap:** 20K

**Confidence:** High — well-understood pattern, minimal scope.
