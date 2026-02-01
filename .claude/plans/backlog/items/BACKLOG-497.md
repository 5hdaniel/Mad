# BACKLOG-497: Move SQLite Queries to Worker Thread

## Type
Refactor / Performance

## Priority
High

## Status
Open

## Description

The Magic Audit application experiences UI freezes during database operations because `better-sqlite3` uses a synchronous API that blocks Electron's main process event loop. Even though IPC handlers are async, the actual database queries execute synchronously on the main thread, causing the UI to become unresponsive during data-intensive operations.

## Problem Statement

### Current Behavior
- Database queries block the Electron main process
- UI becomes unresponsive during contact loading, email queries, transaction queries
- Users experience visible freezes, especially with larger datasets
- The app feels "sluggish" despite async IPC wrappers

### Root Cause

The `dbConnection.ts` module uses `better-sqlite3`'s synchronous API directly:

```typescript
// electron/services/db/core/dbConnection.ts

export function dbGet<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
  const database = ensureDb();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;  // SYNCHRONOUS - blocks main process
}

export function dbAll<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const database = ensureDb();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];  // SYNCHRONOUS - blocks main process
}

export function dbRun(sql: string, params: unknown[] = []): QueryResult {
  const database = ensureDb();
  const stmt = database.prepare(sql);
  const result = stmt.run(...params);  // SYNCHRONOUS - blocks main process
  return { lastInsertRowid: result.lastInsertRowid as number, changes: result.changes };
}
```

These functions are called by all database services:
- `contactDbService.ts` - contact loading and search
- `communicationDbService.ts` - email and message queries
- `transactionDbService.ts` - transaction CRUD operations
- `sessionDbService.ts` - session management
- `oauthTokenDbService.ts` - token storage
- `auditLogDbService.ts` - audit trail queries
- `userDbService.ts` - user preferences
- `transactionContactDbService.ts` - transaction-contact relationships
- `feedbackDbService.ts` - user feedback
- `llmSettingsDbService.ts` - AI model settings

## Affected Areas

| Feature | Impact | Severity |
|---------|--------|----------|
| Contact List | Freezes when loading contacts | High |
| Email View | Freezes when querying emails | High |
| Transaction List | Freezes when loading transactions | High |
| Search | Freezes during search queries | High |
| Sync Operations | Extended freezes during bulk sync | Critical |
| iPhone Import | Long freezes during message import | Critical |
| Reindex Database (Settings) | Freezes during manual reindex | Medium |
| General Navigation | Brief freezes on data-heavy screens | Medium |

## Proposed Solution

Move all database operations to a dedicated worker thread using Node.js `worker_threads` module. The main process will communicate with the worker via message passing, making database operations truly asynchronous.

### Architecture

```
CURRENT:
[Renderer] --IPC--> [Main Process] --sync--> [SQLite]
                         ^
                         |
                    UI BLOCKED

PROPOSED:
[Renderer] --IPC--> [Main Process] --async msg--> [Worker Thread] --sync--> [SQLite]
                         ^                              ^
                         |                              |
                    UI FREE                        DB BLOCKED (isolated)
```

## Implementation Approach

### Phase 1: Worker Thread Infrastructure

1. **Create Database Worker** (`electron/services/db/worker/dbWorker.ts`)
   - Initialize database connection in worker
   - Handle message-based query requests
   - Return results via `parentPort.postMessage()`

2. **Create Worker Manager** (`electron/services/db/worker/dbWorkerManager.ts`)
   - Spawn and manage worker thread lifecycle
   - Provide async API that wraps message passing
   - Handle worker crashes and restarts
   - Implement request queuing and response correlation

### Phase 2: Migrate Core Query Functions

3. **Update dbConnection.ts**
   - Convert `dbGet`, `dbAll`, `dbRun`, `dbExec` to async
   - Route queries through worker manager
   - Maintain backward compatibility during transition

4. **Update All Database Services**
   - `contactDbService.ts`
   - `communicationDbService.ts`
   - `transactionDbService.ts`
   - `sessionDbService.ts`
   - `oauthTokenDbService.ts`
   - `auditLogDbService.ts`
   - `userDbService.ts`
   - `transactionContactDbService.ts`
   - `feedbackDbService.ts`
   - `llmSettingsDbService.ts`

### Phase 3: Handle Edge Cases

