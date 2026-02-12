# TASK-1956: Move External Contacts Query to Worker Thread

**Backlog ID:** BACKLOG-661
**Sprint:** SPRINT-080
**Phase:** 1
**Branch:** `fix/TASK-1956-contact-query-worker-thread`
**Estimated Tokens:** ~25K (refactor category x 0.5 = ~12.5K, rounded up to ~25K for new-file complexity)

---

## Objective

Move the `contacts:get-available` IPC handler's synchronous `better-sqlite3` query to a Node.js `worker_threads` worker so it no longer blocks the Electron main process. With 1000+ contacts, the current synchronous `getAllForUser()` call blocks the main thread for ~3.7s, freezing window dragging and all UI interaction.

---

## Context

- **Root cause:** `externalContactDb.getAllForUser(validatedUserId)` at line 478 of `electron/contact-handlers.ts` calls `dbAll()` in `externalContactDbService.ts` (line 102), which uses `better-sqlite3`'s synchronous API. This blocks the Electron main process event loop.
- **SR Engineer research confirmed:** The recommended fix is to open a separate SQLite connection inside a `worker_threads` worker, run the query there, and post results back via message passing.
- **Encryption key handling:** The encryption key can be safely passed via `workerData` (same process, no IPC boundary).
- **WAL mode:** Required to allow concurrent reader (worker) + writer (main) access without `SQLITE_BUSY` errors.
- **Broader epic:** This is a targeted first step of BACKLOG-497 (Move all SQLite queries to worker thread). Only the `contacts:get-available` handler is in scope.

---

## Requirements

### Must Do:

1. **Create worker script** `electron/workers/contactQueryWorker.ts`
   - Accept `dbPath`, `encryptionKey`, and `userId` via `workerData`
   - Open its own `better-sqlite3-multiple-ciphers` connection with the same encryption pragmas as `dbConnection.ts` (lines 88-99)
   - Run the `getAllForUser` query (the exact SQL from `externalContactDbService.ts` lines 104-110)
   - Post the result array back to the parent via `parentPort.postMessage()`
   - Close the connection after the query completes
   - Handle errors gracefully (post error message back, never crash silently)

2. **Add async wrapper** `getAllForUserAsync(userId: string): Promise<ExternalContact[]>` to `electron/services/db/externalContactDbService.ts`
   - Spawns the worker, passes `dbPath`, `encryptionKey` (from `dbConnection.ts` getters), and `userId` via `workerData`
   - Returns a Promise that resolves with the parsed results or rejects on error/timeout
   - Worker should be one-shot (spawn per call, terminates after response) for simplicity in this first iteration
   - Add a 30-second timeout to prevent indefinite hangs

3. **Update `contact-handlers.ts` line 478** to use `await getAllForUserAsync(validatedUserId)` instead of the synchronous `getAllForUser(validatedUserId)`

4. **Enable WAL mode** in `electron/services/db/core/dbConnection.ts` `openDatabase()` function
   - Add `database.pragma("journal_mode = WAL")` after the existing pragma statements (after line 99, before the integrity check)
   - WAL mode enables concurrent reads from the worker thread while the main process may write

5. **Add unit tests** for the async wrapper
   - Test that `getAllForUserAsync` returns correct data
   - Test that it handles worker errors gracefully
   - Test timeout behavior
   - Mock the Worker class for unit testing

6. **Update existing contact-handler tests** if any mock `getAllForUser` to also cover the async path

### Must NOT Do:

- Do NOT refactor other database queries to use workers (only `contacts:get-available`)
- Do NOT create a persistent worker pool or worker manager (one-shot workers for now)
- Do NOT change the synchronous `getAllForUser` function (keep it for backward compatibility)
- Do NOT modify the `ExternalContact` interface or the SQL query itself
- Do NOT add any new npm dependencies (`worker_threads` is built into Node.js)
- Do NOT change the preload bridge or renderer code

---

## Acceptance Criteria

- [ ] `electron/workers/contactQueryWorker.ts` exists and opens its own encrypted SQLite connection
- [ ] `getAllForUserAsync()` added to `externalContactDbService.ts` using `worker_threads`
- [ ] `contact-handlers.ts` `contacts:get-available` handler uses the async version
- [ ] WAL mode (`PRAGMA journal_mode = WAL`) enabled in `dbConnection.ts` `openDatabase()`
- [ ] Worker passes encryption key via `workerData` (not via message after creation)
- [ ] Worker handles errors and posts them back to parent (no silent failures)
- [ ] 30-second timeout on the worker wrapper (rejects promise if worker hangs)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] New unit tests for `getAllForUserAsync` exist and pass

