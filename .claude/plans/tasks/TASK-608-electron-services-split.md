# TASK-608: Electron Services Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 5 - Electron Services & Migration
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-604

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

---

## Objective

Split large electron service files to improve maintainability:
- `electron/services/databaseService.ts` (3,766 lines) → domain-specific files
- `electron/auth-handlers.ts` (3,273 lines) → focused handler files

---

## Current State

### databaseService.ts (3,766 lines)
Contains:
- Database initialization and encryption
- User operations
- Transaction CRUD
- Contact CRUD
- Communication CRUD
- Settings operations
- Sync operations
- Migration handling
- Audit log operations

Note: `electron/services/db/` already has some extracted services:
- `auditLogDbService.ts`
- `communicationDbService.ts`
- etc.

### auth-handlers.ts (3,273 lines)
Contains:
- Google OAuth flow
- Microsoft OAuth flow
- Session management
- Token refresh
- Profile management
- Gmail integration
- Outlook integration

---

## Requirements

### Must Do
1. Continue extraction pattern to `electron/services/db/`
2. Split auth-handlers into focused files
3. Maintain all existing functionality
4. Keep public APIs unchanged

### Must NOT Do
- Change database schema
- Modify encryption handling
- Break OAuth flows
- Alter IPC channel contracts

---

## Proposed Extraction

### databaseService.ts → db/

Build on existing `electron/services/db/` structure:

| Target File | Operations | Est. Lines |
|-------------|------------|------------|
| `db/userDbService.ts` | User CRUD | ~200 |
| `db/transactionDbService.ts` | Transaction CRUD | ~400 |
| `db/contactDbService.ts` | Contact CRUD | ~300 |
| `db/settingsDbService.ts` | Settings ops | ~150 |
| `db/syncDbService.ts` | Sync operations | ~200 |
| `db/migrationService.ts` | Migrations | ~300 |
| `databaseService.ts` | Init, core utils | ~500 |

### auth-handlers.ts Split

| Target File | Handlers | Est. Lines |
|-------------|----------|------------|
| `handlers/googleAuthHandlers.ts` | Google OAuth, Gmail | ~600 |
| `handlers/microsoftAuthHandlers.ts` | Microsoft OAuth, Outlook | ~600 |
| `handlers/sessionHandlers.ts` | Session management | ~400 |
| `auth-handlers.ts` | Registration, core | ~400 |

---

## Implementation Pattern

```typescript
// electron/handlers/googleAuthHandlers.ts
import { ipcMain, BrowserWindow } from "electron";
import { logService } from "../services/logService";
import { authService } from "../services/authService";

export function registerGoogleAuthHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle("auth:google:connect", async (event, userId) => {
    // ... existing Google OAuth logic
  });

  ipcMain.handle("auth:google:callback", async (event, code) => {
    // ... existing callback logic
  });

  // ... other Google handlers
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/db/userDbService.ts` | User database operations |
| `electron/services/db/transactionDbService.ts` | Transaction database operations |
| `electron/services/db/contactDbService.ts` | Contact database operations |
| `electron/services/db/settingsDbService.ts` | Settings database operations |
| `electron/services/db/syncDbService.ts` | Sync database operations |
| `electron/services/db/migrationService.ts` | Migration handling |
| `electron/handlers/googleAuthHandlers.ts` | Google OAuth handlers |
| `electron/handlers/microsoftAuthHandlers.ts` | Microsoft OAuth handlers |
| `electron/handlers/sessionHandlers.ts` | Session handlers |

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/databaseService.ts` | Extract to db/, reduce to ~500 lines |
| `electron/auth-handlers.ts` | Extract to handlers/, reduce to ~400 lines |
| `electron/services/db/index.ts` | Update barrel export |
| `electron/handlers/index.ts` | Update barrel export |

---

## Testing Requirements

1. **Database Tests**
   - All db service tests pass
   - CRUD operations work
   - Migrations work

2. **Auth Tests**
   - All auth tests pass
   - OAuth flows work
   - Session management works

3. **Integration**
   - App starts correctly
   - Login/logout works
   - Data operations work

---

## Acceptance Criteria

- [ ] `databaseService.ts` < 600 lines
- [ ] `auth-handlers.ts` < 500 lines
- [ ] All operations extracted to focused files
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-608-electron-services-split
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