5. **Transaction Support**
   - Ensure transactions run atomically within worker
   - Implement `dbTransaction` that batches operations

6. **Encryption Handling**
   - Pass encryption key securely to worker
   - Ensure key never exposed in logs/errors

7. **Bulk Operations**
   - Optimize iPhone sync and bulk imports
   - Consider batching strategies for large datasets

### Phase 4: Testing and Validation

8. **Performance Testing**
   - Benchmark before/after query response times
   - Measure UI responsiveness improvements
   - Test with large datasets (10K+ contacts, emails)

9. **Integration Testing**
   - Verify all database operations work correctly
   - Test error handling and worker recovery
   - Test concurrent operations

## Technical Considerations

### Worker Thread Communication

```typescript
// Example worker manager interface
interface DbWorkerManager {
  query<T>(sql: string, params: unknown[]): Promise<T>;
  queryAll<T>(sql: string, params: unknown[]): Promise<T[]>;
  execute(sql: string, params: unknown[]): Promise<QueryResult>;
  executeRaw(sql: string): Promise<void>;
  transaction<T>(operations: DbOperation[]): Promise<T>;
}
```

### Message Protocol

```typescript
// Request message
interface DbRequest {
  id: string;  // Correlation ID
  type: 'get' | 'all' | 'run' | 'exec' | 'transaction';
  sql: string;
  params?: unknown[];
}

// Response message
interface DbResponse {
  id: string;  // Correlation ID
  success: boolean;
  result?: unknown;
  error?: { message: string; code?: string };
}
```

### Encryption Key Transfer

The encryption key must be passed to the worker during initialization. Options:
1. Pass via `workerData` during worker creation (preferred - single transfer)
2. Use secure IPC channel for key exchange
3. Store encrypted key reference that worker can resolve

### Error Handling

- Worker crashes should trigger automatic restart
- Pending queries should be re-queued or rejected with clear error
- Database corruption should be detected and reported

## Acceptance Criteria

- [ ] Database worker thread created and manages SQLite connection
- [ ] Worker manager provides async API for all query types
- [ ] All `dbConnection.ts` functions converted to async
- [ ] All database services updated to use async API
- [ ] Encryption works correctly in worker thread
- [ ] Transactions work atomically within worker
- [ ] Worker crash recovery implemented
- [ ] No UI freezes during database operations
- [ ] Performance benchmarks show improvement
- [ ] All existing database tests pass
- [ ] New tests cover worker thread scenarios
- [ ] Documentation updated for async database API

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing code | Gradual migration with compatibility layer |
| Worker communication overhead | Batch operations where possible |
| Encryption key security | Single transfer at init, secure storage |
| Complex transaction handling | Test thoroughly, maintain atomicity |
| Debugging difficulty | Add comprehensive logging in worker |

## Estimated Complexity

**High** - This change affects the entire database layer:
- 10+ database service files need updates
- All async/await patterns must be verified
- IPC handlers may need adjustment
- Extensive testing required
- Risk of subtle bugs during migration

## Estimated Effort

- **Phase 1 (Infrastructure)**: ~40K tokens
- **Phase 2 (Migration)**: ~60K tokens
- **Phase 3 (Edge Cases)**: ~30K tokens
- **Phase 4 (Testing)**: ~20K tokens
- **Total**: ~150K tokens (large sprint or split across multiple)

## Related Files

- `electron/services/db/core/dbConnection.ts` - Core query functions
- `electron/services/db/contactDbService.ts` - Contact operations
- `electron/services/db/communicationDbService.ts` - Email/message operations
- `electron/services/db/transactionDbService.ts` - Transaction operations
- `electron/services/db/sessionDbService.ts` - Session management
- `electron/services/db/oauthTokenDbService.ts` - OAuth token storage
- `electron/services/db/auditLogDbService.ts` - Audit logging
- `electron/services/db/userDbService.ts` - User preferences
- `electron/services/db/transactionContactDbService.ts` - Transaction-contact links
- `electron/services/db/feedbackDbService.ts` - Feedback storage
- `electron/services/db/llmSettingsDbService.ts` - AI settings
- `electron/services/db/index.ts` - Database service exports
- `electron/services/databaseEncryptionService.ts` - Encryption key management

## References

- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [better-sqlite3 Threading](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md)
- [Electron Performance Best Practices](https://www.electronjs.org/docs/latest/tutorial/performance)

## Created
2026-01-24