---

## Files to Create

- `electron/workers/contactQueryWorker.ts` - Worker script that runs the SQLite query in a separate thread

## Files to Modify

- `electron/services/db/externalContactDbService.ts` - Add `getAllForUserAsync()` wrapper
- `electron/contact-handlers.ts` - Line 478: switch from sync to async call
- `electron/services/db/core/dbConnection.ts` - Add WAL mode pragma in `openDatabase()`

## Files to Read (for context)

- `electron/services/db/core/dbConnection.ts` - Understand encryption setup and pragma configuration
- `electron/services/db/externalContactDbService.ts` - Understand the query and data mapping
- `electron/contact-handlers.ts` (lines 170-500) - Understand the `contacts:get-available` handler flow
- `electron/services/databaseEncryptionService.ts` - Understand how encryption key is managed

---

## Implementation Notes

### Worker Script Pattern

```typescript
// electron/workers/contactQueryWorker.ts
import { parentPort, workerData } from 'worker_threads';
import Database from 'better-sqlite3-multiple-ciphers';

const { dbPath, encryptionKey, userId } = workerData;

try {
  const db = new Database(dbPath);
  db.pragma(`key = "x'${encryptionKey}'"`);
  db.pragma('cipher_compatibility = 4');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');

  const sql = `
    SELECT id, user_id, name, phones_json, emails_json, company,
           last_message_at, external_record_id, source, synced_at
    FROM external_contacts
    WHERE user_id = ?
    ORDER BY last_message_at IS NULL, last_message_at DESC, name ASC
  `;

  const rows = db.prepare(sql).all(userId);
  db.close();

  parentPort?.postMessage({ success: true, data: rows });
} catch (error) {
  parentPort?.postMessage({
    success: false,
    error: error instanceof Error ? error.message : String(error)
  });
}
```

### Async Wrapper Pattern

```typescript
// In externalContactDbService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { getDbPath, getEncryptionKey } from './core/dbConnection';

export function getAllForUserAsync(userId: string): Promise<ExternalContact[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, '../workers/contactQueryWorker.js'),
      {
        workerData: {
          dbPath: getDbPath(),
          encryptionKey: getEncryptionKey(),
          userId,
        },
      }
    );

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Contact query worker timed out after 30s'));
    }, 30_000);

    worker.on('message', (msg) => {
      clearTimeout(timeout);
      if (msg.success) {
        // Parse JSON fields same as getAllForUser
        const contacts = msg.data.map((row: ExternalContactRow) => ({
          ...row,
          phones: JSON.parse(row.phones_json || '[]'),
          emails: JSON.parse(row.emails_json || '[]'),
        }));
        resolve(contacts);
      } else {
        reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
```

### WAL Mode Addition

In `dbConnection.ts` `openDatabase()`, add after the `busy_timeout` pragma:

```typescript
// Enable WAL mode for concurrent reader/writer access (worker threads)
database.pragma("journal_mode = WAL");
```

### Electron + TypeScript Worker Path

Note: In production builds, the worker `.ts` file is compiled to `.js`. The `path.join(__dirname, '../workers/contactQueryWorker.js')` path must resolve correctly in both dev and production. Check how `__dirname` resolves in the Electron main process after packaging. If needed, use `app.isPackaged` to determine the correct path.

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - `tests/unit/electron/services/db/externalContactDbService.worker.test.ts` (or similar)
    - Test `getAllForUserAsync` resolves with correct data when worker succeeds
    - Test `getAllForUserAsync` rejects when worker posts error
    - Test `getAllForUserAsync` rejects on timeout (mock delayed worker)
    - Mock `Worker` class from `worker_threads`
- **Existing tests to update:**
  - Check `tests/unit/electron/contact-handlers.test.ts` - if it mocks `getAllForUser`, ensure the async path is covered

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(contacts): move external contacts query to worker thread`
- **Branch:** `fix/TASK-1956-contact-query-worker-thread`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~25K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `__dirname` path resolution for the worker file does not work in the Electron main process
- The worker cannot open the encrypted database (encryption pragma failure)
- WAL mode causes test failures or unexpected behavior with existing code
- Any existing tests break after the WAL mode change
- The `contacts:get-available` handler has been significantly changed since the task was authored
- You encounter blockers not covered in the task file
